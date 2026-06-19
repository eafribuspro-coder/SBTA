/*
  # PARTIE 1 — Migration 1.9
  Rôle chef_garage + permissions garage/devis/maintenance.

  ## Rôle ajouté
  - chef_garage : gestion opérationnelle d'un garage SBTA (level 6)

  ## Permissions ajoutées
  - garages:read, garages:manage
  - quotes:create, quotes:read, quotes:read_all, quotes:validate
  - maintenance:stats

  ## Assignation
  - chef_garage : read garages + CRUD devis + read maintenance/buses/stocks
  - comptable : read+validate devis + read garages + stats
  - admin : tout
*/

-- Rôle chef_garage
INSERT INTO roles (name, display_name, description, level, is_system)
VALUES (
  'chef_garage',
  'Chef de Garage',
  'Gestion opérationnelle d''un garage SBTA indépendant',
  6,
  true
)
ON CONFLICT (name) DO NOTHING;

-- Permissions
INSERT INTO permissions (name, display_name, description, resource, action)
VALUES
  ('garages:read',      'Voir les garages',           'Consulter la liste des garages', 'garages', 'read'),
  ('garages:manage',    'Gérer les garages (admin)',   'CRUD complet des garages',       'garages', 'manage'),
  ('quotes:create',     'Créer un devis',              'Créer un devis de réparation',   'quotes',  'create'),
  ('quotes:read',       'Voir ses devis',              'Voir les devis de son garage',   'quotes',  'read'),
  ('quotes:read_all',   'Voir tous les devis',         'Vision globale des devis',       'quotes',  'read_all'),
  ('quotes:validate',   'Valider/rejeter un devis',    'Approuver ou refuser un devis',  'quotes',  'validate'),
  ('maintenance:stats', 'Stats maintenance',           'Tableaux de bord maintenance',   'maintenance', 'stats')
ON CONFLICT (name) DO NOTHING;

-- Chef de garage : ses permissions
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT r.id, p.id, true
FROM roles r, permissions p
WHERE r.name = 'chef_garage'
  AND p.name IN (
    'garages:read',
    'quotes:create',
    'quotes:read',
    'maintenance:stats'
  )
ON CONFLICT DO NOTHING;

-- Comptable : validation des devis + stats
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT r.id, p.id, true
FROM roles r, permissions p
WHERE r.name = 'comptable'
  AND p.name IN (
    'quotes:read',
    'quotes:validate',
    'garages:read',
    'maintenance:stats'
  )
ON CONFLICT DO NOTHING;

-- Admin : accès total garages + devis
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT r.id, p.id, true
FROM roles r, permissions p
WHERE r.name = 'admin'
  AND p.name IN (
    'garages:manage',
    'garages:read',
    'quotes:read_all',
    'quotes:validate',
    'maintenance:stats'
  )
ON CONFLICT DO NOTHING;
