# Museum/Archive Artifact Provenance & Condition-Report Matching

DBMS Level 3 project: PostgreSQL (relational) + pgvector (vector similarity) + Next.js (later).

## Setup
1. Install Docker Desktop and start it.
2. `cp .env.example .env` and set your own password (in both places).
3. `docker compose up -d`
4. `./scripts/reset_db.sh` to build schema and seed data.
5. Embeddings: `python3 -m venv .venv && source .venv/bin/activate && pip install -r scripts/requirements.txt && python scripts/embed_reports.py`

## Run queries
```bash
./scripts/psql.sh                                   # interactive
./scripts/psql.sh < db/queries/01_catalog_provenance_queries.sql
```

## Structure
- `db/schema`: DDL (00 extensions, 01 core tables, 02 history/condition tables, 99 drop)
- `db/seed`: sample data
- `db/queries`: sample queries
- `docs`: problem statement, ER diagram, relational schema
- `scripts`: helper scripts and embedding generator
