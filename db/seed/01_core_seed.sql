-- users 1..5 (passwords hashed with bcrypt via pgcrypto)
INSERT INTO users (full_name, email, password_hash, role) VALUES
('Asha Raman',  'admin@museum.test',       crypt('Admin@123',    gen_salt('bf')), 'admin'),
('Meera Iyer',  'meera.iyer@museum.test',  crypt('Curator@123',  gen_salt('bf')), 'curator'),
('Rahul Menon', 'rahul.menon@museum.test', crypt('Curator@123',  gen_salt('bf')), 'curator'),
('Kavya Nair',  'kavya.nair@uni.test',     crypt('Research@123', gen_salt('bf')), 'researcher'),
('Arjun Das',   'arjun.das@uni.test',      crypt('Research@123', gen_salt('bf')), 'researcher');

-- curators 1..6 (only 4 and 5 have logins)
INSERT INTO curators (user_id, full_name, specialization, institution, active_from, active_until) VALUES
(NULL, 'Dr. S. Krishnan', 'Paintings',                    'Coromandel Heritage Museum', '1960-01-01', '1989-12-31'),
(NULL, 'Lakshmi Varadan', 'Textiles and Manuscripts',     'Coromandel Heritage Museum', '1985-06-01', '2004-12-31'),
(NULL, 'J. Fernandes',    'Metalwork and Sculpture',      'Coromandel Heritage Museum', '1990-01-01', '2010-06-30'),
(2,    'Meera Iyer',      'Paintings and Works on Paper', 'Coromandel Heritage Museum', '2008-04-01', NULL),
(3,    'Rahul Menon',     'Conservation Science',         'Coromandel Heritage Museum', '2015-07-01', NULL),
(NULL, 'P. Subramaniam',  'Ceramics',                     'Coromandel Heritage Museum', '1975-01-01', '1998-12-31');

-- owners 1..8
INSERT INTO owners (owner_name, owner_type, country, notes) VALUES
('Coromandel Heritage Museum',                    'institution',   'India',          'This museum'),
('Iyengar Family Collection',                     'individual',    'India',          NULL),
('H. W. Ashford',                                 'individual',    'United Kingdom', NULL),
('Galerie Marchand',                              'dealer',        'France',         NULL),
('Sotheran & Pike Auctions',                      'auction_house', 'United Kingdom', NULL),
('Govt. Archaeological Survey, Southern Circle',  'government',    'India',          NULL),
('Elena Vogt',                                    'individual',    'Germany',        NULL),
('Unknown private collector',                     'unknown',       NULL,             'Identity not recorded');

-- artifacts 1..10
INSERT INTO artifacts (accession_number, title, category, material, origin_culture,
                       est_year_from, est_year_to, acquisition_date, current_location, status, created_by) VALUES
('CHM-1962-0001', 'Portrait of a Court Musician',       'painting',   'Oil on canvas',                'Thanjavur',      1820, 1850, '1962-05-10', 'Gallery 2',        'on_display',         1),
('CHM-1971-0002', 'Chola Bronze Nataraja',              'metalwork',  'Bronze, lost-wax cast',        'Chola',          1000, 1100, '1971-03-02', 'Gallery 1',        'on_display',         1),
('CHM-1975-0003', 'Palm-leaf Manuscript of Tirukkural', 'manuscript', 'Palm leaf, ink',               'Tamil',          1750, 1800, '1975-08-19', 'Archive Vault A',  'in_storage',         1),
('CHM-1980-0004', 'Kalamkari Temple Hanging',           'textile',    'Cotton, natural dyes',         'Srikalahasti',   1880, 1900, '1980-11-04', 'Textile Store',    'in_storage',         1),
('CHM-1983-0005', 'Celadon Export Bowl',                'ceramic',    'Stoneware, celadon glaze',     'Longquan, China',1300, 1400, '1983-02-14', 'Gallery 3',        'on_display',         1),
('CHM-1988-0006', 'Landscape with River Ghats',         'painting',   'Oil on canvas',                'Company School', 1790, 1810, '1988-06-30', 'Conservation Lab', 'under_conservation', 2),
('CHM-1991-0007', 'Colonial Survey Map of Madras',      'document',   'Ink and watercolour on paper', 'British India',  1798, 1798, '1991-09-09', 'Archive Vault B',  'in_storage',         2),
('CHM-1994-0008', 'Silver Betel Box',                   'metalwork',  'Silver, repousse',             'Thanjavur',      1850, 1880, '1994-01-21', 'Gallery 3',        'on_display',         2),
('CHM-2003-0009', 'Hand-tinted Studio Photograph',      'photograph', 'Albumen print, hand-coloured', 'Madras',         1880, 1890, '2003-07-15', 'Photo Store',      'in_storage',         3),
('CHM-2012-0010', 'Stone Yakshi Figure',                'sculpture',  'Granite',                      'Pallava',         700,  800, '2012-10-05', 'On loan',          'on_loan',            3);
