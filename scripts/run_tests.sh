#!/usr/bin/env bash
# Runs every test file in db/tests/. Each file runs inside BEGIN ... ROLLBACK,
# so tests never change the demo data. A failing test stops the run with "FAIL ...".
set -euo pipefail
cd "$(dirname "$0")/.."
for f in db/tests/*.sql; do
  [ -e "$f" ] || continue
  echo "==> $f"
  ./scripts/psql.sh -q -v ON_ERROR_STOP=1 < "$f"
done
echo "All tests passed."
