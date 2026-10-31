-- =====================================================================
-- 02_history_condition_seed.sql
-- Owner: Monish
-- Run after 01_core_seed.sql (IDs listed in MONISH_INSTRUCTIONS.md)
-- =====================================================================

-- ---------------- OWNERSHIP HISTORY ----------------
INSERT INTO ownership_history
    (artifact_id, owner_id, acquired_from, acquired_until, acquisition_method, price_paid, currency, source_document)
VALUES
-- Artifact 1: Portrait of a Court Musician
(1, 2, '1850-01-01', '1948-06-30', 'unknown',   NULL,      NULL,  'Family inventory list, 1902'),
(1, 3, '1948-07-01', '1961-12-31', 'purchase',  1200.00,   'GBP', 'Bill of sale, Madras, July 1948'),
(1, 5, '1962-01-01', '1962-05-09', 'transfer',  NULL,      NULL,  'Consignment record, lot 87'),
(1, 1, '1962-05-10', NULL,         'purchase',  38000.00,  'INR', 'Museum acquisition file CHM/ACQ/1962/04'),
-- Artifact 2: Chola Bronze (gap 1936-1939, dealer during 1933-1945)
(2, 6, '1921-01-01', '1935-12-31', 'excavation',NULL,      NULL,  'Excavation register, Southern Circle, 1921'),
(2, 4, '1939-04-01', '1952-12-31', 'purchase',  NULL,      NULL,  'Gallery stock book, 1939 (seller not recorded)'),
(2, 7, '1953-01-01', '1971-03-01', 'purchase',  4500.00,   'GBP', 'Invoice, Galerie Marchand, 1953'),
(2, 1, '1971-03-02', NULL,         'purchase',  150000.00, 'INR', 'Museum acquisition file CHM/ACQ/1971/02'),
-- Artifact 3: Palm-leaf manuscript
(3, 2, '1800-01-01', '1975-08-18', 'unknown',   NULL,      NULL,  'Family oral history'),
(3, 1, '1975-08-19', NULL,         'gift',      NULL,      NULL,  'Deed of gift, 1975'),
-- Artifact 5: Celadon bowl
(5, 8, '1900-01-01', '1970-12-31', 'unknown',   NULL,      NULL,  NULL),
(5, 5, '1971-01-01', '1983-02-13', 'transfer',  NULL,      NULL,  'Consignment record, lot 212'),
(5, 1, '1983-02-14', NULL,         'purchase',  22000.00,  'INR', 'Museum acquisition file CHM/ACQ/1983/01'),
-- Artifact 6: Landscape (dealer 1941-45, gap 1945-1960)
(6, 3, '1890-01-01', '1940-12-31', 'bequest',   NULL,      NULL,  'Probate inventory, 1890'),
(6, 4, '1941-02-01', '1945-06-30', 'purchase',  NULL,      NULL,  'Gallery stock book, 1941'),
(6, 8, '1960-01-01', '1988-06-29', 'unknown',   NULL,      NULL,  NULL),
(6, 1, '1988-06-30', NULL,         'purchase',  95000.00,  'INR', 'Museum acquisition file CHM/ACQ/1988/03'),
-- Artifact 8: Silver betel box
(8, 2, '1880-01-01', '1994-01-20', 'unknown',   NULL,      NULL,  'Family inventory list, 1902'),
(8, 1, '1994-01-21', NULL,         'gift',      NULL,      NULL,  'Deed of gift, 1994'),
-- Artifact 10: Stone Yakshi
(10, 6, '1955-01-01', '2012-10-04', 'excavation', NULL,    NULL,  'Excavation register, 1955'),
(10, 1, '2012-10-05', NULL,         'transfer',   NULL,    NULL,  'Government transfer order, 2012');

-- ---------------- CONDITION REPORTS ----------------
-- report_id will be 1..24 in this order on a fresh reset
INSERT INTO condition_reports (artifact_id, curator_id, report_date, condition_grade, report_text) VALUES
-- Artifact 1 (r1-r4): consistent until 2016, then a different object is described
(1, 1, '1963-04-12', 4, 'Oil on canvas, signed lower right "V. Rao". Canvas has been lined; tacking edges intact. Varnish shows mild yellowing; fine age craquelure across the face and drapery. No flaking observed.'),
(1, 1, '1979-09-03', 4, 'Oil on lined canvas, signature "V. Rao" lower right clearly legible. Varnish yellowing has increased slightly. Age craquelure stable, no lifting or paint loss. Frame gilding worn at corners.'),
(1, 3, '1997-06-18', 3, 'Oil on canvas, lined, signed lower right. Varnish discoloured and hazy. Small paint loss near the lower left corner, approx. 1 cm, and minor cupping along the craquelure in the background. Recommend surface cleaning.'),
(1, 4, '2016-11-22', 5, 'Tempera on a single wooden panel, unsigned. No lining or canvas weave visible; surface bright and unvarnished with no craquelure. Panel shows no cracks or insect damage. Colours appear fresh.'),
-- Artifact 2 (r5-r8): stable bronze, then bronze disease
(2, 1, '1972-05-15', 4, 'Bronze figure with stable dark green patina. Casting flaw visible on the raised left hand. Flame aureole intact, base secure. No active corrosion.'),
(2, 3, '1993-02-08', 4, 'Lost-wax cast bronze, dark green-brown patina, stable. Known casting flaw on raised left hand unchanged. Aureole intact; minor surface dust in recesses. No signs of corrosion.'),
(2, 4, '2009-07-21', 4, 'Bronze in good stable condition. Even green patina; casting flaw on left hand as previously documented. Aureole and base sound. Light dust removed with soft brush.'),
(2, 5, '2020-01-30', 3, 'Several small spots of powdery light-green corrosion on the base and lower aureole, consistent with active bronze disease. Casting flaw on left hand unchanged. Recommend isolation and humidity below 40 percent RH.'),
-- Artifact 3 (r9-r12): manuscript losing leaves, insect attack, then treated
(3, 1, '1976-10-05', 3, 'Palm-leaf bundle of 112 leaves bound with cord between wooden boards. Leaves brittle at edges; some insect bore holes on outer leaves. Incised text largely legible, ink fill faded.'),
(3, 2, '1990-03-14', 3, 'Palm-leaf manuscript, 112 leaves. Edge brittleness and insect bore holes on first and last leaves, unchanged from earlier record. Binding cord frayed. Text legible.'),
(3, 4, '2009-12-01', 2, 'Palm-leaf manuscript, now 109 leaves present, three leaves missing or detached. Fresh insect activity with frass in the bundle. Several leaves split along the grain. Urgent fumigation advised.'),
(3, 5, '2018-08-27', 2, 'Manuscript treated after anoxic fumigation; no live insect activity. 109 leaves, splits along grain stabilised with Japanese tissue. Edges remain brittle. Store flat in archival box.'),
-- Artifact 5 (r13-r15): ceramic, minor handling damage
(5, 6, '1984-06-11', 5, 'Stoneware bowl with sea-green celadon glaze and fine crackle. Intact, no chips or repairs. Foot ring unglazed with orange firing blush. Excellent condition.'),
(5, 6, '1997-11-02', 5, 'Celadon bowl intact. Glaze crackle stable, foot ring with orange firing blush. No chips, cracks or restoration. Excellent.'),
(5, 4, '2014-04-17', 4, 'Celadon stoneware bowl. Small chip of 3 mm on the rim, likely handling damage. Crackle and foot ring unchanged. Otherwise good.'),
-- Artifact 6 (r16-r19): progressive degradation 4 -> 3 -> 2 -> 1
(6, 1, '1989-03-20', 4, 'Oil on canvas river landscape with ghats and boats. Fine craquelure in the sky area, varnish slightly yellowed. Canvas taut on original stretcher. No paint loss.'),
(6, 3, '1996-09-09', 3, 'Craquelure in the sky has widened with slight cupping. Canvas slack in lower corners. Varnish yellowing increased. No paint loss yet. Recommend monitoring humidity in the gallery.'),
(6, 2, '2004-02-10', 2, 'Active flaking along craquelure in the sky and water areas; several small paint losses. Canvas slack with a 4 cm tear at the lower right edge. Treatment required.'),
(6, 4, '2011-05-26', 1, 'Severe flaking and widespread paint loss across the sky; tear at lower right extended to 9 cm. Canvas distorted. Painting removed from display and moved to conservation lab. Critical.'),
-- Artifact 8 (r20-r21)
(8, 3, '1995-08-14', 4, 'Silver repousse betel box with hinged lid. Overall tarnish, darker in recesses. Hinge functional. Small dent on the lid rim.'),
(8, 4, '2010-10-19', 4, 'Silver betel box, moderate tarnish after earlier cleaning. Hinge functional, lid dent unchanged. Stable.'),
-- Artifact 9 (r22): a PHOTOGRAPH whose report describes a signed oil painting -> mislabel
(9, 3, '2004-01-28', 4, 'Oil on lined canvas portrait, signed lower right "V. Rao". Varnish yellowing and fine age craquelure across the face and drapery. No flaking.'),
-- Artifact 10 (r23-r24)
(10, 4, '2013-02-06', 4, 'Granite figure, surface weathered with lichen residue in recesses. Left forearm missing from an old break. Base stable. No new damage.'),
(10, 5, '2022-09-12', 4, 'Granite yakshi figure returned from loan. Weathered surface, old break at left forearm unchanged. Light cleaning of lichen residue. Stable.');

-- ---------------- ANOMALY FLAGS ----------------
-- similarity_score values here are placeholders; Q13/Q14 compute the real ones
INSERT INTO anomaly_flags
    (report_id, compared_report_id, flag_type, similarity_score, status, reviewed_by, reviewed_at, review_notes)
VALUES
(4,  3,  'possible_forgery',  0.4100, 'open',         NULL, NULL, NULL),
(19, 18, 'rapid_degradation', 0.7800, 'under_review', 2,    now(), 'Conservation assessment requested.'),
(22, 1,  'possible_mislabel', 0.9300, 'confirmed',    3,    now(), 'Report was filed under the wrong accession number.');
