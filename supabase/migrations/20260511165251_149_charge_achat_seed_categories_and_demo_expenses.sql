/*
  # Seed: Expense Categories + Demo Fleet Vehicles + Demo Expenses (week 27/04–03/05/2026)

  Inserts:
  1. Default expense categories
  2. Fleet vehicles for SBTA, TST, ETL, G-OUMÉ, SNT, DIVERS
  3. Demo vehicle expenses for the week of 27/04/2026 to 03/05/2026
*/

-- ─── 1. CATEGORIES ────────────────────────────────────────────────────────────
INSERT INTO expense_categories (id, name, icon, color, sort_order) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'Dépannage mécanique',         '🔧', '#D97706', 1),
  ('c0000001-0000-0000-0000-000000000002', 'Électricité / Électronique',  '⚡', '#1D6FA4', 2),
  ('c0000001-0000-0000-0000-000000000003', 'Achat de pièces',             '🔩', '#6B7280', 3),
  ('c0000001-0000-0000-0000-000000000004', 'Pneus & Roues',               '🛞', '#0B7439', 4),
  ('c0000001-0000-0000-0000-000000000005', 'Soudure',                     '🔥', '#EF4444', 5),
  ('c0000001-0000-0000-0000-000000000006', 'Radiateur & Refroidissement', '🌡️', '#06B6D4', 6),
  ('c0000001-0000-0000-0000-000000000007', 'Huiles et fluides',           '🛢️', '#78350F', 7),
  ('c0000001-0000-0000-0000-000000000008', 'Accident / Carrosserie',      '💥', '#DC2626', 8),
  ('c0000001-0000-0000-0000-000000000009', 'Outillage',                   '🧰', '#7C3AED', 9),
  ('c0000001-0000-0000-0000-000000000010', 'Dépannage en route',          '🌍', '#059669', 10),
  ('c0000001-0000-0000-0000-000000000011', 'Divers',                      '📦', '#9CA3AF', 11)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. FLEET VEHICLES ────────────────────────────────────────────────────────
-- SBTA vehicles (company id: 11111111-1111-1111-1111-111111111111)
INSERT INTO fleet_vehicles (registration_number, company_id) VALUES
  ('AA-266-GY-05', '11111111-1111-1111-1111-111111111111'),
  ('AA-116-PT-01', '11111111-1111-1111-1111-111111111111'),
  ('1487 LR 02',   '11111111-1111-1111-1111-111111111111'),
  ('AA-512-RL-01', '11111111-1111-1111-1111-111111111111'),
  ('AA-952-BB',    '11111111-1111-1111-1111-111111111111'),
  ('3772 KN 02',   '11111111-1111-1111-1111-111111111111'),
  ('AA-203-GT-08', '11111111-1111-1111-1111-111111111111'),
  ('AA-371-KN-01', '11111111-1111-1111-1111-111111111111'),
  ('AA-145-SR-01', '11111111-1111-1111-1111-111111111111'),
  ('1035 KZ 02',   '11111111-1111-1111-1111-111111111111')
ON CONFLICT (registration_number, company_id) DO NOTHING;

-- TST vehicles (company id: 22222222-2222-2222-2222-222222222222)
INSERT INTO fleet_vehicles (registration_number, company_id) VALUES
  ('AA-447-NR-01', '22222222-2222-2222-2222-222222222222'),
  ('AA-553-NR-01', '22222222-2222-2222-2222-222222222222'),
  ('AA-416-AD-01', '22222222-2222-2222-2222-222222222222'),
  ('AA-105-GL-01', '22222222-2222-2222-2222-222222222222'),
  ('AA-092-GL-01', '22222222-2222-2222-2222-222222222222'),
  ('AA-218-AD-01', '22222222-2222-2222-2222-222222222222'),
  ('AA-334-NR-01', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (registration_number, company_id) DO NOTHING;

-- ETL vehicles (company id: 33333333-3333-3333-3333-333333333333)
INSERT INTO fleet_vehicles (registration_number, company_id) VALUES
  ('AA-881-RY-01', '33333333-3333-3333-3333-333333333333'),
  ('AA-774-GT-01', '33333333-3333-3333-3333-333333333333'),
  ('0450 WW 01',   '33333333-3333-3333-3333-333333333333'),
  ('AA-512-ET-01', '33333333-3333-3333-3333-333333333333')
ON CONFLICT (registration_number, company_id) DO NOTHING;

-- G-OUMÉ vehicles (company id: 6fb999ff-af36-4b90-acf8-78aeede6c531)
INSERT INTO fleet_vehicles (registration_number, company_id) VALUES
  ('AA-443-YL-01', '6fb999ff-af36-4b90-acf8-78aeede6c531'),
  ('AA-479-TB-01', '6fb999ff-af36-4b90-acf8-78aeede6c531'),
  ('AA-196-PT-01', '6fb999ff-af36-4b90-acf8-78aeede6c531'),
  ('AA-907-BF',    '6fb999ff-af36-4b90-acf8-78aeede6c531'),
  ('AA-266-GY-05', '6fb999ff-af36-4b90-acf8-78aeede6c531')
ON CONFLICT (registration_number, company_id) DO NOTHING;

-- SNT vehicles (company id: fad1e234-2fec-437a-a00a-d152208403ad)
INSERT INTO fleet_vehicles (registration_number, company_id) VALUES
  ('AA-100-SN-01', 'fad1e234-2fec-437a-a00a-d152208403ad'),
  ('AA-200-SN-01', 'fad1e234-2fec-437a-a00a-d152208403ad')
ON CONFLICT (registration_number, company_id) DO NOTHING;

-- SBTA-BIS / Plongeurs (SBTA Bis id: 849c0639-f7e1-4ee6-a431-e85f9c40e56c)
INSERT INTO fleet_vehicles (registration_number, company_id) VALUES
  ('0349 WW',      '849c0639-f7e1-4ee6-a431-e85f9c40e56c')
ON CONFLICT (registration_number, company_id) DO NOTHING;

-- ─── 3. DEMO EXPENSES — Week 27/04/2026 ──────────────────────────────────────
-- Helper: get vehicle_id by reg + company
DO $$
DECLARE
  w date := '2026-04-27';  -- week_start (Monday)

  -- SBTA vehicles
  v_sbta_266  uuid; v_sbta_116  uuid; v_sbta_1487 uuid; v_sbta_512  uuid;
  v_sbta_952  uuid; v_sbta_3772 uuid; v_sbta_203  uuid; v_sbta_371  uuid;
  v_sbta_145  uuid; v_sbta_1035 uuid;

  -- TST vehicles
  v_tst_447   uuid; v_tst_553   uuid; v_tst_416   uuid; v_tst_105   uuid;
  v_tst_092   uuid; v_tst_218   uuid; v_tst_334   uuid;

  -- ETL vehicles
  v_etl_881   uuid; v_etl_774   uuid; v_etl_0450  uuid;

  -- G-OUMÉ vehicles
  v_go_443    uuid; v_go_479    uuid; v_go_196    uuid; v_go_907    uuid;

  -- Plongeurs
  v_bis_0349  uuid;

  -- category shortcuts
  c_mec  uuid := 'c0000001-0000-0000-0000-000000000001'; -- dépannage mécanique
  c_elec uuid := 'c0000001-0000-0000-0000-000000000002'; -- électricité
  c_pie  uuid := 'c0000001-0000-0000-0000-000000000003'; -- achat pièces
  c_pneu uuid := 'c0000001-0000-0000-0000-000000000004'; -- pneus
  c_sou  uuid := 'c0000001-0000-0000-0000-000000000005'; -- soudure
  c_rad  uuid := 'c0000001-0000-0000-0000-000000000006'; -- radiateur
  c_hui  uuid := 'c0000001-0000-0000-0000-000000000007'; -- huiles
  c_acc  uuid := 'c0000001-0000-0000-0000-000000000008'; -- accident
  c_out  uuid := 'c0000001-0000-0000-0000-000000000009'; -- outillage
  c_div  uuid := 'c0000001-0000-0000-0000-000000000011'; -- divers

BEGIN
  -- Fetch SBTA vehicle IDs
  SELECT id INTO v_sbta_266  FROM fleet_vehicles WHERE registration_number='AA-266-GY-05' AND company_id='11111111-1111-1111-1111-111111111111';
  SELECT id INTO v_sbta_116  FROM fleet_vehicles WHERE registration_number='AA-116-PT-01' AND company_id='11111111-1111-1111-1111-111111111111';
  SELECT id INTO v_sbta_1487 FROM fleet_vehicles WHERE registration_number='1487 LR 02'   AND company_id='11111111-1111-1111-1111-111111111111';
  SELECT id INTO v_sbta_512  FROM fleet_vehicles WHERE registration_number='AA-512-RL-01' AND company_id='11111111-1111-1111-1111-111111111111';
  SELECT id INTO v_sbta_952  FROM fleet_vehicles WHERE registration_number='AA-952-BB'    AND company_id='11111111-1111-1111-1111-111111111111';
  SELECT id INTO v_sbta_3772 FROM fleet_vehicles WHERE registration_number='3772 KN 02'   AND company_id='11111111-1111-1111-1111-111111111111';
  SELECT id INTO v_sbta_203  FROM fleet_vehicles WHERE registration_number='AA-203-GT-08' AND company_id='11111111-1111-1111-1111-111111111111';
  SELECT id INTO v_sbta_371  FROM fleet_vehicles WHERE registration_number='AA-371-KN-01' AND company_id='11111111-1111-1111-1111-111111111111';
  SELECT id INTO v_sbta_145  FROM fleet_vehicles WHERE registration_number='AA-145-SR-01' AND company_id='11111111-1111-1111-1111-111111111111';
  SELECT id INTO v_sbta_1035 FROM fleet_vehicles WHERE registration_number='1035 KZ 02'   AND company_id='11111111-1111-1111-1111-111111111111';

  -- Fetch TST vehicle IDs
  SELECT id INTO v_tst_447  FROM fleet_vehicles WHERE registration_number='AA-447-NR-01' AND company_id='22222222-2222-2222-2222-222222222222';
  SELECT id INTO v_tst_553  FROM fleet_vehicles WHERE registration_number='AA-553-NR-01' AND company_id='22222222-2222-2222-2222-222222222222';
  SELECT id INTO v_tst_416  FROM fleet_vehicles WHERE registration_number='AA-416-AD-01' AND company_id='22222222-2222-2222-2222-222222222222';
  SELECT id INTO v_tst_105  FROM fleet_vehicles WHERE registration_number='AA-105-GL-01' AND company_id='22222222-2222-2222-2222-222222222222';
  SELECT id INTO v_tst_092  FROM fleet_vehicles WHERE registration_number='AA-092-GL-01' AND company_id='22222222-2222-2222-2222-222222222222';
  SELECT id INTO v_tst_218  FROM fleet_vehicles WHERE registration_number='AA-218-AD-01' AND company_id='22222222-2222-2222-2222-222222222222';
  SELECT id INTO v_tst_334  FROM fleet_vehicles WHERE registration_number='AA-334-NR-01' AND company_id='22222222-2222-2222-2222-222222222222';

  -- Fetch ETL vehicle IDs
  SELECT id INTO v_etl_881  FROM fleet_vehicles WHERE registration_number='AA-881-RY-01' AND company_id='33333333-3333-3333-3333-333333333333';
  SELECT id INTO v_etl_774  FROM fleet_vehicles WHERE registration_number='AA-774-GT-01' AND company_id='33333333-3333-3333-3333-333333333333';
  SELECT id INTO v_etl_0450 FROM fleet_vehicles WHERE registration_number='0450 WW 01'   AND company_id='33333333-3333-3333-3333-333333333333';

  -- Fetch G-OUMÉ vehicle IDs
  SELECT id INTO v_go_443   FROM fleet_vehicles WHERE registration_number='AA-443-YL-01' AND company_id='6fb999ff-af36-4b90-acf8-78aeede6c531';
  SELECT id INTO v_go_479   FROM fleet_vehicles WHERE registration_number='AA-479-TB-01' AND company_id='6fb999ff-af36-4b90-acf8-78aeede6c531';
  SELECT id INTO v_go_196   FROM fleet_vehicles WHERE registration_number='AA-196-PT-01' AND company_id='6fb999ff-af36-4b90-acf8-78aeede6c531';
  SELECT id INTO v_go_907   FROM fleet_vehicles WHERE registration_number='AA-907-BF'    AND company_id='6fb999ff-af36-4b90-acf8-78aeede6c531';

  -- Fetch SBTA-BIS/Plongeurs
  SELECT id INTO v_bis_0349 FROM fleet_vehicles WHERE registration_number='0349 WW' AND company_id='849c0639-f7e1-4ee6-a431-e85f9c40e56c';

  -- ── SBTA EXPENSES (total cible: 1 503 000 XOF) ──────────────────────────
  INSERT INTO vehicle_expenses (company_id, vehicle_id, registration_number, expense_date, week_start, category_id, description, supplier, amount) VALUES
    ('11111111-1111-1111-1111-111111111111', v_sbta_266,  'AA-266-GY-05', '2026-04-28', w, c_acc,  'Accident de voiture',                          'Abidjan',  500000),
    ('11111111-1111-1111-1111-111111111111', v_sbta_116,  'AA-116-PT-01', '2026-04-29', w, c_elec, 'Dépannage batterie',                            'Mirador',   80000),
    ('11111111-1111-1111-1111-111111111111', v_sbta_116,  'AA-116-PT-01', '2026-04-29', w, c_mec,  'Dépannage clim',                                'Mirador',   60000),
    ('11111111-1111-1111-1111-111111111111', v_sbta_116,  'AA-116-PT-01', '2026-04-29', w, c_sou,  'Soudure carrosserie',                           'Mirador',   50000),
    ('11111111-1111-1111-1111-111111111111', v_sbta_1487, '1487 LR 02',   '2026-04-30', w, c_mec,  'Dépannage flexible',                            'Divo',     150000),
    ('11111111-1111-1111-1111-111111111111', v_sbta_512,  'AA-512-RL-01', '2026-04-28', w, c_mec,  'Dépannage gaz',                                 'Adzopé',    30500),
    ('11111111-1111-1111-1111-111111111111', v_sbta_512,  'AA-512-RL-01', '2026-04-28', w, c_pneu, 'Collage pneus',                                 'Adzopé',    20000),
    ('11111111-1111-1111-1111-111111111111', v_sbta_952,  'AA-952-BB',    '2026-04-29', w, c_mec,  'Dépannage Intercolis',                          'Alepé',     20000),
    ('11111111-1111-1111-1111-111111111111', v_sbta_952,  'AA-952-BB',    '2026-04-29', w, c_pie,  'Roulement avant',                               'Alepé',     17000),
    ('11111111-1111-1111-1111-111111111111', v_sbta_3772, '3772 KN 02',   '2026-04-30', w, c_pie,  'Croix de cardan',                               'Tiassalé',  35000),
    ('11111111-1111-1111-1111-111111111111', v_sbta_3772, '3772 KN 02',   '2026-04-30', w, c_mec,  'Durite + filtre',                               'Tiassalé',  40000),
    ('11111111-1111-1111-1111-111111111111', v_sbta_203,  'AA-203-GT-08', '2026-05-01', w, c_pie,  'Croix de cardan',                               'Aboisso',   30000),
    ('11111111-1111-1111-1111-111111111111', v_sbta_203,  'AA-203-GT-08', '2026-05-01', w, c_elec, 'Remplacement ampoule',                          'Aboisso',   10000),
    ('11111111-1111-1111-1111-111111111111', v_sbta_371,  'AA-371-KN-01', '2026-04-29', w, c_mec,  'Vidange + révision',                            'Garage SBTA', 85000),
    ('11111111-1111-1111-1111-111111111111', v_sbta_145,  'AA-145-SR-01', '2026-04-30', w, c_mec,  'Dépannage freins',                              'Abidjan',   95000),
    ('11111111-1111-1111-1111-111111111111', v_sbta_1035, '1035 KZ 02',   '2026-05-02', w, c_pneu, 'Achat 2 pneus neufs',                           'Abidjan',   80500);

  -- ── TST EXPENSES (total cible: 528 500 XOF) ─────────────────────────────
  INSERT INTO vehicle_expenses (company_id, vehicle_id, registration_number, expense_date, week_start, category_id, description, supplier, amount) VALUES
    ('22222222-2222-2222-2222-222222222222', v_tst_447, 'AA-447-NR-01', '2026-04-28', w, c_sou,  'Dépannage soudure',                             'Mirador',   35000),
    ('22222222-2222-2222-2222-222222222222', v_tst_447, 'AA-447-NR-01', '2026-04-28', w, c_elec, 'Dépannage électricité',                         'Mirador',   22000),
    ('22222222-2222-2222-2222-222222222222', v_tst_553, 'AA-553-NR-01', '2026-04-29', w, c_mec,  'Dépannage cl',                                  'Abidjan',   30000),
    ('22222222-2222-2222-2222-222222222222', v_tst_553, 'AA-553-NR-01', '2026-04-29', w, c_pie,  'Joint de culasse',                              'Abidjan',   20000),
    ('22222222-2222-2222-2222-222222222222', v_tst_416, 'AA-416-AD-01', '2026-04-30', w, c_mec,  'Dépannage Adzopé',                              'Adzopé',    40000),
    ('22222222-2222-2222-2222-222222222222', v_tst_105, 'AA-105-GL-01', '2026-04-28', w, c_out,  'Achat crique',                                  'Quincaillerie', 22000),
    ('22222222-2222-2222-2222-222222222222', v_tst_105, 'AA-105-GL-01', '2026-04-28', w, c_pie,  'Clé roue + Marx',                               'Quincaillerie', 20000),
    ('22222222-2222-2222-2222-222222222222', v_tst_092, 'AA-092-GL-01', '2026-04-29', w, c_pie,  'Couvre-bouchons joints',                        'Abidjan',   40000),
    ('22222222-2222-2222-2222-222222222222', v_tst_218, 'AA-218-AD-01', '2026-05-01', w, c_mec,  'Vidange moteur',                                'Garage TST',70000),
    ('22222222-2222-2222-2222-222222222222', v_tst_218, 'AA-218-AD-01', '2026-05-01', w, c_hui,  'Huile moteur 5L',                               'Garage TST',18000),
    ('22222222-2222-2222-2222-222222222222', v_tst_334, 'AA-334-NR-01', '2026-04-30', w, c_pneu, 'Collage pneu arrière',                          'Tiassalé',  15000),
    ('22222222-2222-2222-2222-222222222222', v_tst_334, 'AA-334-NR-01', '2026-04-30', w, c_mec,  'Dépannage pompe eau',                           'Tiassalé',  95000),
    ('22222222-2222-2222-2222-222222222222', v_tst_447, 'AA-447-NR-01', '2026-05-02', w, c_rad,  'Lavage radiateur',                              'Abidjan',   25000),
    ('22222222-2222-2222-2222-222222222222', v_tst_416, 'AA-416-AD-01', '2026-05-02', w, c_mec,  'Dépannage boîte de vitesse',                    'Adzopé',    86500);

  -- ── ETL EXPENSES (total cible: 83 500 XOF) ──────────────────────────────
  INSERT INTO vehicle_expenses (company_id, vehicle_id, registration_number, expense_date, week_start, category_id, description, supplier, amount) VALUES
    ('33333333-3333-3333-3333-333333333333', v_etl_881,  'AA-881-RY-01', '2026-04-28', w, c_pie,  'Achat clé roue + Marx',                         'Quincaillerie', 18000),
    ('33333333-3333-3333-3333-333333333333', v_etl_881,  'AA-881-RY-01', '2026-04-29', w, c_mec,  'Dépannage plaque-boulon',                       'Adzopé',    20000),
    ('33333333-3333-3333-3333-333333333333', v_etl_881,  'AA-881-RY-01', '2026-04-29', w, c_rad,  'Lavage radiateur',                              'Adzopé',    10000),
    ('33333333-3333-3333-3333-333333333333', v_etl_774,  'AA-774-GT-01', '2026-04-30', w, c_elec, 'Dépannage électricité',                         'Abidjan',    8000),
    ('33333333-3333-3333-3333-333333333333', v_etl_774,  'AA-774-GT-01', '2026-04-30', w, c_mec,  'Roulement',                                     'Abidjan',   10000),
    ('33333333-3333-3333-3333-333333333333', v_etl_0450, '0450 WW 01',   '2026-05-01', w, c_mec,  'Dépannage filtre',                              'Divo',       9000),
    ('33333333-3333-3333-3333-333333333333', v_etl_881,  'AA-881-RY-01', '2026-05-02', w, c_hui,  'Achat huile moteur',                            'Abidjan',    8500);

  -- ── G-OUMÉ EXPENSES (total cible: 135 000 XOF) ──────────────────────────
  INSERT INTO vehicle_expenses (company_id, vehicle_id, registration_number, expense_date, week_start, category_id, description, supplier, amount) VALUES
    ('6fb999ff-af36-4b90-acf8-78aeede6c531', v_go_443, 'AA-443-YL-01', '2026-04-28', w, c_out,  'Achat crique',                                  'Quincaillerie', 25000),
    ('6fb999ff-af36-4b90-acf8-78aeede6c531', v_go_479, 'AA-479-TB-01', '2026-04-29', w, c_acc,  'Arrangement accrochage carrosserie',            'Carrossier',20000),
    ('6fb999ff-af36-4b90-acf8-78aeede6c531', v_go_196, 'AA-196-PT-01', '2026-04-30', w, c_mec,  'Dépannage ballon',                              'Mirador',   20000),
    ('6fb999ff-af36-4b90-acf8-78aeede6c531', v_go_907, 'AA-907-BF',    '2026-05-01', w, c_hui,  'Dépannage filtre à huile',                      'Abidjan',   20000),
    ('6fb999ff-af36-4b90-acf8-78aeede6c531', v_go_443, 'AA-443-YL-01', '2026-05-01', w, c_mec,  'Vidange + dépannage freins',                    'Garage',    30000),
    ('6fb999ff-af36-4b90-acf8-78aeede6c531', v_go_196, 'AA-196-PT-01', '2026-05-02', w, c_elec, 'Dépannage alternateur',                         'Abidjan',   20000);

  -- ── PLONGEURS / SBTA-BIS (total: 47 000 XOF) ────────────────────────────
  INSERT INTO vehicle_expenses (company_id, vehicle_id, registration_number, expense_date, week_start, category_id, description, supplier, amount) VALUES
    ('849c0639-f7e1-4ee6-a431-e85f9c40e56c', v_bis_0349, '0349 WW', '2026-04-29', w, c_out,  'Achat crique + clé de roue + Marx',             'Quincaillerie', 30000),
    ('849c0639-f7e1-4ee6-a431-e85f9c40e56c', v_bis_0349, '0349 WW', '2026-04-29', w, c_pie,  'Tuyau flexible',                                'Abidjan',   17000);

END $$;
