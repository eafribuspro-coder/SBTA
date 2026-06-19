/*
  # Ajout des garages : Oumé, Divo, Gagnoa, San Pedro, Soubré

  1. Nouveaux garages
    - Garage OUMÉ     — Oumé, Fromager
    - Garage DIVO     — Divo, Fromager
    - Garage GAGNOA   — Gagnoa, Fromager
    - Garage SAN PEDRO — San Pedro, San-Pédro
    - Garage SOUBRÉ   — Soubré, Nawa
*/

INSERT INTO garages (name, code, city, region, status)
VALUES
  ('Garage OUMÉ',      'GAR-OME-001', 'Oumé',      'Fromager',   'actif'),
  ('Garage DIVO',      'GAR-DVO-001', 'Divo',       'Fromager',   'actif'),
  ('Garage GAGNOA',    'GAR-GGN-001', 'Gagnoa',     'Fromager',   'actif'),
  ('Garage SAN PEDRO', 'GAR-SPD-001', 'San Pedro',  'San-Pédro',  'actif'),
  ('Garage SOUBRÉ',    'GAR-SBR-001', 'Soubré',     'Nawa',       'actif')
ON CONFLICT (code) DO NOTHING;
