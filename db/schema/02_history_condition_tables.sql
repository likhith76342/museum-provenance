-- =====================================================================
-- 02_history_condition_tables.sql
-- Owner: Monish
-- Depends on: 00_extensions.sql (vector, btree_gist) and 01_core_tables.sql
-- Tables: ownership_history, condition_reports, report_embeddings, anomaly_flags
-- =====================================================================

-- ---------------------------------------------------------------------
-- OWNERSHIP_HISTORY
-- Resolves the M:N relationship ARTIFACT <-> OWNER over time.
-- Surrogate PK (not artifact_id+owner_id) because the same owner can
-- own the same artifact twice (sold, then bought back).
-- ---------------------------------------------------------------------
CREATE TABLE ownership_history (
    ownership_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    artifact_id         INT NOT NULL REFERENCES artifacts(artifact_id) ON DELETE RESTRICT,
    owner_id            INT NOT NULL REFERENCES owners(owner_id)       ON DELETE RESTRICT,
    acquired_from       DATE NOT NULL,
    acquired_until      DATE,                       -- NULL = current owner
    acquisition_method  VARCHAR(20) NOT NULL
        CHECK (acquisition_method IN ('purchase','gift','bequest','excavation',
                                      'field_collection','loan','transfer','unknown')),
    price_paid          NUMERIC(14,2) CHECK (price_paid IS NULL OR price_paid >= 0),
    currency            CHAR(3)       CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
    source_document     TEXT,

    CONSTRAINT oh_valid_period
        CHECK (acquired_until IS NULL OR acquired_until >= acquired_from),
    CONSTRAINT oh_price_needs_currency
        CHECK (price_paid IS NULL OR currency IS NOT NULL),
    -- An artifact cannot have two owners at the same time.
    -- Exclusion constraint (needs btree_gist): no two rows for the same
    -- artifact may have overlapping date ranges. This also guarantees at
    -- most one "current" (open-ended) owner per artifact.
    CONSTRAINT oh_no_overlapping_ownership
        EXCLUDE USING gist (
            artifact_id WITH =,
            daterange(acquired_from, acquired_until, '[]') WITH &&
        )
);

CREATE INDEX idx_oh_owner ON ownership_history (owner_id);

-- ---------------------------------------------------------------------
-- CONDITION_REPORTS
-- Free-text reports written by curators over decades.
-- condition_grade: 5 = excellent, 4 = good, 3 = fair, 2 = poor, 1 = critical
-- RESTRICT on delete: archival records must never silently disappear.
-- ---------------------------------------------------------------------
CREATE TABLE condition_reports (
    report_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    artifact_id      INT NOT NULL REFERENCES artifacts(artifact_id) ON DELETE RESTRICT,
    curator_id       INT NOT NULL REFERENCES curators(curator_id)   ON DELETE RESTRICT,
    report_date      DATE NOT NULL CHECK (report_date >= DATE '1900-01-01'),
    condition_grade  SMALLINT NOT NULL CHECK (condition_grade BETWEEN 1 AND 5),
    report_text      TEXT NOT NULL CHECK (char_length(btrim(report_text)) >= 30),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT cr_one_per_curator_per_day UNIQUE (artifact_id, curator_id, report_date)
);

-- "All reports of artifact X in date order" is the most common access pattern
CREATE INDEX idx_cr_artifact_date ON condition_reports (artifact_id, report_date);
CREATE INDEX idx_cr_curator       ON condition_reports (curator_id);

-- ---------------------------------------------------------------------
-- REPORT_EMBEDDINGS  (the vector store)
-- One embedding per report. Kept in its own table so we can re-embed
-- with a different model without touching the archival report rows.
-- Model: sentence-transformers/all-MiniLM-L6-v2 -> 384 dimensions.
-- ---------------------------------------------------------------------
CREATE TABLE report_embeddings (
    report_id    INT PRIMARY KEY REFERENCES condition_reports(report_id) ON DELETE CASCADE,
    model_name   VARCHAR(100) NOT NULL DEFAULT 'all-MiniLM-L6-v2',
    embedding    vector(384) NOT NULL,
    embedded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HNSW approximate-nearest-neighbour index using cosine distance (<=>)
CREATE INDEX idx_report_embeddings_hnsw
    ON report_embeddings USING hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------
-- ANOMALY_FLAGS
-- A flag raised on a report, optionally against the report it was
-- compared with (two FKs to the same table).
-- reviewed_by uses RESTRICT (not SET NULL): SET NULL would break the
-- af_review_complete check. Users are deactivated, not deleted.
-- ---------------------------------------------------------------------
CREATE TABLE anomaly_flags (
    flag_id             INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id           INT NOT NULL REFERENCES condition_reports(report_id) ON DELETE CASCADE,
    compared_report_id  INT          REFERENCES condition_reports(report_id) ON DELETE CASCADE,
    flag_type           VARCHAR(30) NOT NULL
        CHECK (flag_type IN ('rapid_degradation','unexplained_improvement',
                             'inconsistent_description','possible_mislabel','possible_forgery')),
    similarity_score    NUMERIC(5,4) CHECK (similarity_score BETWEEN -1 AND 1),
    status              VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','under_review','confirmed','dismissed')),
    raised_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by         INT REFERENCES users(user_id) ON DELETE RESTRICT,
    reviewed_at         TIMESTAMPTZ,
    review_notes        TEXT,

    CONSTRAINT af_not_self_compare
        CHECK (compared_report_id IS NULL OR compared_report_id <> report_id),
    CONSTRAINT af_review_complete
        CHECK (status = 'open' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
    CONSTRAINT af_no_duplicate_flag
        UNIQUE (report_id, compared_report_id, flag_type)
);

-- Partial index: the dashboard only ever lists unresolved flags
CREATE INDEX idx_af_unresolved ON anomaly_flags (status)
    WHERE status IN ('open','under_review');

-- ---------------------------------------------------------------------
-- ALTER demo (requirement #5)
-- Reports from different decades/curators may be in different languages;
-- recording it lets us pick a multilingual embedding model later.
-- ---------------------------------------------------------------------
ALTER TABLE condition_reports
    ADD COLUMN report_language VARCHAR(10) NOT NULL DEFAULT 'en';
