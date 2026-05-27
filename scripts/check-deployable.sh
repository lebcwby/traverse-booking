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

# ─── Verdict ──────────────────────────────────────────────────────────────
if [ "$problems" -gt 0 ]; then
  red ""
  red "Build would break on git-integrated deploy. Fix the gaps above, then retry."
  exit 1
fi

green "✓ No dangling imports/exports. Safe to push/deploy."
