/*
  # Seed comptable stock items for TST, ETL, SNT

  Inserts all stock articles from the provided image into comptable_stock_items
  for each of the three companies: TST, ETL, SNT.

  Articles:
  - COLLE BOSTIK, stock_initial=21, prix_unitaire=3000
  - COLLE AB, stock_initial=23, prix_unitaire=1000
  - HUILE DE FREIN, stock_initial=23, prix_unitaire=2500
  - VENTILATEUR, stock_initial=19, prix_unitaire=23000
  - EVAPO, stock_initial=27, prix_unitaire=23000
  - COLLE AB-ANCIENT, stock_initial=7, prix_unitaire=1000
  - COLLE AB NOUVEAU, stock_initial=23, prix_unitaire=1000
  - HUILE DE COMPRESSEUR, stock_initial=21, prix_unitaire=4750
  - COURROIRE 2AVX1025, stock_initial=4, prix_unitaire=12000
  - GAZ, stock_initial=9, prix_unitaire=80000
  - COURROIRE 2AVX1750, stock_initial=5, prix_unitaire=20000
  - COURROIRE 2AV13X975, stock_initial=5, prix_unitaire=12000
  - COURROIRE 15X1125, stock_initial=5, prix_unitaire=14000
  - COURROIRE 13X12X75, stock_initial=10, prix_unitaire=7000
  - CURROIRE 2AV15X2020, stock_initial=5, prix_unitaire=20000
  - COURROIRE 2AV13X975, stock_initial=5, prix_unitaire=12000
  - COURROIRE 2AV 13X975, stock_initial=5, prix_unitaire=12000
  - COURROIRE 2AV15X1570, stock_initial=5, prix_unitaire=20000
  - COURROIRE 15X1300, stock_initial=10, prix_unitaire=7000

  All stock_min = 0 (not specified in image).
  Inserted for TST, ETL, SNT separately.
*/

DO $$
DECLARE
  v_tst uuid := '22222222-2222-2222-2222-222222222222';
  v_etl uuid := '33333333-3333-3333-3333-333333333333';
  v_snt uuid := 'fad1e234-2fec-437a-a00a-d152208403ad';

  articles JSONB := '[
    {"designation": "COLLE BOSTIK",         "stock_initial": 21, "prix_unitaire": 3000},
    {"designation": "COLLE AB",             "stock_initial": 23, "prix_unitaire": 1000},
    {"designation": "HUILE DE FREIN",       "stock_initial": 23, "prix_unitaire": 2500},
    {"designation": "VENTILATEUR",          "stock_initial": 19, "prix_unitaire": 23000},
    {"designation": "EVAPO",               "stock_initial": 27, "prix_unitaire": 23000},
    {"designation": "COLLE AB-ANCIENT",     "stock_initial": 7,  "prix_unitaire": 1000},
    {"designation": "COLLE AB NOUVEAU",     "stock_initial": 23, "prix_unitaire": 1000},
    {"designation": "HUILE DE COMPRESSEUR", "stock_initial": 21, "prix_unitaire": 4750},
    {"designation": "COURROIRE 2AVX1025",   "stock_initial": 4,  "prix_unitaire": 12000},
    {"designation": "GAZ",                 "stock_initial": 9,  "prix_unitaire": 80000},
    {"designation": "COURROIRE 2AVX1750",   "stock_initial": 5,  "prix_unitaire": 20000},
    {"designation": "COURROIRE 2AV13X975",  "stock_initial": 5,  "prix_unitaire": 12000},
    {"designation": "COURROIRE 15X1125",    "stock_initial": 5,  "prix_unitaire": 14000},
    {"designation": "COURROIRE 13X12X75",   "stock_initial": 10, "prix_unitaire": 7000},
    {"designation": "CURROIRE 2AV15X2020",  "stock_initial": 5,  "prix_unitaire": 20000},
    {"designation": "COURROIRE 2AV13X975 B","stock_initial": 5,  "prix_unitaire": 12000},
    {"designation": "COURROIRE 2AV 13X975", "stock_initial": 5,  "prix_unitaire": 12000},
    {"designation": "COURROIRE 2AV15X1570", "stock_initial": 5,  "prix_unitaire": 20000},
    {"designation": "COURROIRE 15X1300",    "stock_initial": 10, "prix_unitaire": 7000}
  ]';

  art JSONB;
  company_id uuid;
BEGIN
  FOREACH company_id IN ARRAY ARRAY[v_tst, v_etl, v_snt]
  LOOP
    FOR art IN SELECT * FROM jsonb_array_elements(articles)
    LOOP
      INSERT INTO comptable_stock_items (
        company_id,
        designation,
        code_article,
        stock_min,
        stock_initial,
        prix_unitaire,
        created_at,
        updated_at
      )
      VALUES (
        company_id,
        (art->>'designation'),
        NULL,
        0,
        (art->>'stock_initial')::int,
        (art->>'prix_unitaire')::int,
        now(),
        now()
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
