-- =====================================================================
-- 10_provenance_tests.sql  (Owner: Likhith)
-- Runs inside a transaction that is ROLLED BACK: demo data never changes.
-- Every test prints "PASS ..." or stops the run with "FAIL ...".
-- Run: ./scripts/run_tests.sh   (or ./scripts/psql.sh < db/tests/10_provenance_tests.sql)
-- =====================================================================
BEGIN;

-- helper: run a statement that MUST be rejected
CREATE FUNCTION pg_temp.expect_error(p_sql TEXT, p_label TEXT) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'PASS %: rejected -> %', p_label, SQLERRM;
        RETURN;
    END;
    RAISE EXCEPTION 'FAIL %: statement was accepted: %', p_label, p_sql;
END;
$$;

-- T1: v_current_owner
DO $$
DECLARE n_total INT; n_museum INT; n_none INT;
BEGIN
    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE owner_name = 'Coromandel Heritage Museum'),
           COUNT(*) FILTER (WHERE owner_id IS NULL)
      INTO n_total, n_museum, n_none
    FROM v_current_owner;
    IF (n_total, n_museum, n_none) <> (10, 7, 3) THEN
        RAISE EXCEPTION 'FAIL T1: got % total / % museum / % none', n_total, n_museum, n_none;
    END IF;
    RAISE NOTICE 'PASS T1: v_current_owner -> 10 artifacts, 7 held by the museum, 3 with no record';
END $$;

-- T2: v_provenance_summary risk levels
DO $$
DECLARE r TEXT;
BEGIN
    SELECT string_agg(accession_number || '=' || provenance_risk, ', ' ORDER BY accession_number)
      INTO r FROM v_provenance_summary;
    IF r <> 'CHM-1962-0001=medium, CHM-1971-0002=high, CHM-1975-0003=medium, CHM-1980-0004=no_provenance, '
          || 'CHM-1983-0005=medium, CHM-1988-0006=high, CHM-1991-0007=no_provenance, CHM-1994-0008=medium, '
          || 'CHM-2003-0009=no_provenance, CHM-2012-0010=low' THEN
        RAISE EXCEPTION 'FAIL T2: %', r;
    END IF;
    RAISE NOTICE 'PASS T2: v_provenance_summary -> 2 high, 4 medium, 1 low, 3 no_provenance';
END $$;

-- T3: artifact_gaps() finds the Chola bronze gap
DO $$
DECLARE n INT; r RECORD;
BEGIN
    SELECT COUNT(*) INTO n FROM artifact_gaps('CHM-1971-0002');
    SELECT * INTO r FROM artifact_gaps('CHM-1971-0002');
    IF n <> 1 OR r.previous_owner <> 'Govt. Archaeological Survey, Southern Circle'
              OR r.next_owner <> 'Galerie Marchand' THEN
        RAISE EXCEPTION 'FAIL T3: % rows, % -> %', n, r.previous_owner, r.next_owner;
    END IF;
    RAISE NOTICE 'PASS T3: artifact_gaps -> % to %, % days unaccounted (% -> %)',
        r.gap_from, r.gap_to, r.gap_days, r.previous_owner, r.next_owner;
END $$;

-- T4: transfer_ownership succeeds and closes the previous row
DO $$
DECLARE v_owner TEXT; v_closed DATE;
BEGIN
    CALL transfer_ownership('CHM-2012-0010', 7, DATE '2026-01-15', 'purchase',
                            50000, 'INR', 'Test sale agreement');
    SELECT owner_name INTO v_owner FROM v_current_owner WHERE accession_number = 'CHM-2012-0010';
    SELECT acquired_until INTO v_closed FROM ownership_history WHERE artifact_id = 10 AND owner_id = 1;
    IF v_owner <> 'Elena Vogt' OR v_closed <> DATE '2026-01-14' THEN
        RAISE EXCEPTION 'FAIL T4: owner %, museum row closed on %', v_owner, v_closed;
    END IF;
    RAISE NOTICE 'PASS T4: transfer -> new owner %, previous ownership closed on %', v_owner, v_closed;
END $$;

-- T5: ATOMICITY. The INSERT fails (invalid method) after the UPDATE ran,
-- so the UPDATE must be rolled back as well.
DO $$
DECLARE v_owner TEXT; v_open INT;
BEGIN
    BEGIN
        CALL transfer_ownership('CHM-2012-0010', 3, DATE '2026-03-01', 'stolen');
    EXCEPTION WHEN OTHERS THEN
        SELECT owner_name INTO v_owner FROM v_current_owner WHERE accession_number = 'CHM-2012-0010';
        SELECT COUNT(*) INTO v_open FROM ownership_history WHERE artifact_id = 10 AND acquired_until IS NULL;
        IF v_owner <> 'Elena Vogt' OR v_open <> 1 THEN
            RAISE EXCEPTION 'FAIL T5: partial transfer left owner = %, open rows = %', v_owner, v_open;
        END IF;
        RAISE NOTICE 'PASS T5: invalid transfer rejected (%) and fully rolled back; owner still %', SQLERRM, v_owner;
        RETURN;
    END;
    RAISE EXCEPTION 'FAIL T5: invalid transfer was accepted';
END $$;

-- T6-T8: transfer rules
SELECT pg_temp.expect_error(
  $q$CALL transfer_ownership('CHM-2012-0010', 7, DATE '2026-02-01', 'purchase')$q$,
  'T6 transfer to the current owner');
SELECT pg_temp.expect_error(
  $q$CALL transfer_ownership('CHM-2012-0010', 3, DATE '2025-12-31', 'purchase')$q$,
  'T7 transfer dated before the current ownership began');
SELECT pg_temp.expect_error(
  $q$CALL transfer_ownership('CHM-9999-9999', 3, DATE '2026-02-01', 'purchase')$q$,
  'T8 unknown accession number');

-- T9-T10: curator/user role triggers
SELECT pg_temp.expect_error(
  $q$INSERT INTO curators (user_id, full_name, specialization, active_from)
     VALUES (4, 'Kavya Nair', 'Research', DATE '2020-01-01')$q$,
  'T9 linking a researcher account to a curator profile');
SELECT pg_temp.expect_error(
  $q$UPDATE users SET role = 'researcher' WHERE user_id = 2$q$,
  'T10 changing the role of a user linked to a curator profile');

-- T11-T12: archival delete guard
SELECT pg_temp.expect_error(
  $q$DELETE FROM artifacts WHERE accession_number = 'CHM-1971-0002'$q$,
  'T11 deleting an artifact with provenance history');
UPDATE artifacts SET created_at = now() - INTERVAL '30 days' WHERE accession_number = 'CHM-1980-0004';
SELECT pg_temp.expect_error(
  $q$DELETE FROM artifacts WHERE accession_number = 'CHM-1980-0004'$q$,
  'T12 deleting an old artifact even without history');

-- T13: a fresh data-entry mistake CAN be deleted
DO $$
BEGIN
    INSERT INTO artifacts (accession_number, title, category)
    VALUES ('CHM-2026-0099', 'Data entry mistake', 'other');
    DELETE FROM artifacts WHERE accession_number = 'CHM-2026-0099';
    RAISE NOTICE 'PASS T13: freshly created artifact with no history was deleted (data-entry correction)';
END $$;

-- T14 (demo, not an assertion): the partial index is usable.
-- Tables are tiny so the planner prefers a seq scan; disable it to show the index.
SET LOCAL enable_seqscan = off;
EXPLAIN SELECT * FROM ownership_history WHERE artifact_id = 2 AND acquired_until IS NULL;

ROLLBACK;
