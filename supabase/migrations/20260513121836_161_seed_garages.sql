/*
  # Seed garages — 7 nouveaux sous-garages SBTA
  Modèle basé sur le Garage ODIENNÉ existant (GAR-OD-001, sous_garage, actif).
  Les codes suivent la convention GAR-{ABRÉV}-{SEQ}.
  Les station_id sont renseignés quand une gare SBTA correspondante existe.
*/

INSERT INTO garages (name, code, garage_type, city, region, status, max_vehicles)
VALUES
  ('Garage BOUAKÉ',       'GAR-BK-001', 'sous_garage', 'Bouaké',       'Vallée du Bandama', 'actif', 20),
  ('Garage ALÉPÉ',        'GAR-ALP-001','sous_garage', 'Alépé',        'Sud-Comoé',         'actif', 15),
  ('Garage ADZOPÉ',       'GAR-ADZ-001','sous_garage', 'Adzopé',       'Sud-Comoé',         'actif', 15),
  ('Garage SIKENSI',      'GAR-SKS-001','sous_garage', 'Sikensi',      'Lagunes',            'actif', 10),
  ('Garage YAMOUSSOUKRO', 'GAR-YAM-001','sous_garage', 'Yamoussoukro', 'Lacs',               'actif', 20),
  ('Garage ABENGOUROU',   'GAR-ABG-001','sous_garage', 'Abengourou',   'Indénié-Djuablin',  'actif', 15),
  ('Garage BONDOUKOU',    'GAR-BDK-001','sous_garage', 'Bondoukou',    'Gontougo',           'actif', 15)
ON CONFLICT (code) DO NOTHING;

-- Rattacher le garage BOUAKÉ à la gare SBTA Bouaké
UPDATE garages
SET station_id = '51000001-0000-0000-0000-000000000003'
WHERE code = 'GAR-BK-001';

-- Rattacher le garage YAMOUSSOUKRO à la gare SBTA Yamoussoukro
UPDATE garages
SET station_id = '51000001-0000-0000-0000-000000000002'
WHERE code = 'GAR-YAM-001';
