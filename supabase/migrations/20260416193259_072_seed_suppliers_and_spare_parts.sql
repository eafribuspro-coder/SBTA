/*
  # Seed: Fournisseurs et pièces détachées

  Insère des fournisseurs de pièces et un catalogue complet de pièces détachées
  avec niveaux de stock réalistes pour les rapports et alertes.
*/

-- Fournisseurs
INSERT INTO spare_parts_suppliers (id, name, contact_person, phone, email, address, is_active)
VALUES
  ('f1100000-0000-0000-0000-000000000001'::uuid, 'AutoParts CI', 'Kouadio Mensah', '+225 27 22 41 00 01', 'contact@autoparts-ci.com', 'Zone Industrielle de Yopougon, Abidjan', true),
  ('f1100000-0000-0000-0000-000000000002'::uuid, 'CFAO Motors', 'Adjoua Brou', '+225 27 22 42 00 02', 'pieces@cfao.ci', 'Rue du Commerce, Plateau, Abidjan', true),
  ('f1100000-0000-0000-0000-000000000003'::uuid, 'Ivoir Diesel', 'Souleymane Koné', '+225 27 22 43 00 03', 'diesel@ivoirdiesel.ci', 'Marcory, Abidjan', true),
  ('f1100000-0000-0000-0000-000000000004'::uuid, 'Trans-Équip', 'Fatou Diallo', '+225 27 22 44 00 04', 'info@transequip.ci', 'Treichville, Abidjan', true),
  ('f1100000-0000-0000-0000-000000000005'::uuid, 'Mécano Plus', 'Amadou Touré', '+225 27 22 45 00 05', 'vente@mecanoplus.ci', 'Adjamé, Abidjan', true)
ON CONFLICT (id) DO NOTHING;

-- Pièces détachées
INSERT INTO spare_parts (id, part_number, name, description, category, unit_price, stock_quantity, min_stock_level, location, supplier_id)
VALUES
  (gen_random_uuid(), 'FIL-HUI-001', 'Filtre à huile moteur', 'Filtre à huile compatible Mercedes/Iveco', 'Filtration', 8500, 45, 10, 'Rayon A1', 'f1100000-0000-0000-0000-000000000001'::uuid),
  (gen_random_uuid(), 'FIL-AIR-001', 'Filtre à air', 'Filtre à air haute performance', 'Filtration', 12000, 30, 8, 'Rayon A1', 'f1100000-0000-0000-0000-000000000001'::uuid),
  (gen_random_uuid(), 'FIL-CAR-001', 'Filtre à carburant', 'Filtre gasoil 10 microns', 'Filtration', 9500, 28, 8, 'Rayon A2', 'f1100000-0000-0000-0000-000000000002'::uuid),
  (gen_random_uuid(), 'HUI-MOT-15W', 'Huile moteur 15W40 (5L)', 'Huile minérale diesel 15W40', 'Lubrifiants', 22000, 60, 15, 'Rayon B1', 'f1100000-0000-0000-0000-000000000003'::uuid),
  (gen_random_uuid(), 'HUI-BTE-001', 'Huile boîte de vitesses (5L)', 'Huile ATF pour boîte auto', 'Lubrifiants', 28000, 20, 6, 'Rayon B1', 'f1100000-0000-0000-0000-000000000003'::uuid),
  (gen_random_uuid(), 'PLQ-FRN-AV', 'Plaquettes de frein avant', 'Kit 4 plaquettes avant céramique', 'Freinage', 45000, 24, 8, 'Rayon C1', 'f1100000-0000-0000-0000-000000000002'::uuid),
  (gen_random_uuid(), 'PLQ-FRN-AR', 'Plaquettes de frein arrière', 'Kit 4 plaquettes arrière semi-métal', 'Freinage', 38000, 18, 6, 'Rayon C1', 'f1100000-0000-0000-0000-000000000002'::uuid),
  (gen_random_uuid(), 'DIS-FRN-AV', 'Disque de frein avant', 'Disque ventilé 320mm', 'Freinage', 85000, 8, 4, 'Rayon C2', 'f1100000-0000-0000-0000-000000000004'::uuid),
  (gen_random_uuid(), 'PNE-315-80', 'Pneu 315/80 R22.5', 'Pneu route/autoroute bus', 'Pneumatiques', 180000, 12, 6, 'Rayon D1', 'f1100000-0000-0000-0000-000000000004'::uuid),
  (gen_random_uuid(), 'PNE-275-70', 'Pneu 275/70 R22.5', 'Pneu polyvalent bus urbain', 'Pneumatiques', 155000, 16, 6, 'Rayon D1', 'f1100000-0000-0000-0000-000000000004'::uuid),
  (gen_random_uuid(), 'BAT-12V-200', 'Batterie 12V 200Ah', 'Batterie démarrage lourds véhicules', 'Électricité', 95000, 6, 3, 'Rayon E1', 'f1100000-0000-0000-0000-000000000005'::uuid),
  (gen_random_uuid(), 'ALT-24V-001', 'Alternateur 24V', 'Alternateur reconditionné 90A', 'Électricité', 120000, 4, 2, 'Rayon E2', 'f1100000-0000-0000-0000-000000000005'::uuid),
  (gen_random_uuid(), 'DEM-24V-001', 'Démarreur 24V', 'Démarreur 4kW reconditionné', 'Électricité', 95000, 3, 2, 'Rayon E2', 'f1100000-0000-0000-0000-000000000005'::uuid),
  (gen_random_uuid(), 'LIQ-REF-5L', 'Liquide de refroidissement (5L)', 'Antigel concentré -40°C', 'Refroidissement', 18000, 40, 10, 'Rayon B2', 'f1100000-0000-0000-0000-000000000003'::uuid),
  (gen_random_uuid(), 'THM-001', 'Thermostat moteur', 'Thermostat 83°C universel', 'Refroidissement', 15000, 2, 4, 'Rayon B2', 'f1100000-0000-0000-0000-000000000001'::uuid),
  (gen_random_uuid(), 'EMB-001', 'Kit embrayage complet', 'Disque + plateau + butée', 'Transmission', 320000, 3, 2, 'Rayon F1', 'f1100000-0000-0000-0000-000000000002'::uuid),
  (gen_random_uuid(), 'CRD-001', 'Cardans prise de force', 'Cardan universel renforcé', 'Transmission', 75000, 5, 2, 'Rayon F1', 'f1100000-0000-0000-0000-000000000004'::uuid),
  (gen_random_uuid(), 'AMS-AVG', 'Amortisseur avant gauche', 'Amortisseur gaz', 'Suspension', 110000, 4, 2, 'Rayon G1', 'f1100000-0000-0000-0000-000000000004'::uuid),
  (gen_random_uuid(), 'AMS-AVD', 'Amortisseur avant droit', 'Amortisseur gaz', 'Suspension', 110000, 4, 2, 'Rayon G1', 'f1100000-0000-0000-0000-000000000004'::uuid),
  (gen_random_uuid(), 'LMP-LED-AV', 'Phare LED avant', 'Phare complet LED homologué', 'Éclairage', 65000, 1, 2, 'Rayon H1', 'f1100000-0000-0000-0000-000000000005'::uuid);
