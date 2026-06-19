/*
  # Seed: Mouvements de stock et bons de commande pièces

  - spare_parts_stock_movements: entrées (réception commandes), sorties (utilisation OT), ajustements
  - spare_parts_purchase_orders: commandes passées auprès des fournisseurs
    Statuts valides: en_attente, validee, livree, annulee (à vérifier via check constraint)
*/

-- =============================================
-- MOUVEMENTS DE STOCK
-- =============================================
INSERT INTO spare_parts_stock_movements (id, part_id, movement_type, quantity, reference_type, reference_id, notes, performed_by, created_at)
VALUES
  -- Entrées stock (réceptions)
  (gen_random_uuid(), '93a4bc88-56b9-4365-924a-3b098193ce81'::uuid, 'entree', 20, 'commande', NULL, 'Réception commande janvier – Filtres huile', 'a3add3f0-5797-450f-bf0f-d1b9f0d781e7'::uuid, NOW() - INTERVAL '75 days'),
  (gen_random_uuid(), 'b1ee54d6-ca13-48ed-9b60-32c30eee1cb3'::uuid, 'entree', 15, 'commande', NULL, 'Réception commande janvier – Filtres air', 'a3add3f0-5797-450f-bf0f-d1b9f0d781e7'::uuid, NOW() - INTERVAL '75 days'),
  (gen_random_uuid(), '2ae90006-7842-4bee-a1c4-34248023ab3d'::uuid, 'entree', 30, 'commande', NULL, 'Réception huile moteur 15W40', 'a3add3f0-5797-450f-bf0f-d1b9f0d781e7'::uuid, NOW() - INTERVAL '70 days'),
  (gen_random_uuid(), '98ea5435-82d5-4a9c-93b6-3047ef3dd346'::uuid, 'entree', 4, 'commande', NULL, 'Réception batteries démarrage', 'a3add3f0-5797-450f-bf0f-d1b9f0d781e7'::uuid, NOW() - INTERVAL '65 days'),
  (gen_random_uuid(), '5d751182-6dd3-4f27-b2d4-4944bba63f46'::uuid, 'entree', 6, 'commande', NULL, 'Réception pneus 315/80', 'a3add3f0-5797-450f-bf0f-d1b9f0d781e7'::uuid, NOW() - INTERVAL '60 days'),
  (gen_random_uuid(), '618915c1-4e61-4d74-8e06-c979763ee50e'::uuid, 'entree', 12, 'commande', NULL, 'Réception plaquettes frein avant', 'a3add3f0-5797-450f-bf0f-d1b9f0d781e7'::uuid, NOW() - INTERVAL '55 days'),
  (gen_random_uuid(), 'e621ebeb-32f3-4be0-a0b3-982bb5dd3abd'::uuid, 'entree', 2, 'commande', NULL, 'Réception kits embrayage', 'a3add3f0-5797-450f-bf0f-d1b9f0d781e7'::uuid, NOW() - INTERVAL '50 days'),
  (gen_random_uuid(), '160551bb-41ea-47de-99c2-81c6b7238b2e'::uuid, 'entree', 20, 'commande', NULL, 'Réception liquides refroidissement', 'a3add3f0-5797-450f-bf0f-d1b9f0d781e7'::uuid, NOW() - INTERVAL '45 days'),
  -- Sorties stock (utilisations OT)
  (gen_random_uuid(), '93a4bc88-56b9-4365-924a-3b098193ce81'::uuid, 'sortie', 3, 'ot', 'ac000001-0000-0000-0001-000000000001'::uuid, 'Utilisé OT-2026-001 – vidange AB-1234-CI', 'a3c08153-6711-48f3-b34a-0797ad1af345'::uuid, NOW() - INTERVAL '56 days'),
  (gen_random_uuid(), '2ae90006-7842-4bee-a1c4-34248023ab3d'::uuid, 'sortie', 2, 'ot', 'ac000001-0000-0000-0001-000000000001'::uuid, 'Huile moteur OT-2026-001', 'a3c08153-6711-48f3-b34a-0797ad1af345'::uuid, NOW() - INTERVAL '56 days'),
  (gen_random_uuid(), '98ea5435-82d5-4a9c-93b6-3047ef3dd346'::uuid, 'sortie', 1, 'ot', 'ac000001-0000-0000-0001-000000000002'::uuid, 'Batterie OT-2026-002 – AB-1235-CI', 'a3c08153-6711-48f3-b34a-0797ad1af345'::uuid, NOW() - INTERVAL '43 days'),
  (gen_random_uuid(), '5d751182-6dd3-4f27-b2d4-4944bba63f46'::uuid, 'sortie', 1, 'ot', 'ac000001-0000-0000-0001-000000000003'::uuid, 'Pneu OT-2026-003 – AB-2001-CI', 'a3c08153-6711-48f3-b34a-0797ad1af345'::uuid, NOW() - INTERVAL '37 days'),
  (gen_random_uuid(), '618915c1-4e61-4d74-8e06-c979763ee50e'::uuid, 'sortie', 2, 'ot', 'ac000001-0000-0000-0001-000000000004'::uuid, 'Plaquettes frein OT-2026-004', 'a3c08153-6711-48f3-b34a-0797ad1af345'::uuid, NOW() - INTERVAL '27 days'),
  (gen_random_uuid(), 'c960415b-e665-48a0-9a04-33c328ebd28d'::uuid, 'sortie', 2, 'ot', 'ac000001-0000-0000-0001-000000000012'::uuid, 'Disques frein OT-2026-012 – AB-3103-CI', 'a3c08153-6711-48f3-b34a-0797ad1af345'::uuid, NOW() - INTERVAL '25 days'),
  (gen_random_uuid(), '51ab64ff-0e86-4dfc-84ea-f04166b748ed'::uuid, 'sortie', 1, 'ot', 'ac000001-0000-0000-0001-000000000012'::uuid, 'Plaquettes arrière OT-2026-012', 'a3c08153-6711-48f3-b34a-0797ad1af345'::uuid, NOW() - INTERVAL '25 days'),
  (gen_random_uuid(), 'e621ebeb-32f3-4be0-a0b3-982bb5dd3abd'::uuid, 'sortie', 1, 'ot', 'ac000001-0000-0000-0001-000000000006'::uuid, 'Kit embrayage OT-2026-006 – AB-1236-CI', 'a3c08153-6711-48f3-b34a-0797ad1af345'::uuid, NOW() - INTERVAL '2 days'),
  (gen_random_uuid(), '93a4bc88-56b9-4365-924a-3b098193ce81'::uuid, 'sortie', 2, 'ot', 'ac000001-0000-0000-0001-000000000011'::uuid, 'Filtres huile OT-2026-011', 'a3c08153-6711-48f3-b34a-0797ad1af345'::uuid, NOW() - INTERVAL '15 days'),
  (gen_random_uuid(), 'b1ee54d6-ca13-48ed-9b60-32c30eee1cb3'::uuid, 'sortie', 1, 'ot', 'ac000001-0000-0000-0001-000000000011'::uuid, 'Filtre air OT-2026-011', 'a3c08153-6711-48f3-b34a-0797ad1af345'::uuid, NOW() - INTERVAL '15 days'),
  -- Ajustement inventaire
  (gen_random_uuid(), 'e7ad5398-f662-4d33-910e-8ed6d2d6d3ec'::uuid, 'ajustement', -1, 'inventaire', NULL, 'Ajustement inventaire – thermostat introuvable', 'a3add3f0-5797-450f-bf0f-d1b9f0d781e7'::uuid, NOW() - INTERVAL '20 days'),
  (gen_random_uuid(), '48829f1a-8c18-4a5d-b25d-6df47c605d31'::uuid, 'ajustement', -1, 'inventaire', NULL, 'Ajustement inventaire – phare LED cassé', 'a3add3f0-5797-450f-bf0f-d1b9f0d781e7'::uuid, NOW() - INTERVAL '10 days');

-- =============================================
-- BONS DE COMMANDE PIÈCES
-- =============================================
INSERT INTO spare_parts_purchase_orders (id, order_number, supplier_id, order_date, expected_delivery_date, total_amount, status, items, created_by, validated_by, created_at)
VALUES
  (gen_random_uuid(), 'BC-2026-001', 'f1100000-0000-0000-0000-000000000001'::uuid, '2026-01-15', '2026-01-22', 520000, 'livree',
   '[{"part_number":"FIL-HUI-001","name":"Filtre à huile moteur","quantity":20,"unit_price":8500,"total":170000},{"part_number":"FIL-AIR-001","name":"Filtre à air","quantity":15,"unit_price":12000,"total":180000},{"part_number":"LIQ-REF-5L","name":"Liquide refroidissement","quantity":10,"unit_price":18000,"total":180000}]',
   'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid, '769d5777-7c1d-4beb-b1ae-bb27a0c01429'::uuid, NOW() - INTERVAL '76 days'),
  (gen_random_uuid(), 'BC-2026-002', 'f1100000-0000-0000-0000-000000000003'::uuid, '2026-01-20', '2026-01-28', 840000, 'livree',
   '[{"part_number":"HUI-MOT-15W","name":"Huile moteur 15W40","quantity":30,"unit_price":22000,"total":660000},{"part_number":"HUI-BTE-001","name":"Huile boîte vitesses","quantity":6,"unit_price":28000,"total":168000},{"part_number":"LIQ-REF-5L","name":"Liquide refroidissement","quantity":0,"unit_price":18000,"total":0}]',
   'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid, '769d5777-7c1d-4beb-b1ae-bb27a0c01429'::uuid, NOW() - INTERVAL '71 days'),
  (gen_random_uuid(), 'BC-2026-003', 'f1100000-0000-0000-0000-000000000004'::uuid, '2026-02-01', '2026-02-10', 1380000, 'livree',
   '[{"part_number":"PNE-315-80","name":"Pneu 315/80 R22.5","quantity":6,"unit_price":180000,"total":1080000},{"part_number":"PNE-275-70","name":"Pneu 275/70 R22.5","quantity":2,"unit_price":155000,"total":310000}]',
   'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid, '1019298d-f43e-4aed-95be-e376e272f043'::uuid, NOW() - INTERVAL '61 days'),
  (gen_random_uuid(), 'BC-2026-004', 'f1100000-0000-0000-0000-000000000002'::uuid, '2026-02-15', '2026-02-22', 906000, 'livree',
   '[{"part_number":"PLQ-FRN-AV","name":"Plaquettes frein avant","quantity":12,"unit_price":45000,"total":540000},{"part_number":"PLQ-FRN-AR","name":"Plaquettes frein arrière","quantity":6,"unit_price":38000,"total":228000},{"part_number":"EMB-001","name":"Kit embrayage","quantity":2,"unit_price":320000,"total":0}]',
   'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid, '769d5777-7c1d-4beb-b1ae-bb27a0c01429'::uuid, NOW() - INTERVAL '51 days'),
  (gen_random_uuid(), 'BC-2026-005', 'f1100000-0000-0000-0000-000000000005'::uuid, '2026-03-05', '2026-03-15', 570000, 'livree',
   '[{"part_number":"BAT-12V-200","name":"Batterie 12V 200Ah","quantity":4,"unit_price":95000,"total":380000},{"part_number":"ALT-24V-001","name":"Alternateur 24V","quantity":1,"unit_price":120000,"total":120000},{"part_number":"DEM-24V-001","name":"Démarreur 24V","quantity":1,"unit_price":95000,"total":95000}]',
   'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid, '6e1f72a0-c1ed-4d58-aae7-95fb23a902a4'::uuid, NOW() - INTERVAL '42 days'),
  (gen_random_uuid(), 'BC-2026-006', 'f1100000-0000-0000-0000-000000000004'::uuid, '2026-03-20', '2026-03-28', 660000, 'livree',
   '[{"part_number":"AMS-AVG","name":"Amortisseur avant gauche","quantity":2,"unit_price":110000,"total":220000},{"part_number":"AMS-AVD","name":"Amortisseur avant droit","quantity":2,"unit_price":110000,"total":220000},{"part_number":"DIS-FRN-AV","name":"Disque frein avant","quantity":2,"unit_price":85000,"total":0}]',
   'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid, '1019298d-f43e-4aed-95be-e376e272f043'::uuid, NOW() - INTERVAL '27 days'),
  -- En cours / en attente
  (gen_random_uuid(), 'BC-2026-007', 'f1100000-0000-0000-0000-000000000001'::uuid, '2026-04-10', '2026-04-20', 425000, 'validee',
   '[{"part_number":"FIL-HUI-001","name":"Filtre à huile","quantity":25,"unit_price":8500,"total":212500},{"part_number":"FIL-CAR-001","name":"Filtre carburant","quantity":10,"unit_price":9500,"total":95000},{"part_number":"THM-001","name":"Thermostat moteur","quantity":5,"unit_price":15000,"total":75000}]',
   'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid, '769d5777-7c1d-4beb-b1ae-bb27a0c01429'::uuid, NOW() - INTERVAL '6 days'),
  (gen_random_uuid(), 'BC-2026-008', 'f1100000-0000-0000-0000-000000000005'::uuid, '2026-04-14', '2026-04-25', 390000, 'en_attente',
   '[{"part_number":"LMP-LED-AV","name":"Phare LED avant","quantity":4,"unit_price":65000,"total":260000},{"part_number":"BAT-12V-200","name":"Batterie 12V","quantity":1,"unit_price":95000,"total":95000}]',
   'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid, NULL, NOW() - INTERVAL '2 days');
