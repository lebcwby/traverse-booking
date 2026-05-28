#!/usr/bin/env bash
# scripts/check-deployable.sh
#
# Catches the two failure modes that bit us in 2026-05 — uncommitted/untracked
# files getting deployed via CLI working-tree uploads but missing from git, and
# tracked code that imports modules/exports that don't exist in HEAD. Both
# patterns silently produce broken git-integrated builds.
#
# Used by:
#   - .husky/pre-push   — blocks pushes that would dangle imports
#   - npm run deploy    — refuses CLI deploys with a dirty working tree
#
# Modes (env var DEPLOY_CHECK_MODE):
#   tracked-only (default)  — only scan tracked files for missing imports
#   strict                  — also refuse to proceed if working tree is dirty

set -uo pipefail
# Don't `set -e` — grep returns 1 on no-match and that's fine here; we
# explicitly check `$problems` at the end.

MODE="${DEPLOY_CHECK_MODE:-tracked-only}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

red()    { printf "\033[31m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }

problems=0

# ─── 1. (strict mode) Working tree must be clean ──────────────────────────
if [ "$MODE" = "strict" ]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    red "✗ Working tree has uncommitted changes."
    git status --short | head -15
    red "Commit or stash, then deploy. Use --force flag only for genuine emergencies."
    exit 1
  fi

  untracked="$(git ls-files --others --exclude-standard src/ 2>/dev/null | head -5)"
  if [ -n "$untracked" ]; then
    red "✗ Untracked files in src/. CLI deploys would ship these, but git-integrated builds won't have them:"
    echo "$untracked"
    git ls-files --others --exclude-standard src/ 2>/dev/null | wc -l | xargs -I{} red "  total: {} untracked files"
    exit 1
  fi
fi

# ─── 2. Tracked files importing untracked modules (file-level gap) ────────
yellow "Scanning tracked files for imports of untracked modules…"
file_gap=$(
  git ls-files 'src/**/*.ts' 'src/**/*.tsx' 2>/dev/null \
    | xargs grep -h "^import" 2>/dev/null \
    | grep -oE "@/[a-zA-Z0-9/_-]+" \
    | sort -u \
    | while read -r m; do
        for ext in "" ".ts" ".tsx" "/index.ts" "/index.tsx"; do
          p="src/${m#@/}$ext"
          if [ -f "$p" ]; then
            if ! git ls-files --error-unmatch "$p" >/dev/null 2>&1; then
              echo "  $m → $p (file exists locally but not in git)"
            fi
            break
          fi
        done
      done
)
if [ -n "$file_gap" ]; then
  red "✗ Tracked code imports modules that are untracked in git:"
  echo "$file_gap"
  problems=$((problems + 1))
fi

# ─── 3. Symbol-level gaps (modified tracked files adding NEW exports that
#       other tracked code already imports — i.e., the symbol exists in
#       working tree but NOT in HEAD) ───────────────────────────────────────
yellow "Scanning modified tracked files for new exports used in HEAD…"
sym_gap=$(
  for f in $(git status --short | awk '/^[ M]M/{print $2}' | grep '^src/'); do
    new_exports=$(
      git diff "$f" \
        | grep -E "^\+(export (const|function|class|interface|type|let|var) )" \
        | grep -oE "(const|function|class|interface|type|let|var) [A-Za-z0-9_]+" \
        | awk '{print $2}' \
        | sort -u
    )
    for sym in $new_exports; do
      # is this symbol already exported in HEAD?
      if git show "HEAD:$f" 2>/dev/null | grep -qE "^export.*\b$sym\b"; then
        continue
      fi
      # is anyone in tracked code importing it?
      consumer=$(git grep -l "\b$sym\b" -- ':!*.test.*' "$f" 2>/dev/null | grep -v "^$f$" | head -1)
      if [ -n "$consumer" ]; then
        echo "  $f exports new $sym → consumed by $consumer"
      fi
    done
  done
)
if [ -n "$sym_gap" ]; then
  red "✗ Modified files add new exports that tracked code already uses, but the modifications aren't committed:"
  echo "$sym_gap"
  problems=$((problems + 1))
fi

# ─── 4. Clean-checkout TypeScript check ────────────────────────────────────
#
# Bit us three times on 2026-05-28: a modified-but-uncommitted file
# (ShareButton city prop, UpsellSelector upsells prop, payment-intent
# checkoutToken response) created a runtime mismatch between the
# committed consumer and the committed receiver. Local `npx tsc --noEmit`
# always passed because the dev's working tree was self-consistent;
# Vercel's git checkout was missing the receiver's update, so either
# the build broke OR the deploy succeeded with a runtime contract gap.
#
# This stash dance simulates exactly what Vercel sees: stash unstaged +
# untracked, run tsc, restore. If the staged changes need uncommitted
# files to compile, we catch it here.
#
# Skippable with DEPLOY_CHECK_SKIP_CLEAN_TSC=1 — useful when intentionally
# pushing partial work behind a feature flag, but should be very rare.
if [ "${DEPLOY_CHECK_SKIP_CLEAN_TSC:-0}" = "1" ]; then
  yellow "Skipping clean-checkout tsc (DEPLOY_CHECK_SKIP_CLEAN_TSC=1)"
else
  yellow "Running tsc against staged-only state (simulates Vercel git checkout)…"
  # `--keep-index` stashes the unstaged + untracked changes, leaving the
  # staged set in place. That's exactly what Vercel will compile.
  stash_msg="deploy-check $(date +%s)"
  needs_pop=0
  if ! git diff --quiet || ! git diff --cached --quiet || \
       [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
    if git stash push -u --keep-index -m "$stash_msg" >/dev/null 2>&1; then
      needs_pop=1
    fi
  fi

  tsc_output=$(npx tsc --noEmit 2>&1)
  tsc_exit=$?

  if [ "$needs_pop" = "1" ]; then
    # Restore unstaged + untracked. If pop fails, that's bad — leave a loud
    # message so the dev can manually `git stash list` and pop.
    if ! git stash pop --quiet >/dev/null 2>&1; then
      red "✗ git stash pop FAILED after clean-checkout tsc. Your unstaged"
      red "  changes are in the stash. Recover with: git stash list && git stash pop"
      exit 1
    fi
  fi

  if [ "$tsc_exit" -ne 0 ]; then
    red "✗ TypeScript errors against staged-only state (what Vercel will see):"
    echo "$tsc_output" | head -40
    red ""
    red "This means your push would BREAK the Vercel build. The most common"
    red "cause: a tracked file imports a prop/symbol/field that lives in another"
    red "tracked file's UNCOMMITTED working-tree changes. Stage the missing"
    red "receiver-side edits and retry."
    problems=$((problems + 1))
  fi
fi

# ─── 5. Backlog tripwire (advisory) ───────────────────────────────────────
#
# The /plan page served stale "Portland" branding in prod for an unknown
# stretch because the Colorado rewrite was finished locally but never
# committed — it sat in a working tree that had quietly grown to ~100
# uncommitted files. When the backlog is that big, nobody can tell what's
# shipped vs. unshipped, and finished work silently never reaches prod.
#
# This is a WARNING, not a hard block: legitimate multi-file features exist,
# and we don't want to wedge people into bad habits (giant commits, --force).
# But a large uncommitted set should never be silent. Set
# DEPLOY_CHECK_BACKLOG_FAIL=1 to make it a hard failure instead.
backlog_warn="${DEPLOY_CHECK_BACKLOG_WARN:-25}"
backlog_count="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
if [ "${backlog_count:-0}" -gt "$backlog_warn" ]; then
  yellow ""
  yellow "⚠ Backlog tripwire: $backlog_count uncommitted files in the working tree (warn threshold: $backlog_warn)."
  yellow "  A large backlog is how finished work silently never ships (the /plan"
  yellow "  Portland regression). Triage it: commit, stash with intent, or discard."
  yellow "  Top of the pile:"
  git status --short | head -12 | sed 's/^/    /'
  remaining=$((backlog_count - 12))
  if [ "$remaining" -gt 0 ]; then
    yellow "    …and $remaining more (git status)"
  fi
  if [ "${DEPLOY_CHECK_BACKLOG_FAIL:-0}" = "1" ]; then
    red "✗ DEPLOY_CHECK_BACKLOG_FAIL=1 — treating backlog as a hard failure."
    problems=$((problems + 1))
  fi
fi

# ─── Verdict ──────────────────────────────────────────────────────────────
if [ "$problems" -gt 0 ]; then
  red ""
  red "Build would break on git-integrated deploy. Fix the gaps above, then retry."
  exit 1
fi

green "✓ No dangling imports/exports. Safe to push/deploy."
