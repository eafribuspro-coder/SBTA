/*
  # Migration 002 — Seed Rôles & Permissions SBTA

  ## Résumé
  Insertion des données de référence pour le RBAC SBTA.

  ## Contenu
  1. Rôles SBTA (11 rôles système avec niveaux hiérarchiques)
  2. Permissions granulaires (format resource:action) — version consolidée
  3. Attribution des permissions par rôle

  ## Notes
  - ON CONFLICT DO NOTHING sur les rôles et permissions déjà insérés par la migration précédente
  - Les nouvelles permissions (users:suspend, users:invite, users:manage_roles, companies:*, fuel:*, expenses:*, maintenance:*, stock:*, logs:*) sont ajoutées
  - Les role_permissions sont réinsérées pour les nouveaux couples rôle/permission uniquement
*/

-- ============================================================
-- RÔLES SBTA (mise à jour descriptions si déjà existants)
-- ============================================================
INSERT INTO roles (name, display_name, description, level, is_system) VALUES
  ('admin',         'Administrateur',          'Accès total au système SBTA',                                1,  true),
  ('daf',           'DAF',                     'Directeur Administratif & Financier — lecture seule finances',2,  true),
  ('comptable',     'Comptable',               'Valide les dépenses opérationnelles',                        3,  true),
  ('gestionnaire',  'Gestionnaire de Société', 'Supervise les bus d''une société',                           4,  true),
  ('planificateur', 'Planificateur',           'Gère les voyages et affectations',                           5,  true),
  ('chef_garage',   'Chef de Garage',          'Supervise la maintenance et les réparations',                6,  true),
  ('chauffeur',     'Chauffeur',               'Conduit les bus, signale les pannes',                        7,  true),
  ('guichetier',    'Guichetier',              'Vend les billets et gère la caisse',                         7,  true),
  ('mecanicien',    'Mécanicien',              'Effectue les réparations et diagnostics',                    7,  true),
  ('pompiste',      'Pompiste',                'Gère les ravitaillements carburant',                         7,  true),
  ('client',        'Client',                  'Passager — réservation et fidélité',                         99, true)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description  = EXCLUDED.description,
  level        = EXCLUDED.level;

-- ============================================================
-- PERMISSIONS GRANULAIRES (version consolidée 002)
-- ============================================================
INSERT INTO permissions (name, display_name, resource, action) VALUES
  -- Users
  ('users:read',           'Voir les utilisateurs',          'users',        'read'),
  ('users:create',         'Créer un utilisateur',           'users',        'create'),
  ('users:update',         'Modifier un utilisateur',        'users',        'update'),
  ('users:delete',         'Supprimer un utilisateur',       'users',        'delete'),
  ('users:suspend',        'Suspendre un compte',            'users',        'suspend'),
  ('users:invite',         'Inviter par email',              'users',        'invite'),
  ('users:manage_roles',   'Gérer les rôles',                'users',        'manage_roles'),
  -- Companies
  ('companies:read',       'Voir les sociétés',              'companies',    'read'),
  ('companies:manage',     'Gérer les sociétés',             'companies',    'manage'),
  -- Buses
  ('buses:read',           'Voir les bus',                   'buses',        'read'),
  ('buses:manage',         'Gérer les bus',                  'buses',        'manage'),
  -- Routes & Schedules
  ('routes:read',          'Voir les itinéraires',           'routes',       'read'),
  ('routes:manage',        'Gérer les itinéraires',          'routes',       'manage'),
  ('schedules:read',       'Voir la planification',          'schedules',    'read'),
  ('schedules:create',     'Créer un voyage',                'schedules',    'create'),
  ('schedules:manage',     'Gérer la planification',         'schedules',    'manage'),
  -- Reservations
  ('reservations:read',    'Voir les réservations',          'reservations', 'read'),
  ('reservations:create',  'Créer une réservation',          'reservations', 'create'),
  ('reservations:manage',  'Gérer les réservations',         'reservations', 'manage'),
  -- Payments
  ('payments:read',        'Voir les paiements',             'payments',     'read'),
  ('payments:manage',      'Gérer les paiements',            'payments',     'manage'),
  -- Fuel
  ('fuel:read',            'Voir le carburant',              'fuel',         'read'),
  ('fuel:fill',            'Remplir un bon de carburant',    'fuel',         'fill'),
  ('fuel:validate',        'Valider les bons carburant',     'fuel',         'validate'),
  -- Expenses
  ('expenses:read',        'Voir les charges bus',           'expenses',     'read'),
  ('expenses:create',      'Saisir une charge',              'expenses',     'create'),
  ('expenses:validate',    'Valider les charges',            'expenses',     'validate'),
  -- Maintenance
  ('maintenance:read',     'Voir la maintenance',            'maintenance',  'read'),
  ('maintenance:manage',   'Gérer la maintenance',           'maintenance',  'manage'),
  ('maintenance:validate', 'Valider les OT',                 'maintenance',  'validate'),
  -- Stock
  ('stock:read',           'Voir le stock pièces',           'stock',        'read'),
  ('stock:manage',         'Gérer le stock pièces',          'stock',        'manage'),
  -- Reports
  ('reports:read',         'Voir les rapports',              'reports',      'read'),
  ('reports:export',       'Exporter les rapports',          'reports',      'export'),
  -- Loyalty
  ('loyalty:read',         'Voir la fidélité',               'loyalty',      'read'),
  ('loyalty:manage',       'Gérer la fidélité',              'loyalty',      'manage'),
  -- Settings
  ('settings:read',        'Voir les paramètres',            'settings',     'read'),
  ('settings:manage',      'Gérer les paramètres',           'settings',     'manage'),
  -- Logs
  ('logs:read',            'Voir les journaux d''activité',  'logs',         'read')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- ATTRIBUTION PERMISSIONS PAR RÔLE
-- (ON CONFLICT DO NOTHING pour ne pas écraser les existantes)
-- ============================================================

-- ADMIN : toutes les permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- DAF : lecture finances + rapports
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'daf'
  AND p.name IN (
    'companies:read','buses:read','routes:read','schedules:read',
    'reservations:read','payments:read','fuel:read','expenses:read',
    'maintenance:read','reports:read','reports:export','logs:read'
  )
ON CONFLICT DO NOTHING;

-- COMPTABLE : validation dépenses
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'comptable'
  AND p.name IN (
    'fuel:read','fuel:validate','expenses:read','expenses:validate',
    'maintenance:read','maintenance:validate','payments:read',
    'reports:read','reports:export'
  )
ON CONFLICT DO NOTHING;

-- GESTIONNAIRE : ses bus uniquement (filtrage RLS)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'gestionnaire'
  AND p.name IN (
    'buses:read','routes:read','schedules:read','reservations:read',
    'fuel:read','expenses:read','maintenance:read','reports:read'
  )
ON CONFLICT DO NOTHING;

-- PLANIFICATEUR : planification et disponibilités
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'planificateur'
  AND p.name IN (
    'routes:read','schedules:read','schedules:create','schedules:manage',
    'buses:read','users:read'
  )
ON CONFLICT DO NOTHING;

-- CHEF GARAGE : garage + maintenance + stock
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'chef_garage'
  AND p.name IN (
    'maintenance:read','maintenance:manage','stock:read','stock:manage',
    'buses:read','reports:read'
  )
ON CONFLICT DO NOTHING;

-- CHAUFFEUR : ses voyages + bons carburant + pannes
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'chauffeur'
  AND p.name IN ('schedules:read','fuel:fill','maintenance:read')
ON CONFLICT DO NOTHING;

-- GUICHETIER : réservations + paiements + caisse
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'guichetier'
  AND p.name IN (
    'reservations:read','reservations:create','reservations:manage',
    'payments:read','payments:manage','schedules:read','loyalty:read'
  )
ON CONFLICT DO NOTHING;

-- MÉCANICIEN : ses OT uniquement
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'mecanicien'
  AND p.name IN ('maintenance:read','maintenance:manage','stock:read')
ON CONFLICT DO NOTHING;

-- POMPISTE : bons carburant
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'pompiste'
  AND p.name IN ('fuel:read','fuel:fill','schedules:read')
ON CONFLICT DO NOTHING;

-- CLIENT : ses propres réservations + fidélité
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'client'
  AND p.name IN ('reservations:create','reservations:read','loyalty:read','payments:read')
ON CONFLICT DO NOTHING;
