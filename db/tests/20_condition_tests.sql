-- =====================================================================
-- 20_condition_tests.sql  (Owner: Monish)
-- Runs inside a transaction that is ROLLED BACK: demo data never changes.
-- Every test prints "PASS ..." or stops the run with "FAIL ...".
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

-- T1: v_latest_condition (as of Nov 2026; overdue = last report > 5 years ago)
DO $$
DECLARE r TEXT;
BEGIN
    SELECT string_agg(accession_number || '=' || inspection_status, ', ' ORDER BY accession_number)
      INTO r FROM v_latest_condition;
    IF r <> 'CHM-1962-0001=overdue, CHM-1971-0002=overdue, CHM-1975-0003=overdue, '
          || 'CHM-1980-0004=never_inspected, CHM-1983-0005=overdue, CHM-1988-0006=overdue, '
          || 'CHM-1991-0007=never_inspected, CHM-1994-0008=overdue, CHM-2003-0009=overdue, '
          || 'CHM-2012-0010=ok' THEN
        RAISE EXCEPTION 'FAIL T1: %', r;
    END IF;
    RAISE NOTICE 'PASS T1: v_latest_condition -> 7 overdue, 2 never inspected, 1 ok';
END $$;

-- T2: v_open_flags shows the 2 unresolved seed flags
DO $$
DECLARE n INT;
BEGIN
    SELECT COUNT(*) INTO n FROM v_open_flags;
    IF n <> 2 THEN RAISE EXCEPTION 'FAIL T2: % open flags', n; END IF;
    RAISE NOTICE 'PASS T2: v_open_flags -> 2 unresolved flags';
END $$;

-- T3-T4: report date trigger
SELECT pg_temp.expect_error(
  $q$INSERT INTO condition_reports (artifact_id, curator_id, report_date, condition_grade, report_text)
     VALUES (5, 1, DATE '2020-01-01', 4, 'Report written by a curator who retired in 1989, should be rejected.')$q$,
  'T3 report dated outside the curator''s active period');
SELECT pg_temp.expect_error(
  $q$INSERT INTO condition_reports (artifact_id, curator_id, report_date, condition_grade, report_text)
     VALUES (5, 5, CURRENT_DATE + 30, 4, 'Report dated in the future, which should be rejected by the trigger.')$q$,
  'T4 report dated in the future');

-- T5: grade drop of 2 -> rapid_degradation flag
DO $$
DECLARE v_id INT; v_ok BOOLEAN;
BEGIN
    INSERT INTO condition_reports (artifact_id, curator_id, report_date, condition_grade, report_text)
    VALUES (5, 5, DATE '2025-06-01', 2,
            'Celadon bowl now shows a long crack from the rim to the foot ring and two new chips.')
    RETURNING report_id INTO v_id;
    SELECT EXISTS (SELECT 1 FROM anomaly_flags
                   WHERE report_id = v_id AND compared_report_id = 15
                     AND flag_type = 'rapid_degradation') INTO v_ok;
    IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T5: no rapid_degradation flag for report %', v_id; END IF;
    RAISE NOTICE 'PASS T5: grade 4 -> 2 auto-raised rapid_degradation (report % vs 15)', v_id;
END $$;

-- T6: grade improvement of 3 -> unexplained_improvement flag
DO $$
DECLARE v_id INT; v_ok BOOLEAN;
BEGIN
    INSERT INTO condition_reports (artifact_id, curator_id, report_date, condition_grade, report_text)
    VALUES (3, 5, DATE '2025-07-01', 5,
            'Palm-leaf manuscript complete and supple, no splits, no brittleness, no insect damage.')
    RETURNING report_id INTO v_id;
    SELECT EXISTS (SELECT 1 FROM anomaly_flags
                   WHERE report_id = v_id AND compared_report_id = 12
                     AND flag_type = 'unexplained_improvement') INTO v_ok;
    IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T6: no unexplained_improvement flag for report %', v_id; END IF;
    RAISE NOTICE 'PASS T6: grade 2 -> 5 auto-raised unexplained_improvement (report % vs 12)', v_id;
END $$;

-- T7: embedding trigger. A new report for the granite Yakshi (artifact 10) whose
-- embedding is copied from report 1 (the oil painting), so it "reads like" a painting:
--   * inconsistent with the Yakshi's previous report (24)  -> inconsistent_description
--   * identical to artifact 1's report 1                   -> possible_mislabel
DO $$
DECLARE v_id INT; v_incons BOOLEAN; v_mislabel BOOLEAN; v_sim NUMERIC;
BEGIN
    INSERT INTO condition_reports (artifact_id, curator_id, report_date, condition_grade, report_text)
    VALUES (10, 5, DATE '2025-08-01', 4,
            'Routine inspection text placeholder; the embedding below is copied from report 1.')
    RETURNING report_id INTO v_id;

    INSERT INTO report_embeddings (report_id, embedding)
    SELECT v_id, embedding FROM report_embeddings WHERE report_id = 1;

    SELECT EXISTS (SELECT 1 FROM anomaly_flags WHERE report_id = v_id AND compared_report_id = 24
                     AND flag_type = 'inconsistent_description'),
           EXISTS (SELECT 1 FROM anomaly_flags WHERE report_id = v_id AND compared_report_id = 1
                     AND flag_type = 'possible_mislabel')
      INTO v_incons, v_mislabel;
    SELECT similarity_score INTO v_sim FROM anomaly_flags
     WHERE report_id = v_id AND flag_type = 'inconsistent_description';
    -- remove the fixture (its embedding/flags cascade) so it cannot show up as a
    -- "similar report" in the later T12 search
    DELETE FROM condition_reports WHERE report_id = v_id;
    IF NOT (v_incons AND v_mislabel) THEN
        RAISE EXCEPTION 'FAIL T7: inconsistent=% mislabel=%', v_incons, v_mislabel;
    END IF;
    RAISE NOTICE 'PASS T7: embedding trigger raised inconsistent_description (sim % vs report 24) and possible_mislabel (vs report 1)', v_sim;
END $$;

-- T8-T11: review_flag procedure rules
SELECT pg_temp.expect_error(
  $q$CALL review_flag(1, 4, 'under_review')$q$,
  'T8 researcher tries to review a flag');
DO $$
DECLARE v_status TEXT; v_by INT;
BEGIN
    CALL review_flag(1, 2, 'under_review');
    CALL review_flag(1, 2, 'confirmed', 'Medium and support differ from all earlier reports; referred for technical analysis.');
    SELECT status, reviewed_by INTO v_status, v_by FROM anomaly_flags WHERE flag_id = 1;
    IF v_status <> 'confirmed' OR v_by <> 2 THEN
        RAISE EXCEPTION 'FAIL T9: status %, reviewed_by %', v_status, v_by;
    END IF;
    RAISE NOTICE 'PASS T9: curator moved flag 1 open -> under_review -> confirmed';
END $$;
SELECT pg_temp.expect_error(
  $q$CALL review_flag(1, 2, 'dismissed', 'Changed my mind')$q$,
  'T10 changing a flag that is already confirmed');
SELECT pg_temp.expect_error(
  $q$CALL review_flag(2, 3, 'confirmed')$q$,
  'T11 confirming without review notes');

-- T12: find_similar_reports(22, 3) -> the painting it describes.
-- Relaxed (agreed with Likhith): the exact order of reports 1,2,3 depends on the
-- model, and report 16 (the oil-on-canvas landscape) can outrank report 3.
-- So we check that report 1 (the portrait report it near-duplicates) is among the
-- results and that ALL results are oil-painting reports (artifacts 1 and 6),
-- never the silver, bronze, ceramic, manuscript or stone objects.
DO $$
DECLARE r TEXT; v_top INT; v_has_1 BOOLEAN; v_all_paint BOOLEAN;
BEGIN
    SELECT string_agg(report_id::text, ',' ORDER BY similarity DESC),
           (array_agg(report_id ORDER BY similarity DESC))[1],
           bool_or(report_id = 1),
           bool_and(report_id IN (1, 2, 3, 16, 17, 18, 19))
      INTO r, v_top, v_has_1, v_all_paint
      FROM find_similar_reports(22, 3);
    IF NOT (v_has_1 AND v_all_paint) THEN
        RAISE EXCEPTION 'FAIL T12: got % (report 1 present: %, all oil paintings: %)', r, v_has_1, v_all_paint;
    END IF;
    RAISE NOTICE 'PASS T12: find_similar_reports(22, 3) -> % (top = report %); all are oil-painting reports, incl. report 1', r, v_top;
END $$;

-- T13: full-text search
DO $$
DECLARE r TEXT;
BEGIN
    SELECT string_agg(report_id::text, ',') INTO r FROM search_reports('bronze disease');
    IF r <> '8' THEN RAISE EXCEPTION 'FAIL T13: got %', r; END IF;
    RAISE NOTICE 'PASS T13: search_reports(''bronze disease'') -> report 8 only';
END $$;

-- T14 (demo, not an assertion): keyword search cannot understand negation.
-- "flaking" also matches reports that say "No flaking observed".
-- That limitation is exactly why the project also uses embeddings.
SELECT report_id, accession_number, snippet FROM search_reports('flaking');

-- T15 (demo): the GIN index is used for full-text search
SET LOCAL enable_seqscan = off;
EXPLAIN SELECT report_id FROM condition_reports
WHERE report_tsv @@ websearch_to_tsquery('english', 'bronze disease');

ROLLBACK;
