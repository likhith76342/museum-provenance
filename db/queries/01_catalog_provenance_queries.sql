-- =====================================================================
-- 01_catalog_provenance_queries.sql  (Owner: Likhith)
-- =====================================================================

-- Q1. Full provenance chain of one artifact
-- Concepts: 3-table JOIN, COALESCE, date arithmetic, ORDER BY
SELECT a.accession_number, a.title, o.owner_name, o.owner_type,
       oh.acquired_from, oh.acquired_until, oh.acquisition_method,
       COALESCE(oh.acquired_until, CURRENT_DATE) - oh.acquired_from AS days_held
FROM artifacts a
JOIN ownership_history oh ON oh.artifact_id = a.artifact_id
JOIN owners o             ON o.owner_id     = oh.owner_id
WHERE a.accession_number = 'CHM-1971-0002'
ORDER BY oh.acquired_from;

-- Q2. Collection profile by category (categories with >= 2 objects)
-- Concepts: GROUP BY, HAVING, COUNT/MIN/AVG
SELECT category,
       COUNT(*)                                   AS n_artifacts,
       MIN(est_year_from)                         AS oldest_est_year,
       ROUND(AVG(est_year_to - est_year_from), 1) AS avg_dating_uncertainty_years
FROM artifacts
GROUP BY category
HAVING COUNT(*) >= 2
ORDER BY n_artifacts DESC, category;

-- Q3. External owners who held more than one of our artifacts
-- Concepts: JOIN, GROUP BY, HAVING, STRING_AGG
SELECT o.owner_name, o.owner_type,
       COUNT(DISTINCT oh.artifact_id) AS artifacts_held,
       STRING_AGG(DISTINCT a.accession_number, ', ' ORDER BY a.accession_number) AS accessions
FROM owners o
JOIN ownership_history oh ON oh.owner_id    = o.owner_id
JOIN artifacts a          ON a.artifact_id  = oh.artifact_id
WHERE o.owner_type <> 'institution'
GROUP BY o.owner_id, o.owner_name, o.owner_type
HAVING COUNT(DISTINCT oh.artifact_id) > 1
ORDER BY artifacts_held DESC, o.owner_name;

-- Q4. Provenance gaps > 1 year between consecutive owners (red flag)
-- Concepts: CTE, window function LAG, date arithmetic
WITH chain AS (
    SELECT artifact_id, acquired_from,
           LAG(acquired_until) OVER (PARTITION BY artifact_id ORDER BY acquired_from) AS prev_until
    FROM ownership_history
)
SELECT a.accession_number, a.title,
       c.prev_until    AS previous_owner_until,
       c.acquired_from AS next_owner_from,
       c.acquired_from - c.prev_until AS gap_days
FROM chain c
JOIN artifacts a USING (artifact_id)
WHERE c.prev_until IS NOT NULL
  AND c.acquired_from - c.prev_until > 365
ORDER BY gap_days DESC;

-- Q5. Artifacts with NO recorded provenance at all
-- Concepts: NOT EXISTS correlated subquery
SELECT a.accession_number, a.title, a.acquisition_date
FROM artifacts a
WHERE NOT EXISTS (SELECT 1 FROM ownership_history oh WHERE oh.artifact_id = a.artifact_id)
ORDER BY a.acquisition_date;

-- Q6. Objects that passed through dealers/auction houses during 1933-1945
-- (standard provenance red-flag period for looted/displaced art)
-- Concepts: JOIN, range overlap operator && on daterange
SELECT a.accession_number, a.title, o.owner_name, o.owner_type,
       oh.acquired_from, oh.acquired_until
FROM ownership_history oh
JOIN owners o    ON o.owner_id    = oh.owner_id
JOIN artifacts a ON a.artifact_id = oh.artifact_id
WHERE o.owner_type IN ('dealer', 'auction_house')
  AND daterange(oh.acquired_from, oh.acquired_until, '[]')
      && daterange('1933-01-01', '1945-12-31', '[]')
ORDER BY oh.acquired_from;

-- Q7. Artifacts that changed hands more often than average
-- Concepts: correlated scalar subquery, nested aggregate subquery
SELECT a.accession_number, a.title,
       (SELECT COUNT(*) FROM ownership_history oh WHERE oh.artifact_id = a.artifact_id) AS n_owners
FROM artifacts a
WHERE (SELECT COUNT(*) FROM ownership_history oh WHERE oh.artifact_id = a.artifact_id)
    > (SELECT AVG(cnt) FROM (SELECT COUNT(*) AS cnt FROM ownership_history GROUP BY artifact_id) t)
ORDER BY n_owners DESC, a.accession_number;

-- Q8. DML demo in a transaction (INSERT, UPDATE, DELETE), rolled back to keep demo data clean
BEGIN;
INSERT INTO artifacts (accession_number, title, category, material, origin_culture,
                       est_year_from, est_year_to, acquisition_date, current_location, status, created_by)
VALUES ('CHM-2026-0011', 'Brass Standing Lamp', 'metalwork', 'Brass', 'Tamil Nadu',
        1900, 1930, CURRENT_DATE, 'Receiving Room', 'in_storage', 1)
RETURNING artifact_id, accession_number;

UPDATE artifacts SET status = 'on_display', current_location = 'Gallery 3'
WHERE accession_number = 'CHM-2026-0011'
RETURNING accession_number, status, current_location;

DELETE FROM artifacts WHERE accession_number = 'CHM-2026-0011'
RETURNING accession_number;
ROLLBACK;
