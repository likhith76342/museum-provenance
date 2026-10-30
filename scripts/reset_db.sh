#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
FILES=(
  db/schema/99_drop_all.sql
  db/schema/00_extensions.sql
  db/schema/01_core_tables.sql
  db/schema/02_history_condition_tables.sql
  db/seed/01_core_seed.sql
  db/seed/02_history_condition_seed.sql
)
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    echo "==> $f"
    ./scripts/psql.sh -q -v ON_ERROR_STOP=1 < "$f"
  else
    echo "--- skipping $f (not created yet)"
  fi
done
if [ -f scripts/embed_reports.py ]; then
  if [ -x .venv/bin/python ]; then
    echo "==> embeddings"; .venv/bin/python scripts/embed_reports.py
  else
    echo "--- skipping embeddings (create .venv first, see README)"
  fi
fi
echo "Done."
