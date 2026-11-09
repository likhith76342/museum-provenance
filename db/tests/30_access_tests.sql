-- =====================================================================
-- 30_access_tests.sql  (Owner: Likhith)
-- Sessions, login and database-role permissions.
-- Runs inside a transaction that is ROLLED BACK: demo data never changes.
-- =====================================================================
BEGIN;

-- T1: login (case-insensitive email) -> token -> session resolves to the user
DO $$
DECLARE v_token TEXT; v_role TEXT; v_name TEXT;
BEGIN
    SELECT token, role INTO v_token, v_role FROM app_login('MEERA.IYER@museum.test', 'Curator@123');
    IF v_token IS NULL OR v_role <> 'curator' THEN
        RAISE EXCEPTION 'FAIL T1: login returned token %, role %', v_token, v_role;
    END IF;
    SELECT full_name INTO v_name FROM app_session_user(v_token);
    IF v_name IS DISTINCT FROM 'Meera Iyer' THEN
        RAISE EXCEPTION 'FAIL T1: session resolved to %', v_name;
    END IF;
    RAISE NOTICE 'PASS T1: login with upper-case email -> session for % (%)', v_name, v_role;
END $$;

-- T2: wrong password -> no session
DO $$
DECLARE n INT;
BEGIN
    SELECT COUNT(*) INTO n FROM app_login('meera.iyer@museum.test', 'wrong-password');
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL T2: wrong password logged in'; END IF;
    RAISE NOTICE 'PASS T2: wrong password -> no session';
END $$;

-- T3: expired session is rejected; only the hash of the token is stored
DO $$
DECLARE v_token TEXT; n INT;
BEGIN
    SELECT token INTO v_token FROM app_login('admin@museum.test', 'Admin@123');
    IF EXISTS (SELECT 1 FROM app_sessions WHERE encode(token_hash, 'hex') = v_token) THEN
        RAISE EXCEPTION 'FAIL T3: raw token stored';
    END IF;
    UPDATE app_sessions SET expires_at = now() - INTERVAL '1 minute'
     WHERE token_hash = digest(v_token, 'sha256');
    SELECT COUNT(*) INTO n FROM app_session_user(v_token);
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL T3: expired session still valid'; END IF;
    RAISE NOTICE 'PASS T3: only SHA-256 of the token is stored; expired session rejected';
END $$;

-- T4: deactivating a user kills their session and blocks new logins
DO $$
DECLARE v_token TEXT; n INT;
BEGIN
    SELECT token INTO v_token FROM app_login('arjun.das@uni.test', 'Research@123');
    UPDATE users SET is_active = FALSE WHERE user_id = 5;
    SELECT COUNT(*) INTO n FROM app_session_user(v_token);
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL T4: deactivated user session still valid'; END IF;
    SELECT COUNT(*) INTO n FROM app_login('arjun.das@uni.test', 'Research@123');
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL T4: deactivated user could log in'; END IF;
    RAISE NOTICE 'PASS T4: deactivated user -> existing session revoked, new login refused';
END $$;

-- T5: researcher can read tables, views and functions
DO $$
DECLARE n_art INT; n_sim INT; n_flags INT;
BEGIN
    SET LOCAL ROLE app_researcher;
    SELECT COUNT(*) INTO n_art   FROM v_provenance_summary;
    SELECT COUNT(*) INTO n_flags FROM v_open_flags;
    SELECT COUNT(*) INTO n_sim   FROM find_similar_reports(22, 3);
    RESET ROLE;
    IF (n_art, n_flags, n_sim) <> (10, 2, 3) THEN
        RAISE EXCEPTION 'FAIL T5: % artifacts, % open flags, % similar', n_art, n_flags, n_sim;
    END IF;
    RAISE NOTICE 'PASS T5: researcher reads views and vector search (10 artifacts, 2 open flags, 3 similar)';
END $$;

-- T6: researcher cannot write
DO $$
BEGIN
    SET LOCAL ROLE app_researcher;
    BEGIN
        UPDATE artifacts SET status = 'on_display' WHERE artifact_id = 4;
        RAISE EXCEPTION 'FAIL T6: researcher could update an artifact';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'PASS T6: researcher UPDATE rejected by the database -> %', SQLERRM;
    END;
    RESET ROLE;
END $$;

-- T7: researcher cannot read password hashes (column-level privilege)
DO $$
DECLARE v_name TEXT;
BEGIN
    SET LOCAL ROLE app_researcher;
    SELECT full_name INTO v_name FROM users WHERE user_id = 1;   -- allowed
    BEGIN
        PERFORM password_hash FROM users WHERE user_id = 1;
        RAISE EXCEPTION 'FAIL T7: researcher read password_hash';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'PASS T7: researcher reads names (%) but not password_hash -> %', v_name, SQLERRM;
    END;
    RESET ROLE;
END $$;

-- T8: researcher cannot call review_flag (EXECUTE revoked from PUBLIC)
DO $$
BEGIN
    SET LOCAL ROLE app_researcher;
    BEGIN
        CALL review_flag(2, 4, 'under_review');
        RAISE EXCEPTION 'FAIL T8: researcher could call review_flag';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'PASS T8: researcher CALL review_flag rejected -> %', SQLERRM;
    END;
    RESET ROLE;
END $$;

-- T9: curator files a report + embedding; the anomaly triggers can still
-- insert flags under the curator's privileges.
DO $$
DECLARE v_id INT; n INT; v_mislabel BOOLEAN;
BEGIN
    SET LOCAL ROLE app_curator;
    INSERT INTO condition_reports (artifact_id, curator_id, report_date, condition_grade, report_text)
    VALUES (8, 5, CURRENT_DATE, 4,
            'Oil on lined canvas portrait, signed lower right. Varnish yellowing and fine craquelure.')
    RETURNING report_id INTO v_id;
    INSERT INTO report_embeddings (report_id, embedding)
    SELECT v_id, embedding FROM report_embeddings WHERE report_id = 1;
    SELECT COUNT(*), BOOL_OR(flag_type = 'possible_mislabel')
      INTO n, v_mislabel FROM anomaly_flags WHERE report_id = v_id;
    RESET ROLE;
    IF NOT COALESCE(v_mislabel, FALSE) THEN
        RAISE EXCEPTION 'FAIL T9: no possible_mislabel flag (% flags)', n;
    END IF;
    RAISE NOTICE 'PASS T9: curator filed report % and triggers raised % flag(s) incl. possible_mislabel', v_id, n;
END $$;

-- T10: curator can transfer ownership (procedure EXECUTE granted)
DO $$
DECLARE v_owner TEXT;
BEGIN
    SET LOCAL ROLE app_curator;
    CALL transfer_ownership('CHM-2012-0010', 7, DATE '2026-01-15', 'purchase', 50000, 'INR', 'Role test');
    SELECT owner_name INTO v_owner FROM v_current_owner WHERE accession_number = 'CHM-2012-0010';
    RESET ROLE;
    IF v_owner <> 'Elena Vogt' THEN RAISE EXCEPTION 'FAIL T10: owner %', v_owner; END IF;
    RAISE NOTICE 'PASS T10: curator transferred CHM-2012-0010 to %', v_owner;
END $$;

-- T11: curator cannot delete artifacts, not even a fresh one
DO $$
BEGIN
    SET LOCAL ROLE app_curator;
    INSERT INTO artifacts (accession_number, title, category) VALUES ('CHM-2026-0098', 'Role test', 'other');
    BEGIN
        DELETE FROM artifacts WHERE accession_number = 'CHM-2026-0098';
        RAISE EXCEPTION 'FAIL T11: curator could delete an artifact';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'PASS T11: curator DELETE rejected -> %', SQLERRM;
    END;
    RESET ROLE;
END $$;

-- T12: curator cannot create user accounts
DO $$
BEGIN
    SET LOCAL ROLE app_curator;
    BEGIN
        INSERT INTO users (full_name, email, password_hash, role)
        VALUES ('Sneaky', 'sneaky@museum.test', crypt('x', gen_salt('bf')), 'admin');
        RAISE EXCEPTION 'FAIL T12: curator created a user';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'PASS T12: curator INSERT into users rejected -> %', SQLERRM;
    END;
    RESET ROLE;
END $$;

-- T13: admin creates a user who can then log in; admin can delete a fresh artifact
DO $$
DECLARE v_id INT; n INT;
BEGIN
    SET LOCAL ROLE app_admin;
    INSERT INTO users (full_name, email, password_hash, role)
    VALUES ('New Researcher', 'new.researcher@uni.test', crypt('Welcome@123', gen_salt('bf')), 'researcher')
    RETURNING user_id INTO v_id;
    INSERT INTO artifacts (accession_number, title, category) VALUES ('CHM-2026-0097', 'Admin delete test', 'other');
    DELETE FROM artifacts WHERE accession_number = 'CHM-2026-0097';
    RESET ROLE;
    SELECT COUNT(*) INTO n FROM app_login('new.researcher@uni.test', 'Welcome@123');
    IF n <> 1 THEN RAISE EXCEPTION 'FAIL T13: new user % could not log in', v_id; END IF;
    RAISE NOTICE 'PASS T13: admin created user % (can log in) and deleted a fresh artifact', v_id;
END $$;

-- T14: database timezone
DO $$
BEGIN
    IF current_setting('TimeZone') <> 'Asia/Kolkata' THEN
        RAISE EXCEPTION 'FAIL T14: timezone is %', current_setting('TimeZone');
    END IF;
    RAISE NOTICE 'PASS T14: database timezone is Asia/Kolkata';
END $$;

ROLLBACK;
