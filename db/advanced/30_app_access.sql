-- =====================================================================
-- 30_app_access.sql  (Owner: Likhith)
-- Database side of the web app's security:
--   * app_sessions table + app_login() / app_session_user() / app_logout()
--   * database roles app_researcher < app_curator < app_admin, with GRANTs
--   * database timezone = Asia/Kolkata
-- The web app runs every request as:
--   BEGIN; SET LOCAL ROLE app_<role>; ... ; COMMIT;
-- so PostgreSQL itself enforces "researchers are read-only".
-- Loaded after 10_ and 20_ because it grants on their views/procedures.
-- =====================================================================

-- Make the file re-runnable
DROP FUNCTION IF EXISTS app_login;
DROP FUNCTION IF EXISTS app_session_user;
DROP FUNCTION IF EXISTS app_logout;
DROP TABLE IF EXISTS app_sessions;

-- ---------------------------------------------------------------------
-- TIMEZONE: the museum is in India. Without this, CURRENT_DATE is UTC
-- inside Docker, and a report dated "today" (IST) is rejected as a
-- future date between 00:00 and 05:30 IST. Applies to new connections.
-- ---------------------------------------------------------------------
DO $$
BEGIN
    EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'Asia/Kolkata');
END $$;

-- ---------------------------------------------------------------------
-- SESSIONS: the browser cookie holds a random token; the database only
-- stores its SHA-256 hash, so the table alone cannot be used to log in.
-- ---------------------------------------------------------------------
CREATE TABLE app_sessions (
    token_hash  BYTEA PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_app_sessions_user ON app_sessions (user_id);

-- Login: password checked with bcrypt inside the database (pgcrypto crypt()).
-- Returns no row for a wrong email/password or an inactive account.
CREATE FUNCTION app_login(p_email TEXT, p_password TEXT)
RETURNS TABLE (token TEXT, user_id INT, full_name VARCHAR, role VARCHAR)
LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE
    v_user  users%ROWTYPE;
    v_token TEXT;
BEGIN
    SELECT u.* INTO v_user
    FROM users u
    WHERE lower(u.email) = lower(btrim(p_email))
      AND u.is_active
      AND u.password_hash = crypt(p_password, u.password_hash);
    IF NOT FOUND THEN
        RETURN;
    END IF;

    DELETE FROM app_sessions s WHERE s.expires_at < now();      -- housekeeping
    v_token := encode(gen_random_bytes(32), 'hex');
    INSERT INTO app_sessions (token_hash, user_id, expires_at)
    VALUES (digest(v_token, 'sha256'), v_user.user_id, now() + INTERVAL '8 hours');

    RETURN QUERY SELECT v_token, v_user.user_id, v_user.full_name, v_user.role;
END;
$$;

-- Who does this token belong to? (no row = not logged in / expired / deactivated)
CREATE FUNCTION app_session_user(p_token TEXT)
RETURNS TABLE (user_id INT, full_name VARCHAR, email VARCHAR, role VARCHAR)
LANGUAGE sql STABLE AS $$
    SELECT u.user_id, u.full_name, u.email, u.role
    FROM app_sessions s
    JOIN users u ON u.user_id = s.user_id
    WHERE s.token_hash = digest(p_token, 'sha256')
      AND s.expires_at > now()
      AND u.is_active;
$$;

CREATE FUNCTION app_logout(p_token TEXT) RETURNS void
LANGUAGE sql AS $$
    DELETE FROM app_sessions WHERE token_hash = digest(p_token, 'sha256');
$$;

-- Only the server connection (table owner) may use the auth functions
REVOKE EXECUTE ON FUNCTION app_login(TEXT, TEXT), app_session_user(TEXT), app_logout(TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------
-- DATABASE ROLES (cluster-wide, so create only if missing)
-- app_admin inherits app_curator, which inherits app_researcher.
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_researcher') THEN
        CREATE ROLE app_researcher NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_curator') THEN
        CREATE ROLE app_curator NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin') THEN
        CREATE ROLE app_admin NOLOGIN;
    END IF;
END $$;

GRANT app_researcher TO app_curator;
GRANT app_curator    TO app_admin;

GRANT USAGE ON SCHEMA public TO app_researcher;

-- RESEARCHER: read-only. Can read users but NOT their password hashes.
GRANT SELECT ON artifacts, owners, curators, ownership_history,
                condition_reports, report_embeddings, anomaly_flags TO app_researcher;
GRANT SELECT (user_id, full_name, email, role, is_active, created_at) ON users TO app_researcher;
GRANT SELECT ON v_current_owner, v_provenance_summary, v_latest_condition, v_open_flags TO app_researcher;

-- CURATOR: catalogue, provenance, condition reports, embeddings, flags.
-- (Triggers run with the caller's privileges, so curators need INSERT on
--  anomaly_flags for the auto-flagging triggers to work.)
GRANT INSERT, UPDATE ON artifacts, owners, ownership_history TO app_curator;
GRANT INSERT         ON condition_reports, report_embeddings TO app_curator;
GRANT INSERT, UPDATE ON anomaly_flags TO app_curator;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_curator;

-- Procedures are executable by PUBLIC by default; restrict them to curators+
REVOKE EXECUTE ON PROCEDURE transfer_ownership(VARCHAR, INT, DATE, VARCHAR, NUMERIC, CHAR, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON PROCEDURE review_flag(INT, INT, VARCHAR, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON PROCEDURE transfer_ownership(VARCHAR, INT, DATE, VARCHAR, NUMERIC, CHAR, TEXT) TO app_curator;
GRANT  EXECUTE ON PROCEDURE review_flag(INT, INT, VARCHAR, TEXT) TO app_curator;

-- ADMIN: user accounts, curator profiles, deleting (fresh) artifacts.
GRANT SELECT, INSERT, UPDATE ON users    TO app_admin;
GRANT INSERT, UPDATE         ON curators TO app_admin;
GRANT DELETE                 ON artifacts TO app_admin;
