#!/usr/bin/env bash
# scripts/audit-migration-coverage.sh
#
# Lists tables referenced from application code that have NO matching
# CREATE TABLE / create table in any committed migration file. A real
# gap indicates a schema change that was applied via dashboard SQL but
# never backfilled to a migration file (see supabase/migrations/README.md).
#
# Usage: bash scripts/audit-migration-coverage.sh
# Exit:  0 if no gap, 1 if gap found.
#
# Compatible with macOS's default bash 3.2 — avoids mapfile / namerefs.

set -eu
cd "$(dirname "$0")/.."

# Tables referenced via `.from("<table>")` in TypeScript code.
REFERENCED=$(
  grep -rhEon "\.from\(\"[a-z_]+\"" src/ 2>/dev/null \
    | sed 's/.*\.from("//; s/".*//' \
    | sort -u
)

# Tables covered by any committed migration. Handles all the variants pg_dump
# and hand-written migrations produce:
#   CREATE TABLE listings (
#   CREATE TABLE IF NOT EXISTS public.listings (
#   create table "public"."listings" (    <-- supabase db pull output
#   CREATE TABLE "listings" (
COVERED=$(
  cat supabase/_archived_migrations_20260319/*.sql supabase/migrations/*.sql 2>/dev/null \
    | grep -iEo 'create table( if not exists)? +("?public"?\.)?"?[a-z_]+"?' \
    | sed -E 's/^.*create table( if not exists)? +//I; s/"?public"?\.//; s/"//g' \
    | sort -u
)

gap_count=0
echo "Migration coverage audit:"
echo
for table in $REFERENCED; do
  if echo "$COVERED" | grep -q "^${table}$"; then
    printf "  [COVERED]  %s\n" "$table"
  else
    printf "  [MISSING]  %s\n" "$table"
    gap_count=$((gap_count + 1))
  fi
done

echo
if [ "$gap_count" -gt 0 ]; then
  echo "$gap_count table(s) referenced from code but not in any migration."
  echo "See supabase/migrations/README.md -> 'Known gap'."
  exit 1
fi
echo "All referenced tables have committed migrations."
