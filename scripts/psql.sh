#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
if [ -t 0 ]; then TTY_FLAG=""; else TTY_FLAG="-T"; fi
exec docker compose exec $TTY_FLAG db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
