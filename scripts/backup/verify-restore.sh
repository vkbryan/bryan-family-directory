#!/usr/bin/env bash
# Practice restore: loads the backup's data into the throwaway local Supabase
# that `supabase start` created, then checks the restored copy has the same
# row counts as the live database had at backup time, and that every photo
# was downloaded. Exits non-zero (failing the backup run) on any mismatch.
#
# Usage: scripts/backup/verify-restore.sh <backup dir>
set -euo pipefail

DIR="${1:?usage: verify-restore.sh <backup dir>}"
LOCAL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# Empty every table the backup will fill (triggers off, so the append-only
# audit log can be cleared in this throwaway copy), then load the data.
tables=$(grep -oE '^COPY "?[a-z_]+"?\."?[a-z_0-9]+"?' "$DIR/data.sql" | sed -E 's/^COPY //; s/"//g' | sort -u)
{
  echo "SET session_replication_role = replica;"
  for t in $tables; do echo "TRUNCATE $t CASCADE;"; done
} | psql "$LOCAL" -v ON_ERROR_STOP=1 -q

psql "$LOCAL" -v ON_ERROR_STOP=1 -q \
  -c "SET session_replication_role = replica" \
  -f "$DIR/data.sql"

restored=$(psql "$LOCAL" -At -f scripts/backup/counts.sql)
live=$(cat "$DIR/live-counts.txt")
photos_saved=$(find "$DIR/photos" -type f | wc -l | tr -d ' ')

echo "live:     $live"
echo "restored: $restored"
echo "photo files downloaded: $photos_saved"

if [ "$live" != "$restored" ]; then
  echo "❌ Restored row counts don't match the live database." >&2
  exit 1
fi
photos_expected=$(echo "$live" | cut -d, -f4)
if [ "$photos_saved" != "$photos_expected" ]; then
  echo "❌ Expected $photos_expected photos, downloaded $photos_saved." >&2
  exit 1
fi
echo "✅ Practice restore matches the live database."
