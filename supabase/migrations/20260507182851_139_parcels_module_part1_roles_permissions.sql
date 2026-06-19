/*
  # MODULE COLIS — PARTIE 1.6 : Rôles et permissions colis

  ## Nouveaux rôles
  - superviseur_colis (niveau 3) : supervision globale toutes agences
  - agent_colis       (niveau 6) : gestion des colis de sa gare

  ## Nouvelles permissions
  - parcels:create        : créer un colis
  - parcels:read          : voir les colis de sa gare
  - parcels:update_status : mettre à jour le statut d'un colis
  - parcels:read_all      : voir tous les colis (superviseur)
  - parcels:reports       : accès aux rapports colis

  ## Attribution
  - superviseur_colis : parcels:read_all, parcels:reports, parcels:read, companies:read
  - agent_colis       : parcels:create, parcels:read, parcels:update_status
*/

-- Nouveaux rôles
INSERT INTO roles (name, display_name, description, level, is_system) VALUES
  ('superviseur_colis', 'Superviseur Colis', 'Supervision globale des colis toutes agences', 3, true),
  ('agent_colis',       'Agent Colis',       'Gestion des colis de sa gare',                 6, true)
ON CONFLICT (name) DO NOTHING;

-- Nouvelles permissions
INSERT INTO permissions (name, display_name, resource, action) VALUES
  ('parcels:create',        'Créer un colis',              'parcels', 'create'),
  ('parcels:read',          'Voir les colis',               'parcels', 'read'),
  ('parcels:update_status', 'Mettre à jour le statut',      'parcels', 'update_status'),
  ('parcels:read_all',      'Voir tous les colis',          'parcels', 'read_all'),
  ('parcels:reports',       'Rapports colis',               'parcels', 'reports')
ON CONFLICT (name) DO NOTHING;

-- Permissions superviseur_colis
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'superviseur_colis'
  AND p.name IN ('parcels:read_all','parcels:reports','parcels:read','companies:read')
ON CONFLICT DO NOTHING;

-- Permissions agent_colis
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'agent_colis'
  AND p.name IN ('parcels:create','parcels:read','parcels:update_status')
ON CONFLICT DO NOTHING;
