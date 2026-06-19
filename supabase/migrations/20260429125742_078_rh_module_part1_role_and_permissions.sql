/*
  # Module RH — Parties 1.2 & 1.3 : Rôle RH et Permissions

  ## Résumé
  Crée le rôle `rh` dans la table `roles` et attribue toutes les permissions
  nécessaires pour la gestion des ressources humaines.

  ## Nouvelles permissions
  - `employees:read`        — Voir tous les employés
  - `employees:create`      — Créer un employé
  - `employees:update`      — Modifier un employé
  - `employees:deactivate`  — Désactiver un employé
  - `employees:view_salary` — Voir les salaires
  - `employees:export`      — Exporter les listes
  - `payroll:read`          — Voir les masses salariales
  - `payroll:export`        — Exporter rapports salaires
  - `contracts:upload`      — Téléverser des contrats
  - `contracts:download`    — Télécharger des contrats

  ## Attributions
  - Rôle `rh` : toutes les permissions ci-dessus + companies, buses, stations, users, reports (read)
  - Rôle `admin` : ajout de view_salary, payroll, contracts

  ## Notes
  - Tout est idempotent via ON CONFLICT DO NOTHING
*/

-- 1.2 — Rôle RH
INSERT INTO roles (name, display_name, description, level, is_system)
VALUES (
  'rh',
  'Responsable RH',
  'Gestion des ressources humaines — tous les employés de toutes les sociétés',
  3,
  true
)
ON CONFLICT (name) DO NOTHING;

-- 1.3 — Permissions RH
INSERT INTO permissions (name, display_name, resource, action) VALUES
  ('employees:read',        'Voir tous les employés',       'employees', 'read'),
  ('employees:create',      'Créer un employé',             'employees', 'create'),
  ('employees:update',      'Modifier un employé',          'employees', 'update'),
  ('employees:deactivate',  'Désactiver un employé',        'employees', 'deactivate'),
  ('employees:view_salary', 'Voir les salaires',            'employees', 'view_salary'),
  ('employees:export',      'Exporter les listes',          'employees', 'export'),
  ('payroll:read',          'Voir les masses salariales',   'payroll',   'read'),
  ('payroll:export',        'Exporter rapports salaires',   'payroll',   'export'),
  ('contracts:upload',      'Téléverser des contrats',      'contracts', 'upload'),
  ('contracts:download',    'Télécharger des contrats',     'contracts', 'download')
ON CONFLICT (name) DO NOTHING;

-- Attribuer toutes les permissions RH au rôle rh
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'rh'
  AND p.name IN (
    'employees:read','employees:create','employees:update','employees:deactivate',
    'employees:view_salary','employees:export',
    'payroll:read','payroll:export',
    'contracts:upload','contracts:download',
    'companies:read','buses:read','stations:read','users:read','reports:read'
  )
ON CONFLICT DO NOTHING;

-- Donner à admin les permissions financières RH aussi
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
  AND p.name IN (
    'employees:view_salary','payroll:read','payroll:export',
    'contracts:upload','contracts:download'
  )
ON CONFLICT DO NOTHING;
