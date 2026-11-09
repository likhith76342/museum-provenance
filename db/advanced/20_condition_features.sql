-- =====================================================================
-- 20_condition_features.sql  (Owner: Monish)
-- Advanced features for condition reports and anomaly flags:
--   full-text:  report_tsv generated column + GIN index, search_reports()
--   views:      v_latest_condition (LATERAL), v_open_flags
--   function:   find_similar_reports()   (vector k-NN)
--   procedure:  review_flag()            (role check + status rules)
--   triggers:   report date within curator's active period
--               grade change of 2+ -> auto flag
--               new embedding -> auto flag inconsistent / mislabelled reports
-- Loaded AFTER seed data and embeddings (see reset_db.sh).
-- =====================================================================

-- Make the file re-runnable
DROP VIEW IF EXISTS v_open_flags;
DROP VIEW IF EXISTS v_latest_condition;
DROP FUNCTION IF EXISTS search_reports;
DROP FUNCTION IF EXISTS find_similar_reports;
DROP PROCEDURE IF EXISTS review_flag;
DROP FUNCTION IF EXISTS trg_report_date_valid CASCADE;
DROP FUNCTION IF EXISTS trg_grade_change_flag CASCADE;
DROP FUNCTION IF EXISTS trg_embedding_anomalies CASCADE;

-- ---------------------------------------------------------------------
-- FULL-TEXT SEARCH
-- Generated column: Postgres keeps the tsvector in sync with report_text
-- automatically. GIN index makes @@ searches fast.
-- ---------------------------------------------------------------------
ALTER TABLE condition_reports
    ADD COLUMN IF NOT EXISTS report_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', report_text)) STORED;

CREATE INDEX IF NOT EXISTS idx_cr_report_tsv
    ON condition_reports USING gin (report_tsv);

-- Keyword search with ranking and highlighted snippets.
-- websearch_to_tsquery accepts Google-style input: "bronze disease", -patina, "exact phrase"
CREATE FUNCTION search_reports(p_query TEXT, p_limit INT DEFAULT 10)
RETURNS TABLE (report_id INT, accession_number VARCHAR, report_date DATE,
               rank REAL, snippet TEXT)
LANGUAGE sql STABLE AS $$
    SELECT cr.report_id, a.accession_number, cr.report_date,
           ts_rank(cr.report_tsv, q) AS rank,
           ts_headline('english', cr.report_text, q, 'MaxWords=18, MinWords=6')
    FROM condition_reports cr
    JOIN artifacts a ON a.artifact_id = cr.artifact_id,
         websearch_to_tsquery('english', p_query) q
    WHERE cr.report_tsv @@ q
    ORDER BY rank DESC, cr.report_date DESC
    LIMIT p_limit;
$$;

-- ---------------------------------------------------------------------
-- VIEW 1: latest condition of EVERY artifact, incl. never-inspected ones
-- LEFT JOIN LATERAL runs the "latest report" subquery once per artifact.
-- Overdue = last inspection more than 5 years ago.
-- ---------------------------------------------------------------------
CREATE VIEW v_latest_condition AS
SELECT a.artifact_id, a.accession_number, a.title, a.status,
       lc.report_id, lc.report_date AS last_inspected,
       lc.condition_grade, lc.curator_name,
       CASE
           WHEN lc.report_id IS NULL                              THEN 'never_inspected'
           WHEN lc.report_date < CURRENT_DATE - INTERVAL '5 years' THEN 'overdue'
           ELSE 'ok'
       END AS inspection_status
FROM artifacts a
LEFT JOIN LATERAL (
    SELECT cr.report_id, cr.report_date, cr.condition_grade, c.full_name AS curator_name
    FROM condition_reports cr
    JOIN curators c ON c.curator_id = cr.curator_id
    WHERE cr.artifact_id = a.artifact_id
    ORDER BY cr.report_date DESC
    LIMIT 1
) lc ON TRUE;

-- ---------------------------------------------------------------------
-- VIEW 2: unresolved flags with both reports side by side (dashboard feed)
-- ---------------------------------------------------------------------
CREATE VIEW v_open_flags AS
SELECT f.flag_id, f.flag_type, f.status, f.similarity_score, f.raised_at,
       a.accession_number, a.title,
       r.report_id,            r.report_date,  LEFT(r.report_text, 90)  AS report_excerpt,
       rc.report_id AS compared_report_id,
       rc.report_date AS compared_report_date, LEFT(rc.report_text, 90) AS compared_excerpt,
       u.full_name AS reviewer
FROM anomaly_flags f
JOIN condition_reports r       ON r.report_id   = f.report_id
JOIN artifacts a               ON a.artifact_id = r.artifact_id
LEFT JOIN condition_reports rc ON rc.report_id  = f.compared_report_id
LEFT JOIN users u              ON u.user_id     = f.reviewed_by
WHERE f.status IN ('open', 'under_review');

-- ---------------------------------------------------------------------
-- FUNCTION: k most similar reports to a given report (vector k-NN)
-- Used by the "similar reports" panel in the app.
-- ---------------------------------------------------------------------
CREATE FUNCTION find_similar_reports(p_report_id INT, p_k INT DEFAULT 5)
RETURNS TABLE (report_id INT, accession_number VARCHAR, report_date DATE,
               condition_grade SMALLINT, same_artifact BOOLEAN, similarity NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT cr.report_id, a.accession_number, cr.report_date, cr.condition_grade,
           cr.artifact_id = q.artifact_id,
           ROUND((1 - (e.embedding <=> q.embedding))::numeric, 4)
    FROM (SELECT e0.embedding, c0.artifact_id
          FROM report_embeddings e0
          JOIN condition_reports c0 ON c0.report_id = e0.report_id
          WHERE e0.report_id = p_report_id) q
    CROSS JOIN report_embeddings e
    JOIN condition_reports cr ON cr.report_id   = e.report_id
    JOIN artifacts a          ON a.artifact_id  = cr.artifact_id
    WHERE e.report_id <> p_report_id
    ORDER BY e.embedding <=> q.embedding
    LIMIT p_k;
$$;

-- ---------------------------------------------------------------------
-- PROCEDURE: review an anomaly flag
-- Rules enforced in the database (not just the UI):
--   * only active admins/curators may review (researchers are read-only)
--   * confirmed/dismissed are final
--   * confirming or dismissing requires notes
-- ---------------------------------------------------------------------
CREATE PROCEDURE review_flag(p_flag_id INT, p_user_id INT,
                             p_new_status VARCHAR, p_notes TEXT DEFAULT NULL)
LANGUAGE plpgsql AS $$
DECLARE
    v_role    VARCHAR;
    v_active  BOOLEAN;
    v_status  VARCHAR;
BEGIN
    SELECT role, is_active INTO v_role, v_active FROM users WHERE user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User % does not exist', p_user_id;
    END IF;
    IF v_role NOT IN ('admin', 'curator') OR NOT v_active THEN
        RAISE EXCEPTION 'User % (role %) is not allowed to review flags', p_user_id, v_role
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT status INTO v_status FROM anomaly_flags WHERE flag_id = p_flag_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Flag % does not exist', p_flag_id;
    END IF;
    IF v_status IN ('confirmed', 'dismissed') THEN
        RAISE EXCEPTION 'Flag % is already % and cannot be changed', p_flag_id, v_status;
    END IF;
    IF p_new_status NOT IN ('under_review', 'confirmed', 'dismissed') THEN
        RAISE EXCEPTION 'Invalid review status %', p_new_status;
    END IF;
    IF p_new_status IN ('confirmed', 'dismissed') AND COALESCE(btrim(p_notes), '') = '' THEN
        RAISE EXCEPTION 'Review notes are required to mark a flag %', p_new_status;
    END IF;

    UPDATE anomaly_flags
    SET status       = p_new_status,
        reviewed_by  = p_user_id,
        reviewed_at  = now(),
        review_notes = COALESCE(p_notes, review_notes)
    WHERE flag_id = p_flag_id;
END;
$$;

-- ---------------------------------------------------------------------
-- TRIGGER 1: report date must be valid
--   * not in the future
--   * within the writing curator's active period
-- ---------------------------------------------------------------------
CREATE FUNCTION trg_report_date_valid() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_from  DATE;
    v_until DATE;
    v_name  TEXT;
BEGIN
    IF NEW.report_date > CURRENT_DATE THEN
        RAISE EXCEPTION 'Report date % is in the future', NEW.report_date
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT active_from, active_until, full_name INTO v_from, v_until, v_name
    FROM curators WHERE curator_id = NEW.curator_id;

    IF NEW.report_date < v_from OR (v_until IS NOT NULL AND NEW.report_date > v_until) THEN
        RAISE EXCEPTION 'Curator % was not active on % (active % to %)',
            v_name, NEW.report_date, v_from, COALESCE(v_until::text, 'present')
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER report_date_valid
    BEFORE INSERT OR UPDATE OF report_date, curator_id ON condition_reports
    FOR EACH ROW EXECUTE FUNCTION trg_report_date_valid();

-- ---------------------------------------------------------------------
-- TRIGGER 2: grade-based anomaly detection
-- Compares a new report with the previous report of the same artifact:
--   drop of 2+ grades     -> rapid_degradation
--   improvement of 2+     -> unexplained_improvement (possible substitution)
-- ---------------------------------------------------------------------
CREATE FUNCTION trg_grade_change_flag() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_prev_id    INT;
    v_prev_grade SMALLINT;
BEGIN
    SELECT report_id, condition_grade INTO v_prev_id, v_prev_grade
    FROM condition_reports
    WHERE artifact_id = NEW.artifact_id
      AND report_date < NEW.report_date
      AND report_id <> NEW.report_id
    ORDER BY report_date DESC
    LIMIT 1;

    IF v_prev_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF v_prev_grade - NEW.condition_grade >= 2 THEN
        INSERT INTO anomaly_flags (report_id, compared_report_id, flag_type)
        VALUES (NEW.report_id, v_prev_id, 'rapid_degradation')
        ON CONFLICT DO NOTHING;
    ELSIF NEW.condition_grade - v_prev_grade >= 2 THEN
        INSERT INTO anomaly_flags (report_id, compared_report_id, flag_type)
        VALUES (NEW.report_id, v_prev_id, 'unexplained_improvement')
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER grade_change_flag
    AFTER INSERT ON condition_reports
    FOR EACH ROW EXECUTE FUNCTION trg_grade_change_flag();

-- ---------------------------------------------------------------------
-- TRIGGER 3: embedding-based anomaly detection (the core of the project)
-- Fires when a report's embedding is stored:
--   * similarity to the SAME artifact's previous report < 0.50
--       -> inconsistent_description  (possible forgery/substitution)
--   * similarity to ANY OTHER artifact's report > 0.85
--       -> possible_mislabel         (filed under the wrong accession)
-- Thresholds chosen from the Phase 1 measurements: the lowest legitimate
-- same-artifact pair is well above 0.5 except the planted forgery (0.38);
-- the highest unrelated cross-artifact pair is 0.76, the planted mislabel 0.93.
-- ---------------------------------------------------------------------
CREATE FUNCTION trg_embedding_anomalies() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    c_inconsistent CONSTANT NUMERIC := 0.50;
    c_mislabel     CONSTANT NUMERIC := 0.85;
    v_artifact   INT;
    v_date       DATE;
    v_prev_id    INT;
    v_prev_sim   NUMERIC;
    v_match_id   INT;
    v_match_sim  NUMERIC;
BEGIN
    SELECT artifact_id, report_date INTO v_artifact, v_date
    FROM condition_reports WHERE report_id = NEW.report_id;

    -- previous report of the same artifact (that has an embedding)
    SELECT cr.report_id, 1 - (e.embedding <=> NEW.embedding)
      INTO v_prev_id, v_prev_sim
    FROM condition_reports cr
    JOIN report_embeddings e ON e.report_id = cr.report_id
    WHERE cr.artifact_id = v_artifact
      AND cr.report_date < v_date
    ORDER BY cr.report_date DESC
    LIMIT 1;

    IF v_prev_id IS NOT NULL AND v_prev_sim < c_inconsistent THEN
        INSERT INTO anomaly_flags (report_id, compared_report_id, flag_type, similarity_score)
        VALUES (NEW.report_id, v_prev_id, 'inconsistent_description', ROUND(v_prev_sim, 4))
        ON CONFLICT DO NOTHING;
    END IF;

    -- most similar report belonging to a DIFFERENT artifact
    SELECT cr.report_id, 1 - (e.embedding <=> NEW.embedding)
      INTO v_match_id, v_match_sim
    FROM report_embeddings e
    JOIN condition_reports cr ON cr.report_id = e.report_id
    WHERE cr.artifact_id <> v_artifact
    ORDER BY e.embedding <=> NEW.embedding
    LIMIT 1;

    IF v_match_id IS NOT NULL AND v_match_sim > c_mislabel THEN
        INSERT INTO anomaly_flags (report_id, compared_report_id, flag_type, similarity_score)
        VALUES (NEW.report_id, v_match_id, 'possible_mislabel', ROUND(v_match_sim, 4))
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER embedding_anomalies
    AFTER INSERT ON report_embeddings
    FOR EACH ROW EXECUTE FUNCTION trg_embedding_anomalies();
