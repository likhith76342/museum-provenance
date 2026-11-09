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
- `db/advanced`: views, functions, procedures, triggers (loaded after seed + embeddings)
- `db/tests`: feature tests, each rolled back
- `docs`: problem statement, ER diagram, relational schema
- `scripts`: helper scripts and embedding generator

## Advanced database features
| Feature | Object |
|---|---|
| Views | v_current_owner, v_provenance_summary, v_latest_condition, v_open_flags |
| Stored procedures (transactions) | transfer_ownership, review_flag |
| Functions | artifact_gaps, find_similar_reports, search_reports |
| Triggers | curator account role, user role change, artifact delete guard, report date validation, grade-change flagging, embedding anomaly flagging |
| Indexing | composite, partial, HNSW (vector), GIN (full-text) |
| Full-text search | tsvector generated column + GIN index |
| Vector similarity search | pgvector cosine distance + HNSW |

Load order: schema → seed (historical import) → embeddings → `db/advanced/*.sql`.
Triggers apply to data entered after setup.

## Tests
```bash
./scripts/run_tests.sh
```

## Web app (Next.js)
Requires Node.js 20.9+.
```bash
docker compose up -d                 # database (+ embedding API once merged)
./scripts/reset_db.sh                # schema, seed, embeddings, advanced features
cp web/.env.example web/.env.local   # set the same password as in .env
cd web && npm install && npm run dev # http://localhost:3000
```

### Demo accounts (seed data)
| Role | Email | Password |
|---|---|---|
| Admin | admin@museum.test | Admin@123 |
| Curator | meera.iyer@museum.test | Curator@123 |
| Curator | rahul.menon@museum.test | Curator@123 |
| Researcher | kavya.nair@uni.test | Research@123 |

### Security model
Every request runs as `BEGIN; SET LOCAL ROLE app_<role>; ...; COMMIT;`.
`app_researcher` has SELECT only (no password hashes), `app_curator` can write the catalogue,
provenance, reports and flags, `app_admin` can also manage users. Login and sessions are
handled in the database (`app_login`, bcrypt via pgcrypto, SHA-256-hashed session tokens).
