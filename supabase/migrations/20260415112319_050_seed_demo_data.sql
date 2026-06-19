
/*
  # Seed Demo Data - SBTA Platform

  Populates the database with realistic demo data.
  - chef_gare role excluded (not in users_role_check constraint)
  - status uses 'active' (not 'actif')
  - amenities column is uuid[], cast arrays accordingly
  - buses.total_seats is NOT NULL
*/

-- ============================================
-- 1. AUTH USERS
-- ============================================
INSERT INTO auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) VALUES
('00000000-0000-0000-0001-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@sbta.ci',crypt('Admin123!',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Kouassi ADMIN"}',NOW(),NOW(),false,false),
('00000000-0000-0000-0001-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','daf@sbta.ci',crypt('Daf123!',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Aké DAF"}',NOW(),NOW(),false,false),
('00000000-0000-0000-0001-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','comptable@sbta.ci',crypt('Comptable123!',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Konan COMPTABLE"}',NOW(),NOW(),false,false),
('00000000-0000-0000-0006-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','planif1@sbta.ci',crypt('Planif123!',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Koffi PLANIFICATEUR"}',NOW(),NOW(),false,false),
('00000000-0000-0000-0003-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chefgarage1@sbta.ci',crypt('Garage123!',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Soro CHEF GARAGE"}',NOW(),NOW(),false,false),
('00000000-0000-0000-0004-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','meca1@sbta.ci',crypt('Meca123!',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Touré MECANICIEN"}',NOW(),NOW(),false,false),
('00000000-0000-0000-0005-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pompiste1@sbta.ci',crypt('Pompiste123!',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Youssouf POMPISTE"}',NOW(),NOW(),false,false),
('00000000-0000-0000-0002-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','guichet1@sbta.ci',crypt('Guichet123!',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Aya GUICHETIER"}',NOW(),NOW(),false,false),
('00000000-0000-0000-0007-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chauffeur1@sbta.ci',crypt('Chauffeur123!',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Kouamé CHAUFFEUR 1"}',NOW(),NOW(),false,false),
('00000000-0000-0000-0007-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chauffeur2@sbta.ci',crypt('Chauffeur123!',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Traoré CHAUFFEUR 2"}',NOW(),NOW(),false,false),
('00000000-0000-0000-0007-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chauffeur3@sbta.ci',crypt('Chauffeur123!',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Diabaté CHAUFFEUR 3"}',NOW(),NOW(),false,false),
('00000000-0000-0000-0011-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gest.express@sbta.ci',crypt('Gest123!',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Yao GESTIONNAIRE Express"}',NOW(),NOW(),false,false),
('00000000-0000-0000-0011-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gest.premium@sbta.ci',crypt('Gest123!',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Brou GESTIONNAIRE Premium"}',NOW(),NOW(),false,false),
('00000000-0000-0000-0020-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','client01@gmail.com',crypt('Client123!',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Jean-Marc CLIENT 1"}',NOW(),NOW(),false,false),
('00000000-0000-0000-0020-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','client02@gmail.com',crypt('Client123!',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Marie-Claire CLIENT 2"}',NOW(),NOW(),false,false),
('00000000-0000-0000-0020-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','client03@gmail.com',crypt('Client123!',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Alassane CLIENT 3"}',NOW(),NOW(),false,false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. COMPANIES
-- ============================================
INSERT INTO companies (id, name, code, address, phone, email) VALUES
('11111111-1111-1111-1111-111111111111','SBTA Express','EXPRESS','Boulevard Latrille, Abidjan','+225 27 20 21 22 23','express@sbta.ci'),
('22222222-2222-2222-2222-222222222222','SBTA Premium','PREMIUM','Zone 4, Marcory, Abidjan','+225 27 20 21 22 24','premium@sbta.ci'),
('33333333-3333-3333-3333-333333333333','SBTA Regional','REGIONAL','Adjamé Liberté, Abidjan','+225 27 20 21 22 25','regional@sbta.ci')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. CITIES
-- ============================================
INSERT INTO cities (id, name, latitude, longitude, region) VALUES
('c1000001-0000-0000-0000-000000000001','Abidjan',5.354,-4.004,'Abidjan'),
('c1000001-0000-0000-0000-000000000002','Yamoussoukro',6.820,-5.274,'Yamoussoukro'),
('c1000001-0000-0000-0000-000000000003','Bouaké',7.690,-5.030,'Vallée du Bandama'),
('c1000001-0000-0000-0000-000000000004','San-Pédro',4.749,-6.636,'Bas-Sassandra'),
('c1000001-0000-0000-0000-000000000005','Korhogo',9.458,-5.629,'Savanes'),
('c1000001-0000-0000-0000-000000000006','Man',7.412,-7.554,'Montagnes'),
('c1000001-0000-0000-0000-000000000007','Daloa',6.877,-6.450,'Sassandra-Marahoué'),
('c1000001-0000-0000-0000-000000000008','Gagnoa',6.132,-5.951,'Gôh-Djiboua'),
('c1000001-0000-0000-0000-000000000009','Abengourou',6.729,-3.496,'Comoé'),
('c1000001-0000-0000-0000-000000000010','Divo',5.837,-5.357,'Lôh-Djiboua'),
('c1000001-0000-0000-0000-000000000011','Bondoukou',8.040,-2.800,'Zanzan'),
('c1000001-0000-0000-0000-000000000012','Odienné',9.510,-7.564,'Denguélé'),
('c1000001-0000-0000-0000-000000000013','Séguéla',7.960,-6.672,'Woroba'),
('c1000001-0000-0000-0000-000000000014','Touba',8.283,-7.685,'Bafing'),
('c1000001-0000-0000-0000-000000000015','Soubré',5.789,-6.590,'Bas-Sassandra')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. STATIONS
-- ============================================
INSERT INTO stations (id, name, city_id, address, phone, is_active) VALUES
('51000001-0000-0000-0000-000000000001','Gare SBTA Abidjan','c1000001-0000-0000-0000-000000000001','Boulevard Latrille, Cocody, Abidjan','+225 27 20 10 11 00',true),
('51000001-0000-0000-0000-000000000002','Gare SBTA Yamoussoukro','c1000001-0000-0000-0000-000000000002','Avenue Houphouet-Boigny, Yamoussoukro','+225 27 30 64 01 00',true),
('51000001-0000-0000-0000-000000000003','Gare SBTA Bouaké','c1000001-0000-0000-0000-000000000003','Quartier Commerce, Bouaké','+225 27 31 63 01 00',true),
('51000001-0000-0000-0000-000000000004','Gare SBTA San-Pédro','c1000001-0000-0000-0000-000000000004','Centre-ville, San-Pédro','+225 27 34 71 01 00',true),
('51000001-0000-0000-0000-000000000005','Gare SBTA Korhogo','c1000001-0000-0000-0000-000000000005','Avenue de la Paix, Korhogo','+225 27 36 86 01 00',true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. AMENITIES
-- ============================================
INSERT INTO amenities (id, name, icon) VALUES
('a1000001-0000-0000-0000-000000000001','Climatisation','wind'),
('a1000001-0000-0000-0000-000000000002','WiFi','wifi'),
('a1000001-0000-0000-0000-000000000003','USB','usb'),
('a1000001-0000-0000-0000-000000000004','Toilettes','bath'),
('a1000001-0000-0000-0000-000000000005','TV / Écran','monitor'),
('a1000001-0000-0000-0000-000000000006','Prises 220V','zap'),
('a1000001-0000-0000-0000-000000000007','Ceintures','shield'),
('a1000001-0000-0000-0000-000000000008','Coffre bagage','package')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 6. BUS SEAT CONFIGS
-- ============================================
INSERT INTO bus_seat_config (id, name, total_capacity, total_seats, rows, columns, deck_level) VALUES
('fc000001-0000-0000-0000-000000000001','Standard 49 places (2+2)',49,49,13,4,'simple'),
('fc000001-0000-0000-0000-000000000002','VIP 39 places (2+1)',39,39,13,3,'simple'),
('fc000001-0000-0000-0000-000000000003','Executive 30 places (1+1)',30,30,15,2,'simple'),
('fc000001-0000-0000-0000-000000000004','Mini-bus 22 places (2+2)',22,22,6,4,'simple'),
('fc000001-0000-0000-0000-000000000005','Grande capacité 65 places',65,65,17,4,'simple')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 7. BUSES (20) — total_seats NOT NULL, amenities::uuid[]
-- ============================================
INSERT INTO buses (
  id, registration_number, brand, model, year,
  capacity, total_seats, fuel_type, fuel_capacity, fuel_consumption,
  status, company_id, seat_config_id,
  insurance_expiry, vignette_expiry, technical_inspection_expiry,
  class, amenities, fill_rate_current, bus_deck_type, driver_position
) VALUES
('b1111111-1111-1111-1111-111111111111','AB-1234-CI','Isuzu','Journey',2022,49,49,'diesel',200,25,'disponible','11111111-1111-1111-1111-111111111111','fc000001-0000-0000-0000-000000000001','2026-01-15','2026-01-15','2026-01-15','standard',ARRAY['a1000001-0000-0000-0000-000000000001','a1000001-0000-0000-0000-000000000007']::uuid[],72,'simple','gauche'),
('b1111111-1111-1111-1111-111111111112','AB-1235-CI','Isuzu','Journey',2022,49,49,'diesel',200,25,'disponible','11111111-1111-1111-1111-111111111111','fc000001-0000-0000-0000-000000000001','2026-02-20','2026-02-20','2026-02-20','standard',ARRAY['a1000001-0000-0000-0000-000000000001','a1000001-0000-0000-0000-000000000007']::uuid[],58,'simple','gauche'),
('b1111111-1111-1111-1111-111111111113','AB-1236-CI','Mercedes-Benz','Sprinter',2023,22,22,'diesel',120,18,'disponible','11111111-1111-1111-1111-111111111111','fc000001-0000-0000-0000-000000000004','2026-03-10','2026-03-10','2026-03-10','standard',ARRAY['a1000001-0000-0000-0000-000000000001']::uuid[],45,'simple','gauche'),
('b1111111-1111-1111-1111-111111111114','AB-1237-CI','Isuzu','Journey',2021,49,49,'diesel',200,25,'disponible','11111111-1111-1111-1111-111111111111','fc000001-0000-0000-0000-000000000001','2027-06-01','2027-06-01','2027-06-01','standard',ARRAY['a1000001-0000-0000-0000-000000000001','a1000001-0000-0000-0000-000000000007']::uuid[],83,'simple','gauche'),
('b1111111-1111-1111-1111-111111111115','AB-1238-CI','Yutong','ZK6127H',2023,49,49,'diesel',220,26,'disponible','11111111-1111-1111-1111-111111111111','fc000001-0000-0000-0000-000000000001','2026-08-15','2026-08-15','2026-08-15','standard',ARRAY['a1000001-0000-0000-0000-000000000001','a1000001-0000-0000-0000-000000000002']::uuid[],30,'simple','gauche'),
('b1111111-1111-1111-1111-111111111116','AB-1239-CI','Yutong','ZK6127H',2023,49,49,'diesel',220,26,'maintenance','11111111-1111-1111-1111-111111111111','fc000001-0000-0000-0000-000000000001','2026-09-01','2026-09-01','2026-09-01','standard',ARRAY['a1000001-0000-0000-0000-000000000001']::uuid[],0,'simple','gauche'),
('b1111111-1111-1111-1111-111111111117','AB-1240-CI','Isuzu','Journey',2022,49,49,'diesel',200,25,'disponible','11111111-1111-1111-1111-111111111111','fc000001-0000-0000-0000-000000000001','2025-11-20','2025-11-20','2025-11-20','standard',ARRAY['a1000001-0000-0000-0000-000000000001','a1000001-0000-0000-0000-000000000007']::uuid[],65,'simple','gauche'),
('b1111111-1111-1111-1111-111111111118','AB-1241-CI','Mercedes-Benz','Sprinter',2024,22,22,'diesel',120,18,'disponible','11111111-1111-1111-1111-111111111111','fc000001-0000-0000-0000-000000000004','2027-01-10','2027-01-10','2027-01-10','standard',ARRAY['a1000001-0000-0000-0000-000000000001','a1000001-0000-0000-0000-000000000002']::uuid[],50,'simple','gauche'),
('b2222222-2222-2222-2222-222222222221','AB-2001-CI','Scania','Touring',2023,39,39,'diesel',250,22,'disponible','22222222-2222-2222-2222-222222222222','fc000001-0000-0000-0000-000000000002','2026-02-01','2026-02-01','2026-02-01','vip',ARRAY['a1000001-0000-0000-0000-000000000001','a1000001-0000-0000-0000-000000000002','a1000001-0000-0000-0000-000000000003','a1000001-0000-0000-0000-000000000007']::uuid[],88,'simple','gauche'),
('b2222222-2222-2222-2222-222222222222','AB-2002-CI','Scania','Touring',2023,39,39,'diesel',250,22,'disponible','22222222-2222-2222-2222-222222222222','fc000001-0000-0000-0000-000000000002','2026-03-15','2026-03-15','2026-03-15','vip',ARRAY['a1000001-0000-0000-0000-000000000001','a1000001-0000-0000-0000-000000000002','a1000001-0000-0000-0000-000000000003']::uuid[],76,'simple','gauche'),
('b2222222-2222-2222-2222-222222222223','AB-2003-CI','Mercedes-Benz','Tourismo',2024,30,30,'diesel',280,20,'disponible','22222222-2222-2222-2222-222222222222','fc000001-0000-0000-0000-000000000003','2027-01-20','2027-01-20','2027-01-20','executive',ARRAY['a1000001-0000-0000-0000-000000000001','a1000001-0000-0000-0000-000000000002','a1000001-0000-0000-0000-000000000003','a1000001-0000-0000-0000-000000000004','a1000001-0000-0000-0000-000000000006']::uuid[],90,'simple','gauche'),
('b2222222-2222-2222-2222-222222222224','AB-2004-CI','Mercedes-Benz','Tourismo',2024,30,30,'diesel',280,20,'disponible','22222222-2222-2222-2222-222222222222','fc000001-0000-0000-0000-000000000003','2027-02-10','2027-02-10','2027-02-10','executive',ARRAY['a1000001-0000-0000-0000-000000000001','a1000001-0000-0000-0000-000000000002','a1000001-0000-0000-0000-000000000005','a1000001-0000-0000-0000-000000000006']::uuid[],67,'simple','gauche'),
('b2222222-2222-2222-2222-222222222225','AB-2005-CI','Scania','Touring',2022,39,39,'diesel',250,22,'disponible','22222222-2222-2222-2222-222222222222','fc000001-0000-0000-0000-000000000002','2025-08-01','2025-08-01','2025-08-01','vip',ARRAY['a1000001-0000-0000-0000-000000000001','a1000001-0000-0000-0000-000000000002']::uuid[],55,'simple','gauche'),
('b2222222-2222-2222-2222-222222222226','AB-2006-CI','Scania','Touring',2023,39,39,'diesel',250,22,'disponible','22222222-2222-2222-2222-222222222222','fc000001-0000-0000-0000-000000000002','2026-06-15','2026-06-15','2026-06-15','vip',ARRAY['a1000001-0000-0000-0000-000000000001','a1000001-0000-0000-0000-000000000007']::uuid[],72,'simple','gauche'),
('b2222222-2222-2222-2222-222222222227','AB-2007-CI','Mercedes-Benz','Tourismo',2023,30,30,'diesel',280,20,'hors_service','22222222-2222-2222-2222-222222222222','fc000001-0000-0000-0000-000000000003','2026-09-01','2026-09-01','2026-09-01','executive',ARRAY['a1000001-0000-0000-0000-000000000001']::uuid[],0,'simple','gauche'),
('b3333333-3333-3333-3333-333333333331','AB-3100-CI','Yutong','ZK6147H',2022,65,65,'diesel',300,30,'disponible','33333333-3333-3333-3333-333333333333','fc000001-0000-0000-0000-000000000005','2026-05-01','2026-05-01','2026-05-01','standard',ARRAY['a1000001-0000-0000-0000-000000000001','a1000001-0000-0000-0000-000000000007','a1000001-0000-0000-0000-000000000008']::uuid[],78,'simple','gauche'),
('b3333333-3333-3333-3333-333333333332','AB-3101-CI','Yutong','ZK6147H',2022,65,65,'diesel',300,30,'disponible','33333333-3333-3333-3333-333333333333','fc000001-0000-0000-0000-000000000005','2026-06-15','2026-06-15','2026-06-15','standard',ARRAY['a1000001-0000-0000-0000-000000000001','a1000001-0000-0000-0000-000000000007']::uuid[],62,'simple','gauche'),
('b3333333-3333-3333-3333-333333333333','AB-3102-CI','Isuzu','NPR',2023,49,49,'diesel',200,25,'disponible','33333333-3333-3333-3333-333333333333','fc000001-0000-0000-0000-000000000001','2026-04-01','2026-04-01','2026-04-01','standard',ARRAY['a1000001-0000-0000-0000-000000000001','a1000001-0000-0000-0000-000000000008']::uuid[],48,'simple','gauche'),
('b3333333-3333-3333-3333-333333333334','AB-3103-CI','Yutong','ZK6147H',2023,65,65,'diesel',300,30,'disponible','33333333-3333-3333-3333-333333333333','fc000001-0000-0000-0000-000000000005','2026-07-20','2026-07-20','2026-07-20','standard',ARRAY['a1000001-0000-0000-0000-000000000001','a1000001-0000-0000-0000-000000000007','a1000001-0000-0000-0000-000000000008']::uuid[],85,'simple','gauche'),
('b3333333-3333-3333-3333-333333333335','AB-3104-CI','Isuzu','NPR',2024,49,49,'diesel',200,25,'disponible','33333333-3333-3333-3333-333333333333','fc000001-0000-0000-0000-000000000001','2027-02-01','2027-02-01','2027-02-01','standard',ARRAY['a1000001-0000-0000-0000-000000000001','a1000001-0000-0000-0000-000000000007']::uuid[],40,'simple','gauche')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 8. PUBLIC USERS (status = 'active')
-- ============================================
INSERT INTO public.users (id, email, full_name, phone, role, company_id, is_active, status) VALUES
('00000000-0000-0000-0001-000000000001','admin@sbta.ci','Kouassi ADMIN','+225 07 00 00 00 01','admin',NULL,true,'active'),
('00000000-0000-0000-0001-000000000002','daf@sbta.ci','Aké DAF','+225 07 00 00 00 02','daf',NULL,true,'active'),
('00000000-0000-0000-0001-000000000003','comptable@sbta.ci','Konan COMPTABLE','+225 07 00 00 00 03','comptable',NULL,true,'active'),
('00000000-0000-0000-0006-000000000001','planif1@sbta.ci','Koffi PLANIFICATEUR','+225 07 06 06 06 01','planificateur',NULL,true,'active'),
('00000000-0000-0000-0003-000000000001','chefgarage1@sbta.ci','Soro CHEF GARAGE','+225 07 03 03 03 01','chef_garage',NULL,true,'active'),
('00000000-0000-0000-0004-000000000001','meca1@sbta.ci','Touré MECANICIEN','+225 07 04 04 04 01','mecanicien',NULL,true,'active'),
('00000000-0000-0000-0005-000000000001','pompiste1@sbta.ci','Youssouf POMPISTE','+225 07 05 05 05 01','pompiste',NULL,true,'active'),
('00000000-0000-0000-0002-000000000001','guichet1@sbta.ci','Aya GUICHETIER','+225 07 02 02 02 01','guichetier',NULL,true,'active'),
('00000000-0000-0000-0007-000000000001','chauffeur1@sbta.ci','Kouamé CHAUFFEUR 1','+225 07 01 01 01 01','chauffeur',NULL,true,'active'),
('00000000-0000-0000-0007-000000000002','chauffeur2@sbta.ci','Traoré CHAUFFEUR 2','+225 07 01 01 01 02','chauffeur',NULL,true,'active'),
('00000000-0000-0000-0007-000000000003','chauffeur3@sbta.ci','Diabaté CHAUFFEUR 3','+225 07 01 01 01 03','chauffeur',NULL,true,'active'),
('00000000-0000-0000-0011-000000000001','gest.express@sbta.ci','Yao GESTIONNAIRE Express','+225 07 00 00 00 11','gestionnaire','11111111-1111-1111-1111-111111111111',true,'active'),
('00000000-0000-0000-0011-000000000002','gest.premium@sbta.ci','Brou GESTIONNAIRE Premium','+225 07 00 00 00 12','gestionnaire','22222222-2222-2222-2222-222222222222',true,'active'),
('00000000-0000-0000-0020-000000000001','client01@gmail.com','Jean-Marc CLIENT 1','+225 05 01 01 01 01','client',NULL,true,'active'),
('00000000-0000-0000-0020-000000000002','client02@gmail.com','Marie-Claire CLIENT 2','+225 05 01 01 01 02','client',NULL,true,'active'),
('00000000-0000-0000-0020-000000000003','client03@gmail.com','Alassane CLIENT 3','+225 05 01 01 01 03','client',NULL,true,'active')
ON CONFLICT (id) DO NOTHING;

UPDATE public.users SET loyalty_points=12500, loyalty_tier='platinum', total_trips=45 WHERE id='00000000-0000-0000-0020-000000000001';
UPDATE public.users SET loyalty_points=11200, loyalty_tier='platinum', total_trips=42 WHERE id='00000000-0000-0000-0020-000000000002';
UPDATE public.users SET loyalty_points=6800,  loyalty_tier='gold',     total_trips=28 WHERE id='00000000-0000-0000-0020-000000000003';
UPDATE public.users SET driver_license_number='CI-DRV-001', driver_license_expiry='2026-12-31', driver_avg_rating=4.7, driver_total_hours=1240 WHERE id='00000000-0000-0000-0007-000000000001';
UPDATE public.users SET driver_license_number='CI-DRV-002', driver_license_expiry='2026-12-31', driver_avg_rating=4.5, driver_total_hours=980  WHERE id='00000000-0000-0000-0007-000000000002';
UPDATE public.users SET driver_license_number='CI-DRV-003', driver_license_expiry='2026-12-31', driver_avg_rating=4.8, driver_total_hours=1560 WHERE id='00000000-0000-0000-0007-000000000003';

-- ============================================
-- 9. ROUTES
-- ============================================
INSERT INTO routes (id, name, origin_city_id, destination_city_id, distance_km, estimated_duration_minutes, base_price, is_active) VALUES
('d1111111-1111-1111-1111-111111111111','Abidjan – Yamoussoukro','c1000001-0000-0000-0000-000000000001','c1000001-0000-0000-0000-000000000002',240,180,5000,true),
('d2222222-2222-2222-2222-222222222222','Abidjan – Bouaké','c1000001-0000-0000-0000-000000000001','c1000001-0000-0000-0000-000000000003',385,300,7500,true),
('d3333333-3333-3333-3333-333333333333','Abidjan – San-Pédro','c1000001-0000-0000-0000-000000000001','c1000001-0000-0000-0000-000000000004',340,270,7000,true),
('d4444444-4444-4444-4444-444444444444','Abidjan – Korhogo','c1000001-0000-0000-0000-000000000001','c1000001-0000-0000-0000-000000000005',635,480,12000,true),
('d5555555-5555-5555-5555-555555555555','Abidjan – Man','c1000001-0000-0000-0000-000000000001','c1000001-0000-0000-0000-000000000006',585,420,11000,true),
('d6666666-6666-6666-6666-666666666666','Abidjan – Daloa','c1000001-0000-0000-0000-000000000001','c1000001-0000-0000-0000-000000000007',410,330,8000,true),
('d7777777-7777-7777-7777-777777777777','Abidjan – Gagnoa','c1000001-0000-0000-0000-000000000001','c1000001-0000-0000-0000-000000000008',235,180,5500,true),
('d8888888-8888-8888-8888-888888888888','Yamoussoukro – Bouaké','c1000001-0000-0000-0000-000000000002','c1000001-0000-0000-0000-000000000003',145,120,3500,true),
('d9999999-9999-9999-9999-999999999999','Bouaké – Korhogo','c1000001-0000-0000-0000-000000000003','c1000001-0000-0000-0000-000000000005',250,180,5000,true),
('da111111-1111-1111-1111-111111111111','Abidjan – Abengourou','c1000001-0000-0000-0000-000000000001','c1000001-0000-0000-0000-000000000009',210,165,4500,true),
('db222222-2222-2222-2222-222222222222','Abidjan – Divo','c1000001-0000-0000-0000-000000000001','c1000001-0000-0000-0000-000000000010',120,90,3000,true),
('dc333333-3333-3333-3333-333333333333','Abidjan – Soubré','c1000001-0000-0000-0000-000000000001','c1000001-0000-0000-0000-000000000015',295,240,6500,true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 10. SCHEDULES
-- ============================================
INSERT INTO schedules (
  id, route_id, bus_id, driver_id,
  departure_station_id, arrival_station_id,
  departure_datetime, arrival_datetime,
  status, seats_available, seats_reserved, price, route_name
) VALUES
('e1000001-0000-0000-0000-000000000001','d1111111-1111-1111-1111-111111111111','b1111111-1111-1111-1111-111111111111','00000000-0000-0000-0007-000000000001','51000001-0000-0000-0000-000000000001','51000001-0000-0000-0000-000000000002',NOW()+INTERVAL'1 day',NOW()+INTERVAL'1 day 3 hours','planifie',35,14,5000,'Abidjan – Yamoussoukro'),
('e1000001-0000-0000-0000-000000000002','d2222222-2222-2222-2222-222222222222','b2222222-2222-2222-2222-222222222221','00000000-0000-0000-0007-000000000002','51000001-0000-0000-0000-000000000001','51000001-0000-0000-0000-000000000003',NOW()+INTERVAL'1 day 2 hours',NOW()+INTERVAL'1 day 7 hours','planifie',28,11,7500,'Abidjan – Bouaké'),
('e1000001-0000-0000-0000-000000000003','d3333333-3333-3333-3333-333333333333','b3333333-3333-3333-3333-333333333331','00000000-0000-0000-0007-000000000003','51000001-0000-0000-0000-000000000001','51000001-0000-0000-0000-000000000004',NOW()+INTERVAL'1 day 3 hours',NOW()+INTERVAL'1 day 7 hours 30 minutes','planifie',50,15,7000,'Abidjan – San-Pédro'),
('e1000001-0000-0000-0000-000000000004','d1111111-1111-1111-1111-111111111111','b1111111-1111-1111-1111-111111111112','00000000-0000-0000-0007-000000000001','51000001-0000-0000-0000-000000000001','51000001-0000-0000-0000-000000000002',NOW()+INTERVAL'2 days',NOW()+INTERVAL'2 days 3 hours','planifie',40,9,5000,'Abidjan – Yamoussoukro'),
('e1000001-0000-0000-0000-000000000005','d4444444-4444-4444-4444-444444444444','b2222222-2222-2222-2222-222222222223','00000000-0000-0000-0007-000000000002','51000001-0000-0000-0000-000000000001','51000001-0000-0000-0000-000000000005',NOW()+INTERVAL'2 days 1 hour',NOW()+INTERVAL'2 days 9 hours','planifie',22,8,12000,'Abidjan – Korhogo'),
('e1000001-0000-0000-0000-000000000006','d7777777-7777-7777-7777-777777777777','b1111111-1111-1111-1111-111111111117','00000000-0000-0000-0007-000000000003','51000001-0000-0000-0000-000000000001','51000001-0000-0000-0000-000000000002',NOW()+INTERVAL'3 days',NOW()+INTERVAL'3 days 3 hours','planifie',44,5,5500,'Abidjan – Gagnoa'),
('e1000001-0000-0000-0000-000000000007','d6666666-6666-6666-6666-666666666666','b3333333-3333-3333-3333-333333333332','00000000-0000-0000-0007-000000000001','51000001-0000-0000-0000-000000000001','51000001-0000-0000-0000-000000000002',NOW()+INTERVAL'3 days 2 hours',NOW()+INTERVAL'3 days 7 hours 30 minutes','planifie',48,17,8000,'Abidjan – Daloa'),
('e1000001-0000-0000-0000-000000000008','d2222222-2222-2222-2222-222222222222','b2222222-2222-2222-2222-222222222222','00000000-0000-0000-0007-000000000002','51000001-0000-0000-0000-000000000001','51000001-0000-0000-0000-000000000003',NOW()+INTERVAL'4 days',NOW()+INTERVAL'4 days 5 hours','planifie',29,10,7500,'Abidjan – Bouaké'),
('e1000001-0000-0000-0000-000000000009','d8888888-8888-8888-8888-888888888888','b1111111-1111-1111-1111-111111111115','00000000-0000-0000-0007-000000000003','51000001-0000-0000-0000-000000000002','51000001-0000-0000-0000-000000000003',NOW()+INTERVAL'4 days 4 hours',NOW()+INTERVAL'4 days 6 hours','planifie',38,11,3500,'Yamoussoukro – Bouaké'),
('e1000001-0000-0000-0000-000000000010','da111111-1111-1111-1111-111111111111','b3333333-3333-3333-3333-333333333333','00000000-0000-0000-0007-000000000001','51000001-0000-0000-0000-000000000001','51000001-0000-0000-0000-000000000003',NOW()+INTERVAL'5 days',NOW()+INTERVAL'5 days 2 hours 45 minutes','planifie',45,4,4500,'Abidjan – Abengourou')
ON CONFLICT (id) DO NOTHING;
