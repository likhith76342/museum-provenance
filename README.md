# Museum/Archive Artifact Provenance & Condition-Report Matching

DBMS Level 3 project: PostgreSQL (relational) + pgvector (vector similarity) + Next.js (later).

## Setup
1. Install Docker Desktop and start it.
2. `cp .env.example .env` and set your own password (in both places).
3. `docker compose up -d`
4. `./scripts/reset_db.sh` to build the schema, load seed data and embed the condition reports.
   Embeddings run in Docker (`docker compose --profile tools run --rm embedder`), so no local Python is needed.
   The first run builds the image (CPU-only PyTorch) and downloads the model once into the `hf_cache` volume.
   Why Docker: PyTorch has no builds for Intel Macs on Python 3.13.

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
