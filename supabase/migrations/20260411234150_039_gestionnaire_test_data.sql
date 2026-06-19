/*
  # Test data for gestionnaire role

  ## Summary
  Inserts realistic test data visible to gestionnaire users:

  1. Schedules for SBTA Express buses in free time slots (no conflicts)
  2. Bus expenses for SBTA Express fleet (various types and statuses)
  3. One bus set to 'maintenance' status for dashboard alert
*/

-- Set one bus to maintenance for alert display
UPDATE buses SET status = 'maintenance'
WHERE registration_number = 'SB-003-DK';

-- Past completed trips (termine) - using free time windows
-- SB-001-DK: free slot on April 3 (no existing schedules)
INSERT INTO schedules (
  id, route_id, bus_id, driver_id,
  departure_station_id, arrival_station_id,
  departure_datetime, arrival_datetime,
  status, seats_available, seats_reserved,
  price, route_name, created_by
)
VALUES (
  gen_random_uuid(),
  '99fe18db-7c60-4c88-bf5a-c760cfbaff23',
  '85305342-7127-4ace-a632-95a0bcc6f9e0',
  'af03984d-4eac-44ea-8332-e5c6a78225fa',
  'be221fd9-0d42-4f94-89de-096bbf85f803',
  '60112270-26a7-4f15-af4e-8010eb1deeeb',
  '2026-04-03 07:00:00+00',
  '2026-04-03 10:00:00+00',
  'termine',
  50, 42, 7500,
  'Abidjan - Bouaké',
  (SELECT id FROM users WHERE role = 'gestionnaire' LIMIT 1)
);

-- SB-002-DK: free slot on April 4
INSERT INTO schedules (
  id, route_id, bus_id, driver_id,
  departure_station_id, arrival_station_id,
  departure_datetime, arrival_datetime,
  status, seats_available, seats_reserved,
  price, route_name, created_by
)
VALUES (
  gen_random_uuid(),
  '99fe18db-7c60-4c88-bf5a-c760cfbaff23',
  '2ce86140-58e4-4375-99d8-a21621addca3',
  'eabe643f-5c03-44ba-b8bd-e89d154a2561',
  'be221fd9-0d42-4f94-89de-096bbf85f803',
  '60112270-26a7-4f15-af4e-8010eb1deeeb',
  '2026-04-04 07:00:00+00',
  '2026-04-04 10:00:00+00',
  'termine',
  50, 38, 7500,
  'Abidjan - Bouaké',
  (SELECT id FROM users WHERE role = 'gestionnaire' LIMIT 1)
);

-- SB-001-DK: free slot on April 5
INSERT INTO schedules (
  id, route_id, bus_id, driver_id,
  departure_station_id, arrival_station_id,
  departure_datetime, arrival_datetime,
  status, seats_available, seats_reserved,
  price, route_name, created_by
)
VALUES (
  gen_random_uuid(),
  '4a73fc03-335e-45c6-8700-259f908fff18',
  '85305342-7127-4ace-a632-95a0bcc6f9e0',
  'af03984d-4eac-44ea-8332-e5c6a78225fa',
  'be221fd9-0d42-4f94-89de-096bbf85f803',
  '60112270-26a7-4f15-af4e-8010eb1deeeb',
  '2026-04-05 07:00:00+00',
  '2026-04-05 11:00:00+00',
  'termine',
  50, 45, 9000,
  'Abidjan - Yamoussoukro',
  (SELECT id FROM users WHERE role = 'gestionnaire' LIMIT 1)
);

-- SB-002-DK: free slot on April 5
INSERT INTO schedules (
  id, route_id, bus_id, driver_id,
  departure_station_id, arrival_station_id,
  departure_datetime, arrival_datetime,
  status, seats_available, seats_reserved,
  price, route_name, created_by
)
VALUES (
  gen_random_uuid(),
  '4a73fc03-335e-45c6-8700-259f908fff18',
  '2ce86140-58e4-4375-99d8-a21621addca3',
  'eabe643f-5c03-44ba-b8bd-e89d154a2561',
  'be221fd9-0d42-4f94-89de-096bbf85f803',
  '60112270-26a7-4f15-af4e-8010eb1deeeb',
  '2026-04-05 13:00:00+00',
  '2026-04-05 17:00:00+00',
  'termine',
  50, 30, 9000,
  'Abidjan - Yamoussoukro',
  (SELECT id FROM users WHERE role = 'gestionnaire' LIMIT 1)
);

-- Future planned trips (planifie) - April 16 and 17 (free slots)
INSERT INTO schedules (
  id, route_id, bus_id, driver_id,
  departure_station_id, arrival_station_id,
  departure_datetime, arrival_datetime,
  status, seats_available, seats_reserved,
  price, route_name, created_by
)
VALUES (
  gen_random_uuid(),
  '99fe18db-7c60-4c88-bf5a-c760cfbaff23',
  '85305342-7127-4ace-a632-95a0bcc6f9e0',
  'af03984d-4eac-44ea-8332-e5c6a78225fa',
  'be221fd9-0d42-4f94-89de-096bbf85f803',
  '60112270-26a7-4f15-af4e-8010eb1deeeb',
  '2026-04-16 07:00:00+00',
  '2026-04-16 10:00:00+00',
  'planifie',
  50, 28, 7500,
  'Abidjan - Bouaké',
  (SELECT id FROM users WHERE role = 'gestionnaire' LIMIT 1)
);

INSERT INTO schedules (
  id, route_id, bus_id, driver_id,
  departure_station_id, arrival_station_id,
  departure_datetime, arrival_datetime,
  status, seats_available, seats_reserved,
  price, route_name, created_by
)
VALUES (
  gen_random_uuid(),
  '4a73fc03-335e-45c6-8700-259f908fff18',
  '2ce86140-58e4-4375-99d8-a21621addca3',
  'eabe643f-5c03-44ba-b8bd-e89d154a2561',
  'be221fd9-0d42-4f94-89de-096bbf85f803',
  '60112270-26a7-4f15-af4e-8010eb1deeeb',
  '2026-04-17 07:00:00+00',
  '2026-04-17 11:00:00+00',
  'planifie',
  50, 35, 9000,
  'Abidjan - Yamoussoukro',
  (SELECT id FROM users WHERE role = 'gestionnaire' LIMIT 1)
);

-- Bus expenses for SBTA Express fleet
INSERT INTO bus_expenses (bus_id, expense_type, amount, description, expense_date, status, created_by)
VALUES
  ('85305342-7127-4ace-a632-95a0bcc6f9e0', 'assurance', 450000,
   'Renouvellement assurance annuelle - SB-001-DK',
   CURRENT_DATE - INTERVAL '15 days', 'validee',
   (SELECT id FROM users WHERE role = 'gestionnaire' LIMIT 1)),
  ('85305342-7127-4ace-a632-95a0bcc6f9e0', 'visite_technique', 35000,
   'Visite technique semestrielle - SB-001-DK',
   CURRENT_DATE - INTERVAL '8 days', 'validee',
   (SELECT id FROM users WHERE role = 'gestionnaire' LIMIT 1)),
  ('85305342-7127-4ace-a632-95a0bcc6f9e0', 'lavage', 5000,
   'Lavage et nettoyage intérieur/extérieur - SB-001-DK',
   CURRENT_DATE - INTERVAL '2 days', 'en_attente',
   (SELECT id FROM users WHERE role = 'gestionnaire' LIMIT 1)),
  ('2ce86140-58e4-4375-99d8-a21621addca3', 'assurance', 450000,
   'Renouvellement assurance annuelle - SB-002-DK',
   CURRENT_DATE - INTERVAL '20 days', 'validee',
   (SELECT id FROM users WHERE role = 'gestionnaire' LIMIT 1)),
  ('2ce86140-58e4-4375-99d8-a21621addca3', 'vignette', 75000,
   'Vignette annuelle - SB-002-DK',
   CURRENT_DATE - INTERVAL '30 days', 'validee',
   (SELECT id FROM users WHERE role = 'gestionnaire' LIMIT 1)),
  ('2ce86140-58e4-4375-99d8-a21621addca3', 'peage', 12500,
   'Frais de péage - Corridor Abidjan-Bouaké',
   CURRENT_DATE - INTERVAL '3 days', 'en_attente',
   (SELECT id FROM users WHERE role = 'gestionnaire' LIMIT 1)),
  ('d664877e-674f-4a7c-acb6-e6bfdfafe2ef', 'reparation', 185000,
   'Réparation moteur - SB-003-DK (en maintenance)',
   CURRENT_DATE - INTERVAL '1 day', 'en_attente',
   (SELECT id FROM users WHERE role = 'gestionnaire' LIMIT 1));
