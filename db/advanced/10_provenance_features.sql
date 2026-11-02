-- =====================================================================
-- 10_provenance_features.sql  (Owner: Likhith)
-- Advanced features for artifacts, owners and provenance:
--   views:      v_current_owner, v_provenance_summary
--   function:   artifact_gaps(accession, min_days)
--   procedure:  transfer_ownership(...)   -- transaction
--   triggers:   curator account must be a 'curator' user;
--               artifacts are never hard-deleted (deaccession instead)
--   index:      partial index for current owners
-- Loaded AFTER seed data (see reset_db.sh).
-- =====================================================================

-- Make the file re-runnable
DROP VIEW IF EXISTS v_provenance_summary;
DROP VIEW IF EXISTS v_current_owner;
DROP FUNCTION IF EXISTS artifact_gaps;
DROP PROCEDURE IF EXISTS transfer_ownership;
DROP FUNCTION IF EXISTS trg_curator_account_role CASCADE;
DROP FUNCTION IF EXISTS trg_user_role_change CASCADE;
DROP FUNCTION IF EXISTS trg_block_artifact_delete CASCADE;

-- ---------------------------------------------------------------------
-- INDEX: partial index on the "current owner" rows
-- Every catalogue screen asks "who holds this now?" -> acquired_until IS NULL.
-- A partial index only stores those rows: small and fast.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_oh_current_owner
    ON ownership_history (artifact_id)
    WHERE acquired_until IS NULL;

-- ---------------------------------------------------------------------
-- VIEW 1: current holder of every artifact
-- LEFT JOIN keeps artifacts with no provenance record (owner columns NULL).
-- ---------------------------------------------------------------------
CREATE VIEW v_current_owner AS
SELECT a.artifact_id, a.accession_number, a.title, a.category, a.status,
       o.owner_id, o.owner_name, o.owner_type,
       oh.acquired_from AS held_since, oh.acquisition_method
FROM artifacts a
LEFT JOIN ownership_history oh
       ON oh.artifact_id = a.artifact_id AND oh.acquired_until IS NULL
LEFT JOIN owners o ON o.owner_id = oh.owner_id;

-- ---------------------------------------------------------------------
-- VIEW 2: provenance risk summary per artifact
-- Combines: number of owners, gaps > 1 year, unknown acquisitions, and
-- dealer/auction-house ownership during 1933-1945, into one risk level.
-- ---------------------------------------------------------------------
CREATE VIEW v_provenance_summary AS
WITH chain AS (
    SELECT oh.ownership_id, oh.artifact_id, oh.acquired_from, oh.acquired_until,
           oh.acquisition_method, o.owner_type,
           LAG(oh.acquired_until) OVER (PARTITION BY oh.artifact_id
                                        ORDER BY oh.acquired_from) AS prev_until
    FROM ownership_history oh
    JOIN owners o ON o.owner_id = oh.owner_id
),
agg AS (
    SELECT a.artifact_id, a.accession_number, a.title,
           COUNT(c.ownership_id)                                          AS n_owners,
           MIN(c.acquired_from)                                           AS earliest_record,
           COUNT(*) FILTER (WHERE c.acquired_from - c.prev_until > 365)   AS n_gaps,
           COALESCE(MAX(c.acquired_from - c.prev_until), 0)               AS longest_gap_days,
           COUNT(*) FILTER (WHERE c.acquisition_method = 'unknown')       AS n_unknown_acquisitions,
           COALESCE(BOOL_OR(c.owner_type IN ('dealer','auction_house')
                    AND daterange(c.acquired_from, c.acquired_until, '[]')
                        && daterange('1933-01-01', '1945-12-31', '[]')), FALSE) AS wartime_dealer
    FROM artifacts a
    LEFT JOIN chain c ON c.artifact_id = a.artifact_id
    GROUP BY a.artifact_id, a.accession_number, a.title
)
SELECT agg.*,
       CASE
           WHEN n_owners = 0                    THEN 'no_provenance'
           WHEN n_gaps > 0 OR wartime_dealer    THEN 'high'
           WHEN n_unknown_acquisitions > 0      THEN 'medium'
           ELSE 'low'
       END AS provenance_risk
FROM agg;

-- ---------------------------------------------------------------------
-- FUNCTION: list the provenance gaps of one artifact
-- Set-returning SQL function, used by the artifact detail page.
-- ---------------------------------------------------------------------
CREATE FUNCTION artifact_gaps(p_accession VARCHAR, p_min_days INT DEFAULT 365)
RETURNS TABLE (previous_owner VARCHAR, next_owner VARCHAR,
               gap_from DATE, gap_to DATE, gap_days INT)
LANGUAGE sql STABLE AS $$
    WITH chain AS (
        SELECT o.owner_name, oh.acquired_from,
               LAG(oh.acquired_until) OVER w AS prev_until,
               LAG(o.owner_name)      OVER w AS prev_owner
        FROM ownership_history oh
        JOIN owners o    ON o.owner_id    = oh.owner_id
        JOIN artifacts a ON a.artifact_id = oh.artifact_id
        WHERE a.accession_number = p_accession
        WINDOW w AS (ORDER BY oh.acquired_from)
    )
    SELECT prev_owner, owner_name,
           prev_until + 1, acquired_from - 1,
           acquired_from - prev_until - 1
    FROM chain
    WHERE prev_until IS NOT NULL
      AND acquired_from - prev_until > p_min_days
    ORDER BY prev_until;
$$;

-- ---------------------------------------------------------------------
-- PROCEDURE: transfer ownership atomically (TRANSACTION)
-- Closes the current ownership row and opens a new one. Both steps
-- succeed together or neither happens: if the INSERT fails (bad method,
-- overlap, bad owner), the UPDATE is rolled back too.
-- Row locks (FOR UPDATE) stop two simultaneous transfers of one artifact.
-- ---------------------------------------------------------------------
CREATE PROCEDURE transfer_ownership(
    p_accession     VARCHAR,
    p_new_owner_id  INT,
    p_transfer_date DATE,
    p_method        VARCHAR,
    p_price         NUMERIC DEFAULT NULL,
    p_currency      CHAR(3) DEFAULT NULL,
    p_document      TEXT    DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_artifact_id  INT;
    v_current      ownership_history%ROWTYPE;
BEGIN
    SELECT artifact_id INTO v_artifact_id
    FROM artifacts WHERE accession_number = p_accession
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Artifact % does not exist', p_accession;
    END IF;

    SELECT * INTO v_current
    FROM ownership_history
    WHERE artifact_id = v_artifact_id AND acquired_until IS NULL
    FOR UPDATE;

    IF FOUND THEN
        IF v_current.owner_id = p_new_owner_id THEN
            RAISE EXCEPTION 'Owner % already holds %', p_new_owner_id, p_accession;
        END IF;
        IF p_transfer_date <= v_current.acquired_from THEN
            RAISE EXCEPTION 'Transfer date % must be after the current ownership began (%)',
                p_transfer_date, v_current.acquired_from;
        END IF;
        UPDATE ownership_history
        SET acquired_until = p_transfer_date - 1
        WHERE ownership_id = v_current.ownership_id;
    END IF;

    INSERT INTO ownership_history
        (artifact_id, owner_id, acquired_from, acquisition_method, price_paid, currency, source_document)
    VALUES
        (v_artifact_id, p_new_owner_id, p_transfer_date, p_method, p_price, p_currency, p_document);
END;
$$;

-- ---------------------------------------------------------------------
-- TRIGGER 1: a curator profile can only be linked to a user whose role
-- is 'curator' (a cross-table rule a CHECK constraint cannot express).
-- ---------------------------------------------------------------------
CREATE FUNCTION trg_curator_account_role() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.user_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM users WHERE user_id = NEW.user_id AND role = 'curator'
    ) THEN
        RAISE EXCEPTION 'User % must have role ''curator'' to be linked to a curator profile', NEW.user_id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER curator_account_role
    BEFORE INSERT OR UPDATE OF user_id ON curators
    FOR EACH ROW EXECUTE FUNCTION trg_curator_account_role();

-- ...and the reverse direction: a linked user cannot stop being a curator.
CREATE FUNCTION trg_user_role_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.role = 'curator' AND NEW.role <> 'curator'
       AND EXISTS (SELECT 1 FROM curators WHERE user_id = NEW.user_id) THEN
        RAISE EXCEPTION 'User % is linked to a curator profile; unlink it before changing the role', NEW.user_id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER user_role_change
    BEFORE UPDATE OF role ON users
    FOR EACH ROW EXECUTE FUNCTION trg_user_role_change();

-- ---------------------------------------------------------------------
-- TRIGGER 2: archival records are never hard-deleted.
-- Only a fresh data-entry mistake (created < 1 day ago, no provenance,
-- no condition reports) may be deleted. Everything else is retired with
-- status = 'deaccessioned'.
-- ---------------------------------------------------------------------
CREATE FUNCTION trg_block_artifact_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.created_at < now() - INTERVAL '1 day'
       OR EXISTS (SELECT 1 FROM ownership_history WHERE artifact_id = OLD.artifact_id)
       OR EXISTS (SELECT 1 FROM condition_reports WHERE artifact_id = OLD.artifact_id) THEN
        RAISE EXCEPTION 'Artifact % is an archival record and cannot be deleted; set status = ''deaccessioned'' instead',
            OLD.accession_number
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER block_artifact_delete
    BEFORE DELETE ON artifacts
    FOR EACH ROW EXECUTE FUNCTION trg_block_artifact_delete();
