-- =====================================================================
-- 01_core_tables.sql  (Owner: Likhith)
-- Tables: users, curators, owners, artifacts
-- =====================================================================

-- USERS: application accounts (role-based access)
CREATE TABLE users (
    user_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name      VARCHAR(100) NOT NULL,
    email          VARCHAR(255) NOT NULL,
    password_hash  TEXT NOT NULL,
    role           VARCHAR(20) NOT NULL CHECK (role IN ('admin','curator','researcher')),
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT users_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    -- DB-level guarantee that passwords are never stored in plain text: must be a bcrypt hash
    CONSTRAINT users_password_is_bcrypt CHECK (password_hash ~ '^\$2[aby]\$[0-9]{2}\$.{53}$')
);
-- case-insensitive uniqueness of email
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));

-- CURATORS: everyone who has ever written a condition report.
-- Separate from users: historical curators (1960s-2000s) never log in.
-- Optional 1:1 link to an account via user_id (UNIQUE + NULLABLE).
CREATE TABLE curators (
    curator_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         INT UNIQUE REFERENCES users(user_id) ON DELETE SET NULL,
    full_name       VARCHAR(100) NOT NULL,
    specialization  VARCHAR(100) NOT NULL,
    institution     VARCHAR(150),
    active_from     DATE NOT NULL,
    active_until    DATE,
    CONSTRAINT curators_active_period CHECK (active_until IS NULL OR active_until >= active_from)
);

-- OWNERS: individuals/institutions/dealers that have held artifacts
CREATE TABLE owners (
    owner_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_name    VARCHAR(150) NOT NULL,
    owner_type    VARCHAR(20) NOT NULL
        CHECK (owner_type IN ('individual','institution','dealer','auction_house','government','unknown')),
    country       VARCHAR(80),
    contact_info  TEXT,
    notes         TEXT
);
CREATE INDEX idx_owners_type ON owners (owner_type);

-- ARTIFACTS: catalogue of objects
CREATE TABLE artifacts (
    artifact_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    accession_number  VARCHAR(20) NOT NULL UNIQUE
        CHECK (accession_number ~ '^[A-Z]{2,5}-[0-9]{4}-[0-9]{4}$'),   -- e.g. CHM-1971-0002
    title             VARCHAR(200) NOT NULL,
    category          VARCHAR(30) NOT NULL
        CHECK (category IN ('painting','sculpture','manuscript','textile','ceramic',
                            'metalwork','photograph','document','other')),
    material          VARCHAR(150),
    origin_culture    VARCHAR(100),
    est_year_from     INT,            -- negative = BCE
    est_year_to       INT,
    acquisition_date  DATE,
    current_location  VARCHAR(100),
    status            VARCHAR(25) NOT NULL DEFAULT 'in_storage'
        CHECK (status IN ('on_display','in_storage','on_loan','under_conservation','deaccessioned')),
    description       TEXT,
    created_by        INT REFERENCES users(user_id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT artifacts_dating_range
        CHECK (est_year_from IS NULL OR est_year_to IS NULL OR est_year_to >= est_year_from)
);
-- common filter combination in the catalogue screen
CREATE INDEX idx_artifacts_category_status ON artifacts (category, status);

-- ALTER demos (requirement #5)
ALTER TABLE owners
    ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT FALSE;   -- provenance researchers verify owner identity

ALTER TABLE artifacts
    ADD CONSTRAINT artifacts_acquired_after_creation
    CHECK (acquisition_date IS NULL OR est_year_from IS NULL
           OR EXTRACT(YEAR FROM acquisition_date) >= est_year_from);
