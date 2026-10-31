-- =====================================================================
-- 02_condition_similarity_queries.sql  (Owner: Monish)
-- Condition tracking, vector similarity search and anomaly flags
-- Run: ./scripts/psql.sh < db/queries/02_condition_similarity_queries.sql
-- =====================================================================

-- Q9. Latest condition of every artifact
-- Concepts: JOIN (3 tables), DISTINCT ON, ORDER BY
SELECT DISTINCT ON (a.artifact_id)
       a.accession_number, a.title, cr.report_date AS last_inspected,
       cr.condition_grade, c.full_name AS inspected_by
FROM artifacts a
JOIN condition_reports cr ON cr.artifact_id = a.artifact_id
JOIN curators c           ON c.curator_id   = cr.curator_id
ORDER BY a.artifact_id, cr.report_date DESC;

-- Q10. Grade changes between consecutive reports (degradation AND suspicious improvement)
-- Positive grade_drop = got worse; negative = got better (suspicious without conservation)
-- Concepts: CTE, window function LAG with named WINDOW, JOIN USING, ORDER BY
WITH seq AS (
    SELECT cr.artifact_id, cr.report_id, cr.report_date, cr.condition_grade,
           LAG(cr.condition_grade) OVER w AS prev_grade,
           LAG(cr.report_date)     OVER w AS prev_date
    FROM condition_reports cr
    WINDOW w AS (PARTITION BY cr.artifact_id ORDER BY cr.report_date)
)
SELECT a.accession_number, a.title,
       s.prev_date, s.report_date, s.prev_grade, s.condition_grade,
       s.prev_grade - s.condition_grade                    AS grade_drop,
       ROUND((s.report_date - s.prev_date) / 365.25, 1)    AS years_between
FROM seq s
JOIN artifacts a USING (artifact_id)
WHERE s.prev_grade IS NOT NULL
  AND s.condition_grade <> s.prev_grade
ORDER BY grade_drop DESC;

-- Q11. Curator workload and grading tendency (curators with >= 3 reports)
-- Concepts: JOIN, GROUP BY, HAVING, aggregates (COUNT, AVG, MIN, MAX)
SELECT c.full_name, c.specialization,
       COUNT(*)                          AS reports_written,
       ROUND(AVG(cr.condition_grade), 2) AS avg_grade_given,
       MIN(cr.report_date)               AS first_report,
       MAX(cr.report_date)               AS last_report
FROM curators c
JOIN condition_reports cr ON cr.curator_id = c.curator_id
GROUP BY c.curator_id, c.full_name, c.specialization
HAVING COUNT(*) >= 3
ORDER BY reports_written DESC;

-- Q12. VECTOR: the 5 historical reports most similar in meaning to report 4
-- Concepts: pgvector cosine distance (<=>), similarity = 1 - distance, ORDER BY distance + LIMIT (k-NN)
SELECT cr.report_id, a.accession_number, cr.report_date, cr.condition_grade,
       ROUND((1 - (e.embedding <=> q.embedding))::numeric, 4) AS cosine_similarity,
       LEFT(cr.report_text, 70) || '...'                      AS excerpt
FROM report_embeddings e
JOIN condition_reports cr ON cr.report_id   = e.report_id
JOIN artifacts a          ON a.artifact_id  = cr.artifact_id
CROSS JOIN (SELECT embedding FROM report_embeddings WHERE report_id = 4) q
WHERE e.report_id <> 4
ORDER BY e.embedding <=> q.embedding
LIMIT 5;

-- Q13. VECTOR: inconsistent documentation. Consecutive reports of the SAME artifact
-- that read least alike (candidates for forgery/substitution review)
-- Concepts: CTE, LAG, self-join on report_embeddings, vector distance
-- Observed similarity values (TODO after running on your machine): lowest pair = ____ ; typical pair = ____
WITH seq AS (
    SELECT cr.artifact_id, cr.report_id, cr.report_date,
           LAG(cr.report_id) OVER (PARTITION BY cr.artifact_id ORDER BY cr.report_date) AS prev_report_id
    FROM condition_reports cr
)
SELECT a.accession_number, a.title,
       s.prev_report_id, s.report_id,
       ROUND((1 - (e_prev.embedding <=> e_cur.embedding))::numeric, 4) AS similarity
FROM seq s
JOIN report_embeddings e_cur  ON e_cur.report_id  = s.report_id
JOIN report_embeddings e_prev ON e_prev.report_id = s.prev_report_id
JOIN artifacts a              ON a.artifact_id    = s.artifact_id
WHERE s.prev_report_id IS NOT NULL
ORDER BY similarity ASC
LIMIT 5;

-- Q14. VECTOR: possible mislabelling. Reports on DIFFERENT artifacts that are near-duplicates
-- Concepts: self-join with r1 < r2 to avoid duplicate pairs, similarity threshold
-- Threshold tuned empirically: artifact 9 (report 22) vs artifact 1 (reports 1-3) should appear,
-- unrelated pairs should not. Observed values (TODO after running): report 22 vs 1 = ____ ; highest unrelated pair = ____
-- Adjust 0.80 below if needed.
SELECT r1.report_id AS report_a, a1.accession_number AS artifact_a,
       r2.report_id AS report_b, a2.accession_number AS artifact_b,
       ROUND((1 - (e1.embedding <=> e2.embedding))::numeric, 4) AS similarity
FROM report_embeddings e1
JOIN report_embeddings e2  ON e1.report_id  < e2.report_id
JOIN condition_reports r1  ON r1.report_id  = e1.report_id
JOIN condition_reports r2  ON r2.report_id  = e2.report_id
JOIN artifacts a1          ON a1.artifact_id = r1.artifact_id
JOIN artifacts a2          ON a2.artifact_id = r2.artifact_id
WHERE r1.artifact_id <> r2.artifact_id
  AND 1 - (e1.embedding <=> e2.embedding) > 0.80
ORDER BY similarity DESC;

-- Q15. Unresolved anomaly flags for the review dashboard
-- Concepts: multi-table JOIN incl. two joins to the same table, LEFT JOIN (reviewer may be NULL)
SELECT f.flag_id, f.flag_type, f.status, a.accession_number, a.title,
       r.report_date  AS flagged_report_date,
       rc.report_date AS compared_with_date,
       f.similarity_score,
       u.full_name    AS reviewer
FROM anomaly_flags f
JOIN condition_reports r       ON r.report_id  = f.report_id
JOIN artifacts a               ON a.artifact_id = r.artifact_id
LEFT JOIN condition_reports rc ON rc.report_id = f.compared_report_id
LEFT JOIN users u              ON u.user_id    = f.reviewed_by
WHERE f.status IN ('open', 'under_review')
ORDER BY f.raised_at;

-- Q16. Artifacts whose CURRENT condition is worse than the collection average
-- Concepts: CTE, nested subquery with aggregate, comparison against a scalar subquery
WITH latest AS (
    SELECT DISTINCT ON (artifact_id) artifact_id, condition_grade, report_date
    FROM condition_reports
    ORDER BY artifact_id, report_date DESC
)
SELECT a.accession_number, a.title, a.status, l.condition_grade, l.report_date
FROM latest l
JOIN artifacts a USING (artifact_id)
WHERE l.condition_grade < (SELECT AVG(condition_grade) FROM latest)
ORDER BY l.condition_grade, a.accession_number;

-- Q17. DML demo inside a transaction (INSERT, UPDATE, DELETE), rolled back so demo data stays clean
-- Concepts: transaction (BEGIN/ROLLBACK), INSERT ... RETURNING, UPDATE, DELETE
BEGIN;
INSERT INTO anomaly_flags (report_id, compared_report_id, flag_type, similarity_score)
VALUES (8, 7, 'rapid_degradation', 0.8100)
RETURNING flag_id, flag_type, status;

UPDATE anomaly_flags
SET status = 'dismissed', reviewed_by = 3, reviewed_at = now(),
    review_notes = 'Bronze disease is a known slow process; not anomalous.'
WHERE report_id = 8 AND compared_report_id = 7 AND flag_type = 'rapid_degradation'
RETURNING flag_id, status, reviewed_by;

DELETE FROM anomaly_flags
WHERE status = 'dismissed'
RETURNING flag_id;
ROLLBACK;
