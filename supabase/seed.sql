/*
  # SBTA Platform - Seed Data

  Données de démonstration pour la plateforme SBTA
  - 3 sociétés de transport
  - 15 villes en Côte d'Ivoire
  - 5 configurations de sièges
  - 20 bus répartis sur les sociétés
  - 12 itinéraires avec distances et prix réels
  - Personnel HOLDING (30+ utilisateurs)
  - 30 clients avec programmes fidélité
  - 50 réservations
  - Données opérationnelles (carburant, maintenance, évaluations)
*/

-- ============================================
-- 1. SOCIÉTÉS (3)
-- ============================================
INSERT INTO companies (id, name, legal_name, tax_id, address, phone, email, logo_url) VALUES
('11111111-1111-1111-1111-111111111111', 'SBTA Express', 'SBTA Express SARL', 'CI-TAX-001', 'Boulevard Latrille, Abidjan', '+225 27 20 21 22 23', 'express@sbta.ci', NULL),
('22222222-2222-2222-2222-222222222222', 'SBTA Premium', 'SBTA Premium SA', 'CI-TAX-002', 'Zone 4, Marcory, Abidjan', '+225 27 20 21 22 24', 'premium@sbta.ci', NULL),
('33333333-3333-3333-3333-333333333333', 'SBTA Regional', 'SBTA Regional SARL', 'CI-TAX-003', 'Adjamé Liberté, Abidjan', '+225 27 20 21 22 25', 'regional@sbta.ci', NULL);

-- ============================================
-- 2. VILLES (15) avec coordonnées GPS réelles
-- ============================================
INSERT INTO cities (name, latitude, longitude, region) VALUES
('Abidjan', 5.354, -4.004, 'Abidjan'),
('Yamoussoukro', 6.820, -5.274, 'Yamoussoukro'),
('Bouaké', 7.690, -5.030, 'Vallée du Bandama'),
('San-Pédro', 4.749, -6.636, 'Bas-Sassandra'),
('Korhogo', 9.458, -5.629, 'Savanes'),
('Man', 7.412, -7.554, 'Montagnes'),
('Daloa', 6.877, -6.450, 'Sassandra-Marahoué'),
('Gagnoa', 6.132, -5.951, 'Gôh-Djiboua'),
('Abengourou', 6.729, -3.496, 'Comoé'),
('Divo', 5.837, -5.357, 'Lôh-Djiboua'),
('Bondoukou', 8.040, -2.800, 'Zanzan'),
('Odienné', 9.510, -7.564, 'Denguélé'),
('Séguéla', 7.960, -6.672, 'Woroba'),
('Touba', 8.283, -7.685, 'Bafing'),
('Soubré', 5.789, -6.590, 'Bas-Sassandra');

-- ============================================
-- 3. CONFIGURATIONS DE SIÈGES (5)
-- ============================================
INSERT INTO seat_configs (id, name, total_seats, rows, columns, layout_type, layout_data, created_at) VALUES
('aa111111-1111-1111-1111-111111111111', 'Standard 49 places (2+2)', 49, 13, 4, '2+2', '{"aisles": [2]}', NOW()),
('aa222222-2222-2222-2222-222222222222', 'VIP 39 places (2+1)', 39, 13, 3, '2+1', '{"aisles": [2]}', NOW()),
('aa333333-3333-3333-3333-333333333333', 'Executive 30 places (1+1)', 30, 15, 2, '1+1', '{"aisles": [1]}', NOW()),
('aa444444-4444-4444-4444-444444444444', 'Mini-bus 22 places (2+2)', 22, 6, 4, '2+2', '{"aisles": [2]}', NOW()),
('aa555555-5555-5555-5555-555555555555', 'Grande capacité 65 places', 65, 17, 4, '2+2', '{"aisles": [2]}', NOW());

-- ============================================
-- 4. BUS (20) répartis sur les 3 sociétés
-- ============================================
INSERT INTO buses (id, license_plate, model, manufacturer, year, capacity, fuel_type, status, company_id, seat_config_id, purchase_date, insurance_expiry, technical_visit_expiry, mileage, fuel_capacity) VALUES
-- SBTA Express (8 bus)
('b1111111-1111-1111-1111-111111111111', 'AB-1234-CI', 'Isuzu Journey', 'Isuzu', 2022, 49, 'diesel', 'disponible', '11111111-1111-1111-1111-111111111111', 'aa111111-1111-1111-1111-111111111111', '2022-01-15', '2025-01-15', '2025-01-15', 45000, 200),
('b1111111-1111-1111-1111-111111111112', 'AB-1235-CI', 'Isuzu Journey', 'Isuzu', 2022, 49, 'diesel', 'disponible', '11111111-1111-1111-1111-111111111111', 'aa111111-1111-1111-1111-111111111111', '2022-02-20', '2025-02-20', '2025-02-20', 42000, 200),
('b1111111-1111-1111-1111-111111111113', 'AB-1236-CI', 'Mercedes-Benz Sprinter', 'Mercedes-Benz', 2023, 22, 'diesel', 'disponible', '11111111-1111-1111-1111-111111111111', 'aa444444-4444-4444-4444-444444444444', '2023-03-10', '2026-03-10', '2026-03-10', 28000, 120),
('b1111111-1111-1111-1111-111111111114', 'AB-1237-CI', 'Isuzu Journey', 'Isuzu', 2021, 49, 'diesel', 'disponible', '11111111-1111-1111-1111-111111111111', 'aa111111-1111-1111-1111-111111111111', '2021-06-01', '2024-06-01', '2024-12-01', 68000, 200),
('b1111111-1111-1111-1111-111111111115', 'AB-1238-CI', 'Yutong ZK6127H', 'Yutong', 2023, 49, 'diesel', 'disponible', '11111111-1111-1111-1111-111111111111', 'aa111111-1111-1111-1111-111111111111', '2023-08-15', '2026-08-15', '2026-08-15', 15000, 220),
('b1111111-1111-1111-1111-111111111116', 'AB-1239-CI', 'Yutong ZK6127H', 'Yutong', 2023, 49, 'diesel', 'en_maintenance', '11111111-1111-1111-1111-111111111111', 'aa111111-1111-1111-1111-111111111111', '2023-09-01', '2026-09-01', '2026-09-01', 12000, 220),
('b1111111-1111-1111-1111-111111111117', 'AB-1240-CI', 'Isuzu Journey', 'Isuzu', 2022, 49, 'diesel', 'disponible', '11111111-1111-1111-1111-111111111111', 'aa111111-1111-1111-1111-111111111111', '2022-11-20', '2025-11-20', '2025-11-20', 38000, 200),
('b1111111-1111-1111-1111-111111111118', 'AB-1241-CI', 'Mercedes-Benz Sprinter', 'Mercedes-Benz', 2024, 22, 'diesel', 'disponible', '11111111-1111-1111-1111-111111111111', 'aa444444-4444-4444-4444-444444444444', '2024-01-10', '2027-01-10', '2027-01-10', 8000, 120),

-- SBTA Premium (7 bus VIP/Executive)
('b2222222-2222-2222-2222-222222222221', 'AB-2001-CI', 'Scania Touring', 'Scania', 2023, 39, 'diesel', 'disponible', '22222222-2222-2222-2222-222222222222', 'aa222222-2222-2222-2222-222222222222', '2023-02-01', '2026-02-01', '2026-02-01', 25000, 250),
('b2222222-2222-2222-2222-222222222222', 'AB-2002-CI', 'Scania Touring', 'Scania', 2023, 39, 'diesel', 'disponible', '22222222-2222-2222-2222-222222222222', 'aa222222-2222-2222-2222-222222222222', '2023-03-15', '2026-03-15', '2026-03-15', 22000, 250),
('b2222222-2222-2222-2222-222222222223', 'AB-2003-CI', 'Mercedes-Benz Tourismo', 'Mercedes-Benz', 2024, 30, 'diesel', 'disponible', '22222222-2222-2222-2222-222222222222', 'aa333333-3333-3333-3333-333333333333', '2024-01-20', '2027-01-20', '2027-01-20', 10000, 280),
('b2222222-2222-2222-2222-222222222224', 'AB-2004-CI', 'Mercedes-Benz Tourismo', 'Mercedes-Benz', 2024, 30, 'diesel', 'disponible', '22222222-2222-2222-2222-222222222222', 'aa333333-3333-3333-3333-333333333333', '2024-02-10', '2027-02-10', '2027-02-10', 8500, 280),
('b2222222-2222-2222-2222-222222222225', 'AB-2005-CI', 'Scania Touring', 'Scania', 2022, 39, 'diesel', 'disponible', '22222222-2222-2222-2222-222222222222', 'aa222222-2222-2222-2222-222222222222', '2022-08-01', '2025-08-01', '2025-08-01', 48000, 250),
('b2222222-2222-2222-2222-222222222226', 'AB-2006-CI', 'Scania Touring', 'Scania', 'disponible', '22222222-2222-2222-2222-222222222222', 'aa222222-2222-2222-2222-222222222222', '2023-06-15', '2026-06-15', '2026-06-15', 30000, 250),
('b2222222-2222-2222-2222-222222222227', 'AB-2007-CI', 'Mercedes-Benz Tourismo', 'Mercedes-Benz', 2023, 30, 'diesel', 'disponible', '22222222-2222-2222-2222-222222222222', 'aa333333-3333-3333-3333-333333333333', '2023-09-01', '2026-09-01', '2026-09-01', 18000, 280),

-- SBTA Regional (5 bus grande capacité)
('b3333333-3333-3333-3333-333333333331', 'AB-3100-CI', 'Yutong ZK6147H', 'Yutong', 2022, 65, 'diesel', 'disponible', '33333333-3333-3333-3333-333333333333', 'aa555555-5555-5555-5555-555555555555', '2022-05-01', '2025-05-01', '2025-05-01', 55000, 300),
('b3333333-3333-3333-3333-333333333332', 'AB-3101-CI', 'Yutong ZK6147H', 'Yutong', 2022, 65, 'diesel', 'disponible', '33333333-3333-3333-3333-333333333333', 'aa555555-5555-5555-5555-555555555555', '2022-06-15', '2025-06-15', '2025-06-15', 52000, 300),
('b3333333-3333-3333-3333-333333333333', 'AB-3102-CI', 'Isuzu NPR', 'Isuzu', 2023, 49, 'diesel', 'disponible', '33333333-3333-3333-3333-333333333333', 'aa111111-1111-1111-1111-111111111111', '2023-04-01', '2026-04-01', '2026-04-01', 32000, 200),
('b3333333-3333-3333-3333-333333333334', 'AB-3103-CI', 'Yutong ZK6147H', 'Yutong', 2023, 65, 'diesel', 'disponible', '33333333-3333-3333-3333-333333333333', 'aa555555-5555-5555-5555-555555555555', '2023-07-20', '2026-07-20', '2026-07-20', 25000, 300),
('b3333333-3333-3333-3333-333333333335', 'AB-3104-CI', 'Isuzu NPR', 'Isuzu', 2024, 49, 'diesel', 'disponible', '33333333-3333-3333-3333-333333333333', 'aa111111-1111-1111-1111-111111111111', '2024-02-01', '2027-02-01', '2027-02-01', 15000, 200);

-- ============================================
-- 5. ITINÉRAIRES (12) avec distances et prix réels
-- ============================================
INSERT INTO routes (id, departure_city, arrival_city, distance_km, estimated_duration_minutes, base_price, active) VALUES
('r1111111-1111-1111-1111-111111111111', 'Abidjan', 'Yamoussoukro', 240, 180, 5000, true),
('r2222222-2222-2222-2222-222222222222', 'Abidjan', 'Bouaké', 385, 300, 7500, true),
('r3333333-3333-3333-3333-333333333333', 'Abidjan', 'San-Pédro', 340, 270, 7000, true),
('r4444444-4444-4444-4444-444444444444', 'Abidjan', 'Korhogo', 635, 480, 12000, true),
('r5555555-5555-5555-5555-555555555555', 'Abidjan', 'Man', 585, 420, 11000, true),
('r6666666-6666-6666-6666-666666666666', 'Abidjan', 'Daloa', 410, 330, 8000, true),
('r7777777-7777-7777-7777-777777777777', 'Abidjan', 'Gagnoa', 235, 180, 5500, true),
('r8888888-8888-8888-8888-888888888888', 'Yamoussoukro', 'Bouaké', 145, 120, 3500, true),
('r9999999-9999-9999-9999-999999999999', 'Bouaké', 'Korhogo', 250, 180, 5000, true),
('ra111111-1111-1111-1111-111111111111', 'Abidjan', 'Abengourou', 210, 165, 4500, true),
('rb222222-2222-2222-2222-222222222222', 'Abidjan', 'Divo', 120, 90, 3000, true),
('rc333333-3333-3333-3333-333333333333', 'Abidjan', 'Soubré', 295, 240, 6500, true);

-- ============================================
-- 6. PERSONNEL HOLDING (company_id = NULL sauf gestionnaires)
-- ============================================

-- 6.1 Admin (1)
INSERT INTO users (id, email, full_name, phone, role, company_id, status) VALUES
('u0000000-0000-0000-0000-000000000001', 'admin@sbta.ci', 'Kouassi ADMIN', '+225 07 00 00 00 01', 'admin', NULL, 'actif');

-- 6.2 DAF (1)
INSERT INTO users (id, email, full_name, phone, role, company_id, status) VALUES
('u0000000-0000-0000-0000-000000000002', 'daf@sbta.ci', 'Aké DAF', '+225 07 00 00 00 02', 'daf', NULL, 'actif');

-- 6.3 Comptable (1)
INSERT INTO users (id, email, full_name, phone, role, company_id, status) VALUES
('u0000000-0000-0000-0000-000000000003', 'comptable@sbta.ci', 'Konan COMPTABLE', '+225 07 00 00 00 03', 'comptable', NULL, 'actif');

-- 6.4 Gestionnaires (3) - AVEC company_id
INSERT INTO users (id, email, full_name, phone, role, company_id, status) VALUES
('u0000000-0000-0000-0000-000000000011', 'gest.express@sbta.ci', 'Yao GESTIONNAIRE Express', '+225 07 00 00 00 11', 'gestionnaire', '11111111-1111-1111-1111-111111111111', 'actif'),
('u0000000-0000-0000-0000-000000000012', 'gest.premium@sbta.ci', 'Brou GESTIONNAIRE Premium', '+225 07 00 00 00 12', 'gestionnaire', '22222222-2222-2222-2222-222222222222', 'actif'),
('u0000000-0000-0000-0000-000000000013', 'gest.regional@sbta.ci', 'N'guessan GESTIONNAIRE Regional', '+225 07 00 00 00 13', 'gestionnaire', '33333333-3333-3333-3333-333333333333', 'actif');

-- 6.5 Chauffeurs (10) - HOLDING
INSERT INTO users (id, email, full_name, phone, role, company_id, status, license_number, license_expiry) VALUES
('uc000001-0000-0000-0000-000000000001', 'chauffeur1@sbta.ci', 'Kouamé CHAUFFEUR 1', '+225 07 01 01 01 01', 'chauffeur', NULL, 'actif', 'CI-DRV-001', '2026-12-31'),
('uc000002-0000-0000-0000-000000000002', 'chauffeur2@sbta.ci', 'Traoré CHAUFFEUR 2', '+225 07 01 01 01 02', 'chauffeur', NULL, 'actif', 'CI-DRV-002', '2026-12-31'),
('uc000003-0000-0000-0000-000000000003', 'chauffeur3@sbta.ci', 'Diabaté CHAUFFEUR 3', '+225 07 01 01 01 03', 'chauffeur', NULL, 'actif', 'CI-DRV-003', '2026-12-31'),
('uc000004-0000-0000-0000-000000000004', 'chauffeur4@sbta.ci', 'Sanogo CHAUFFEUR 4', '+225 07 01 01 01 04', 'chauffeur', NULL, 'actif', 'CI-DRV-004', '2026-12-31'),
('uc000005-0000-0000-0000-000000000005', 'chauffeur5@sbta.ci', 'Ouattara CHAUFFEUR 5', '+225 07 01 01 01 05', 'chauffeur', NULL, 'actif', 'CI-DRV-005', '2026-12-31'),
('uc000006-0000-0000-0000-000000000006', 'chauffeur6@sbta.ci', 'Camara CHAUFFEUR 6', '+225 07 01 01 01 06', 'chauffeur', NULL, 'actif', 'CI-DRV-006', '2026-12-31'),
('uc000007-0000-0000-0000-000000000007', 'chauffeur7@sbta.ci', 'Bakayoko CHAUFFEUR 7', '+225 07 01 01 01 07', 'chauffeur', NULL, 'actif', 'CI-DRV-007', '2026-12-31'),
('uc000008-0000-0000-0000-000000000008', 'chauffeur8@sbta.ci', 'Coulibaly CHAUFFEUR 8', '+225 07 01 01 01 08', 'chauffeur', NULL, 'actif', 'CI-DRV-008', '2026-12-31'),
('uc000009-0000-0000-0000-000000000009', 'chauffeur9@sbta.ci', 'Doumbia CHAUFFEUR 9', '+225 07 01 01 01 09', 'chauffeur', NULL, 'actif', 'CI-DRV-009', '2026-12-31'),
('uc000010-0000-0000-0000-000000000010', 'chauffeur10@sbta.ci', 'Koné CHAUFFEUR 10', '+225 07 01 01 01 10', 'chauffeur', NULL, 'actif', 'CI-DRV-010', '2026-12-31');

-- 6.6 Guichetiers (5) - HOLDING
INSERT INTO users (id, email, full_name, phone, role, company_id, status) VALUES
('ug000001-0000-0000-0000-000000000001', 'guichet1@sbta.ci', 'Aya GUICHETIER 1', '+225 07 02 02 02 01', 'guichetier', NULL, 'actif'),
('ug000002-0000-0000-0000-000000000002', 'guichet2@sbta.ci', 'Fatou GUICHETIER 2', '+225 07 02 02 02 02', 'guichetier', NULL, 'actif'),
('ug000003-0000-0000-0000-000000000003', 'guichet3@sbta.ci', 'Mariam GUICHETIER 3', '+225 07 02 02 02 03', 'guichetier', NULL, 'actif'),
('ug000004-0000-0000-0000-000000000004', 'guichet4@sbta.ci', 'Aminata GUICHETIER 4', '+225 07 02 02 02 04', 'guichetier', NULL, 'actif'),
('ug000005-0000-0000-0000-000000000005', 'guichet5@sbta.ci', 'Aïssata GUICHETIER 5', '+225 07 02 02 02 05', 'guichetier', NULL, 'actif');

-- 6.7 Chefs de garage (2) - HOLDING
INSERT INTO users (id, email, full_name, phone, role, company_id, status) VALUES
('um000001-0000-0000-0000-000000000001', 'chefgarage1@sbta.ci', 'Soro CHEF GARAGE 1', '+225 07 03 03 03 01', 'chef_garage', NULL, 'actif'),
('um000002-0000-0000-0000-000000000002', 'chefgarage2@sbta.ci', 'Bamba CHEF GARAGE 2', '+225 07 03 03 03 02', 'chef_garage', NULL, 'actif');

-- 6.8 Mécaniciens (4) - HOLDING
INSERT INTO users (id, email, full_name, phone, role, company_id, status, specialization) VALUES
('um000003-0000-0000-0000-000000000003', 'meca1@sbta.ci', 'Touré MECANICIEN 1', '+225 07 04 04 04 01', 'mecanicien', NULL, 'actif', 'Mécanique générale'),
('um000004-0000-0000-0000-000000000004', 'meca2@sbta.ci', 'Diallo MECANICIEN 2', '+225 07 04 04 04 02', 'mecanicien', NULL, 'actif', 'Électricité'),
('um000005-0000-0000-0000-000000000005', 'meca3@sbta.ci', 'Keita MECANICIEN 3', '+225 07 04 04 04 03', 'mecanicien', NULL, 'actif', 'Mécanique générale'),
('um000006-0000-0000-0000-000000000006', 'meca4@sbta.ci', 'Fofana MECANICIEN 4', '+225 07 04 04 04 04', 'mecanicien', NULL, 'actif', 'Carrosserie');

-- 6.9 Pompistes (2) - HOLDING
INSERT INTO users (id, email, full_name, phone, role, company_id, status) VALUES
('up000001-0000-0000-0000-000000000001', 'pompiste1@sbta.ci', 'Youssouf POMPISTE 1', '+225 07 05 05 05 01', 'pompiste', NULL, 'actif'),
('up000002-0000-0000-0000-000000000002', 'pompiste2@sbta.ci', 'Ibrahim POMPISTE 2', '+225 07 05 05 05 02', 'pompiste', NULL, 'actif');

-- 6.10 Planificateurs (2) - HOLDING
INSERT INTO users (id, email, full_name, phone, role, company_id, status) VALUES
('upl00001-0000-0000-0000-000000000001', 'planif1@sbta.ci', 'Koffi PLANIFICATEUR 1', '+225 07 06 06 06 01', 'planificateur', NULL, 'actif'),
('upl00002-0000-0000-0000-000000000002', 'planif2@sbta.ci', 'Adjoua PLANIFICATEUR 2', '+225 07 06 06 06 02', 'planificateur', NULL, 'actif');

-- ============================================
-- 7. CLIENTS (30) avec données fidélité variées
-- ============================================
INSERT INTO users (id, email, full_name, phone, role, company_id, status, loyalty_points, loyalty_tier, total_trips) VALUES
-- Platinum (2)
('ucl00001-0000-0000-0000-000000000001', 'client01@gmail.com', 'Jean-Marc CLIENT 1', '+225 05 01 01 01 01', 'client', NULL, 'actif', 12500, 'platinum', 45),
('ucl00002-0000-0000-0000-000000000002', 'client02@gmail.com', 'Marie-Claire CLIENT 2', '+225 05 01 01 01 02', 'client', NULL, 'actif', 11200, 'platinum', 42),

-- Gold (5)
('ucl00003-0000-0000-0000-000000000003', 'client03@gmail.com', 'Alassane CLIENT 3', '+225 05 01 01 01 03', 'client', NULL, 'actif', 6800, 'gold', 28),
('ucl00004-0000-0000-0000-000000000004', 'client04@gmail.com', 'Fatoumata CLIENT 4', '+225 05 01 01 01 04', 'client', NULL, 'actif', 5900, 'gold', 25),
('ucl00005-0000-0000-0000-000000000005', 'client05@gmail.com', 'Abdoulaye CLIENT 5', '+225 05 01 01 01 05', 'client', NULL, 'actif', 6200, 'gold', 26),
('ucl00006-0000-0000-0000-000000000006', 'client06@gmail.com', 'Rokia CLIENT 6', '+225 05 01 01 01 06', 'client', NULL, 'actif', 5500, 'gold', 23),
('ucl00007-0000-0000-0000-000000000007', 'client07@gmail.com', 'Mamadou CLIENT 7', '+225 05 01 01 01 07', 'client', NULL, 'actif', 6500, 'gold', 27),

-- Silver (8)
('ucl00008-0000-0000-0000-000000000008', 'client08@gmail.com', 'Aminata CLIENT 8', '+225 05 01 01 01 08', 'client', NULL, 'actif', 2800, 'silver', 14),
('ucl00009-0000-0000-0000-000000000009', 'client09@gmail.com', 'Souleymane CLIENT 9', '+225 05 01 01 01 09', 'client', NULL, 'actif', 3200, 'silver', 16),
('ucl00010-0000-0000-0000-000000000010', 'client10@gmail.com', 'Adjara CLIENT 10', '+225 05 01 01 01 10', 'client', NULL, 'actif', 2500, 'silver', 13),
('ucl00011-0000-0000-0000-000000000011', 'client11@gmail.com', 'Moussa CLIENT 11', '+225 05 01 01 01 11', 'client', NULL, 'actif', 3500, 'silver', 17),
('ucl00012-0000-0000-0000-000000000012', 'client12@gmail.com', 'Aïcha CLIENT 12', '+225 05 01 01 01 12', 'client', NULL, 'actif', 2900, 'silver', 15),
('ucl00013-0000-0000-0000-000000000013', 'client13@gmail.com', 'Seydou CLIENT 13', '+225 05 01 01 01 13', 'client', NULL, 'actif', 3100, 'silver', 16),
('ucl00014-0000-0000-0000-000000000014', 'client14@gmail.com', 'Nana CLIENT 14', '+225 05 01 01 01 14', 'client', NULL, 'actif', 2700, 'silver', 14),
('ucl00015-0000-0000-0000-000000000015', 'client15@gmail.com', 'Bakary CLIENT 15', '+225 05 01 01 01 15', 'client', NULL, 'actif', 3300, 'silver', 17),

-- Bronze (15)
('ucl00016-0000-0000-0000-000000000016', 'client16@gmail.com', 'Kadiatou CLIENT 16', '+225 05 01 01 01 16', 'client', NULL, 'actif', 850, 'bronze', 5),
('ucl00017-0000-0000-0000-000000000017', 'client17@gmail.com', 'Lancina CLIENT 17', '+225 05 01 01 01 17', 'client', NULL, 'actif', 420, 'bronze', 3),
('ucl00018-0000-0000-0000-000000000018', 'client18@gmail.com', 'Safiatou CLIENT 18', '+225 05 01 01 01 18', 'client', NULL, 'actif', 1200, 'bronze', 7),
('ucl00019-0000-0000-0000-000000000019', 'client19@gmail.com', 'Issouf CLIENT 19', '+225 05 01 01 01 19', 'client', NULL, 'actif', 650, 'bronze', 4),
('ucl00020-0000-0000-0000-000000000020', 'client20@gmail.com', 'Vakaramoko CLIENT 20', '+225 05 01 01 01 20', 'client', NULL, 'actif', 980, 'bronze', 6),
('ucl00021-0000-0000-0000-000000000021', 'client21@gmail.com', 'Awa CLIENT 21', '+225 05 01 01 01 21', 'client', NULL, 'actif', 520, 'bronze', 3),
('ucl00022-0000-0000-0000-000000000022', 'client22@gmail.com', 'Drissa CLIENT 22', '+225 05 01 01 01 22', 'client', NULL, 'actif', 1100, 'bronze', 7),
('ucl00023-0000-0000-0000-000000000023', 'client23@gmail.com', 'Hawa CLIENT 23', '+225 05 01 01 01 23', 'client', NULL, 'actif', 780, 'bronze', 5),
('ucl00024-0000-0000-0000-000000000024', 'client24@gmail.com', 'Yaya CLIENT 24', '+225 05 01 01 01 24', 'client', NULL, 'actif', 350, 'bronze', 2),
('ucl00025-0000-0000-0000-000000000025', 'client25@gmail.com', 'Djénéba CLIENT 25', '+225 05 01 01 01 25', 'client', NULL, 'actif', 1400, 'bronze', 8),
('ucl00026-0000-0000-0000-000000000026', 'client26@gmail.com', 'Adama CLIENT 26', '+225 05 01 01 01 26', 'client', NULL, 'actif', 620, 'bronze', 4),
('ucl00027-0000-0000-0000-000000000027', 'client27@gmail.com', 'Oumou CLIENT 27', '+225 05 01 01 01 27', 'client', NULL, 'actif', 890, 'bronze', 5),
('ucl00028-0000-0000-0000-000000000028', 'client28@gmail.com', 'Lamine CLIENT 28', '+225 05 01 01 01 28', 'client', NULL, 'actif', 450, 'bronze', 3),
('ucl00029-0000-0000-0000-000000000029', 'client29@gmail.com', 'Bintou CLIENT 29', '+225 05 01 01 01 29', 'client', NULL, 'actif', 1050, 'bronze', 6),
('ucl00030-0000-0000-0000-000000000030', 'client30@gmail.com', 'Oumar CLIENT 30', '+225 05 01 01 01 30', 'client', NULL, 'actif', 750, 'bronze', 5);

-- Note: Les mots de passe seront gérés par Supabase Auth lors du premier login
