/*
  # PARTIE 1 — SCHÉMA AUTH & RBAC SBTA

  ## Résumé
  Migration complète du système d'authentification et de contrôle d'accès basé sur les rôles (RBAC)
  pour la plateforme SBTA.

  ## Tables créées
  1. `organizations` — Sociétés membres de la holding SBTA
  2. `roles` — Rôles SBTA avec niveaux hiérarchiques
  3. `permissions` — Permissions granulaires au format "resource:action"
  4. `role_permissions` — Liaison rôles ↔ permissions
  5. `activity_logs` — Journal d'audit complet
  6. `user_sessions` — Suivi des sessions

  ## Table users modifiée
  - Ajout des colonnes RBAC manquantes (first_name, last_name, organization_id, status, etc.)
  - Ajout des colonnes chauffeur (license_number, license_category, limites horaires, performance)
  - Ajout des colonnes fidélité (loyalty_card_number, loyalty_tier amélioré)
  - Ajout des colonnes audit (created_by, updated_by, suspended_by, etc.)

  ## Notes
  - La table users existante est conservée et enrichie (pas de DROP)
  - Les colonnes existantes (full_name, company_id, etc.) sont conservées pour compatibilité
  - organization_id est le nouveau champ recommandé pour l'organisation (gestionnaires)
  - La FK circulaire est ajoutée après que toutes les colonnes existent
*/

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ORGANISATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          varchar(255) NOT NULL,
  code          varchar(50)  UNIQUE NOT NULL,
  description   text,
  logo_url      text,
  address       text,
  phone         varchar(50),
  email         varchar(255),
  status        text CHECK (status IN ('active','inactive','suspended')) DEFAULT 'active',
  created_by    uuid,
  updated_by    uuid,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ============================================================
-- 2. RÔLES SBTA
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text UNIQUE NOT NULL,
  display_name  varchar(100) NOT NULL,
  description   text,
  level         int NOT NULL DEFAULT 10,
  is_system     boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

-- ============================================================
-- 3. PERMISSIONS GRANULAIRES
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text UNIQUE NOT NULL,
  display_name  varchar(150) NOT NULL,
  description   text,
  resource      varchar(100) NOT NULL,
  action        varchar(50)  NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- ============================================================
-- 4. ASSOCIATION RÔLES ↔ PERMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       uuid REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE,
  granted       boolean DEFAULT true,
  PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- 5. ENRICHISSEMENT DE LA TABLE USERS EXISTANTE
-- Ajout des colonnes manquantes uniquement
-- ============================================================

-- Noms séparés (first_name / last_name)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='first_name') THEN
    ALTER TABLE users ADD COLUMN first_name varchar(100);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_name') THEN
    ALTER TABLE users ADD COLUMN last_name varchar(100);
  END IF;
END $$;

-- employee_id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='employee_id') THEN
    ALTER TABLE users ADD COLUMN employee_id varchar(50);
  END IF;
END $$;

-- organization_id (nouveau champ, distinct de company_id legacy)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='organization_id') THEN
    ALTER TABLE users ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

-- Champs permis de conduire (noms harmonisés)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='license_number') THEN
    ALTER TABLE users ADD COLUMN license_number varchar(100);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='license_expiry') THEN
    ALTER TABLE users ADD COLUMN license_expiry date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='license_category') THEN
    ALTER TABLE users ADD COLUMN license_category varchar(20);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='daily_drive_hours_limit') THEN
    ALTER TABLE users ADD COLUMN daily_drive_hours_limit decimal(4,2) DEFAULT 9.0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='weekly_drive_hours_limit') THEN
    ALTER TABLE users ADD COLUMN weekly_drive_hours_limit decimal(5,2) DEFAULT 48.0;
  END IF;
END $$;

-- Performance chauffeur (noms harmonisés)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='driver_average_rating') THEN
    ALTER TABLE users ADD COLUMN driver_average_rating decimal(3,2) DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='driver_total_points') THEN
    ALTER TABLE users ADD COLUMN driver_total_points int DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='driver_performance_level') THEN
    ALTER TABLE users ADD COLUMN driver_performance_level text CHECK (driver_performance_level IN ('bronze','argent','or','diamant')) DEFAULT 'bronze';
  END IF;
END $$;

-- loyalty_card_number
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='loyalty_card_number') THEN
    ALTER TABLE users ADD COLUMN loyalty_card_number varchar(20) UNIQUE;
  END IF;
END $$;

-- status (distinct de is_active)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='status') THEN
    ALTER TABLE users ADD COLUMN status text CHECK (status IN ('active','inactive','suspended','repos_obligatoire','pending_confirmation')) DEFAULT 'active';
  END IF;
END $$;

-- is_self_registered
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_self_registered') THEN
    ALTER TABLE users ADD COLUMN is_self_registered boolean DEFAULT false;
  END IF;
END $$;

-- Colonnes audit
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='created_by') THEN
    ALTER TABLE users ADD COLUMN created_by uuid;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='updated_by') THEN
    ALTER TABLE users ADD COLUMN updated_by uuid;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='suspended_by') THEN
    ALTER TABLE users ADD COLUMN suspended_by uuid;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='suspended_at') THEN
    ALTER TABLE users ADD COLUMN suspended_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='suspension_reason') THEN
    ALTER TABLE users ADD COLUMN suspension_reason text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_login') THEN
    ALTER TABLE users ADD COLUMN last_login timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_login_ip') THEN
    ALTER TABLE users ADD COLUMN last_login_ip inet;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role_changed_at') THEN
    ALTER TABLE users ADD COLUMN role_changed_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role_changed_by') THEN
    ALTER TABLE users ADD COLUMN role_changed_by uuid;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_changed_at') THEN
    ALTER TABLE users ADD COLUMN password_changed_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='invitation_token') THEN
    ALTER TABLE users ADD COLUMN invitation_token varchar(255);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='invitation_expires_at') THEN
    ALTER TABLE users ADD COLUMN invitation_expires_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='invitation_accepted_at') THEN
    ALTER TABLE users ADD COLUMN invitation_accepted_at timestamptz;
  END IF;
END $$;

-- FK circulaires (maintenant que les colonnes existent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='users_created_by_fkey' AND table_name='users') THEN
    ALTER TABLE users ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='users_updated_by_fkey' AND table_name='users') THEN
    ALTER TABLE users ADD CONSTRAINT users_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='users_suspended_by_fkey' AND table_name='users') THEN
    ALTER TABLE users ADD CONSTRAINT users_suspended_by_fkey FOREIGN KEY (suspended_by) REFERENCES users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='users_role_changed_by_fkey' AND table_name='users') THEN
    ALTER TABLE users ADD CONSTRAINT users_role_changed_by_fkey FOREIGN KEY (role_changed_by) REFERENCES users(id);
  END IF;
END $$;

-- FK organizations → users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='organizations_created_by_fkey' AND table_name='organizations') THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='organizations_updated_by_fkey' AND table_name='organizations') THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id);
  END IF;
END $$;

-- ============================================================
-- 6. JOURNAL D'ACTIVITÉ
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES users(id),
  target_id     uuid,
  target_type   varchar(100),
  action        varchar(100) NOT NULL,
  description   text,
  old_values    jsonb,
  new_values    jsonb,
  ip_address    inet,
  user_agent    text,
  created_at    timestamptz DEFAULT now()
);

-- ============================================================
-- 7. SESSIONS UTILISATEURS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
  session_token varchar(255) UNIQUE NOT NULL,
  ip_address    inet,
  user_agent    text,
  expires_at    timestamptz NOT NULL,
  is_revoked    boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

-- ============================================================
-- INDEX
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_loyalty_card ON users(loyalty_card_number);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_target ON activity_logs(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource, action);

-- ============================================================
-- TRIGGER updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='set_organizations_updated_at') THEN
    CREATE TRIGGER set_organizations_updated_at
      BEFORE UPDATE ON organizations
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ============================================================
-- SEED : Rôles système SBTA
-- ============================================================
INSERT INTO roles (name, display_name, description, level, is_system) VALUES
  ('admin',         'Administrateur',  'Accès total à la plateforme',                                    1,  true),
  ('daf',           'DAF',             'Directeur Administratif et Financier',                           2,  true),
  ('comptable',     'Comptable',       'Gestion comptable et financière',                                3,  true),
  ('gestionnaire',  'Gestionnaire',    'Gestion d''une société membre de la holding',                    4,  true),
  ('planificateur', 'Planificateur',   'Planification des trajets et horaires',                          5,  true),
  ('chef_garage',   'Chef Garage',     'Responsable du garage et des véhicules',                         6,  true),
  ('chauffeur',     'Chauffeur',       'Conducteur de bus',                                              7,  true),
  ('guichetier',    'Guichetier',      'Vente de billets et service client au guichet',                  7,  true),
  ('mecanicien',    'Mécanicien',      'Maintenance et réparation des véhicules',                        7,  true),
  ('pompiste',      'Pompiste',        'Gestion du carburant',                                           7,  true),
  ('client',        'Client',          'Client de la plateforme SBTA',                                   99, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SEED : Permissions granulaires
-- ============================================================
INSERT INTO permissions (name, display_name, resource, action) VALUES
  ('users:read',             'Voir les utilisateurs',           'users',           'read'),
  ('users:create',           'Créer des utilisateurs',          'users',           'create'),
  ('users:update',           'Modifier des utilisateurs',       'users',           'update'),
  ('users:delete',           'Supprimer des utilisateurs',      'users',           'delete'),
  ('users:manage',           'Gérer les utilisateurs',          'users',           'manage'),
  ('organizations:read',     'Voir les organisations',          'organizations',   'read'),
  ('organizations:create',   'Créer des organisations',         'organizations',   'create'),
  ('organizations:update',   'Modifier des organisations',      'organizations',   'update'),
  ('organizations:delete',   'Supprimer des organisations',     'organizations',   'delete'),
  ('buses:read',             'Voir les bus',                    'buses',           'read'),
  ('buses:create',           'Créer des bus',                   'buses',           'create'),
  ('buses:update',           'Modifier des bus',                'buses',           'update'),
  ('buses:delete',           'Supprimer des bus',               'buses',           'delete'),
  ('routes:read',            'Voir les lignes',                 'routes',          'read'),
  ('routes:create',          'Créer des lignes',                'routes',          'create'),
  ('routes:update',          'Modifier des lignes',             'routes',          'update'),
  ('routes:delete',          'Supprimer des lignes',            'routes',          'delete'),
  ('schedules:read',         'Voir les horaires',               'schedules',       'read'),
  ('schedules:create',       'Créer des horaires',              'schedules',       'create'),
  ('schedules:update',       'Modifier des horaires',           'schedules',       'update'),
  ('schedules:delete',       'Supprimer des horaires',          'schedules',       'delete'),
  ('reservations:read',      'Voir les réservations',           'reservations',    'read'),
  ('reservations:create',    'Créer des réservations',          'reservations',    'create'),
  ('reservations:update',    'Modifier des réservations',       'reservations',    'update'),
  ('reservations:validate',  'Valider des réservations',        'reservations',    'validate'),
  ('payments:read',          'Voir les paiements',              'payments',        'read'),
  ('payments:validate',      'Valider les paiements',           'payments',        'validate'),
  ('payments:export',        'Exporter les paiements',          'payments',        'export'),
  ('fuel_vouchers:read',     'Voir les bons carburant',         'fuel_vouchers',   'read'),
  ('fuel_vouchers:create',   'Créer des bons carburant',        'fuel_vouchers',   'create'),
  ('fuel_vouchers:validate', 'Valider des bons carburant',      'fuel_vouchers',   'validate'),
  ('bus_expenses:read',      'Voir les dépenses bus',           'bus_expenses',    'read'),
  ('bus_expenses:create',    'Créer des dépenses bus',          'bus_expenses',    'create'),
  ('bus_expenses:validate',  'Valider les dépenses bus',        'bus_expenses',    'validate'),
  ('work_orders:read',       'Voir les ordres de travail',      'work_orders',     'read'),
  ('work_orders:create',     'Créer des ordres de travail',     'work_orders',     'create'),
  ('work_orders:update',     'Modifier des ordres de travail',  'work_orders',     'update'),
  ('spare_parts:read',       'Voir les pièces détachées',       'spare_parts',     'read'),
  ('spare_parts:create',     'Créer des pièces détachées',      'spare_parts',     'create'),
  ('spare_parts:update',     'Modifier les pièces détachées',   'spare_parts',     'update'),
  ('reports:read',           'Voir les rapports',               'reports',         'read'),
  ('reports:export',         'Exporter les rapports',           'reports',         'export'),
  ('loyalty:read',           'Voir le programme fidélité',      'loyalty',         'read'),
  ('loyalty:manage',         'Gérer le programme fidélité',     'loyalty',         'manage'),
  ('driver_reviews:read',    'Voir les évaluations chauffeurs', 'driver_reviews',  'read'),
  ('driver_reviews:create',  'Créer des évaluations',           'driver_reviews',  'create'),
  ('settings:read',          'Voir les paramètres',             'settings',        'read'),
  ('settings:manage',        'Gérer les paramètres',            'settings',        'manage')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SEED : Attribution des permissions par rôle
-- ============================================================

CREATE OR REPLACE FUNCTION _assign_perms(p_role text, p_perms text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_role_id uuid;
  v_perm_id uuid;
  v_perm text;
BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = p_role;
  IF v_role_id IS NULL THEN RETURN; END IF;
  FOREACH v_perm IN ARRAY p_perms LOOP
    SELECT id INTO v_perm_id FROM permissions WHERE name = v_perm;
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id, granted)
      VALUES (v_role_id, v_perm_id, true)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- admin : toutes les permissions
DO $$
DECLARE all_perms text[];
BEGIN
  SELECT array_agg(name) INTO all_perms FROM permissions;
  PERFORM _assign_perms('admin', all_perms);
END $$;

SELECT _assign_perms('daf', ARRAY[
  'users:read','organizations:read','buses:read','routes:read','schedules:read',
  'reservations:read','payments:read','payments:validate','payments:export',
  'fuel_vouchers:read','fuel_vouchers:validate','bus_expenses:read','bus_expenses:validate',
  'work_orders:read','spare_parts:read','reports:read','reports:export',
  'loyalty:read','driver_reviews:read','settings:read'
]);

SELECT _assign_perms('comptable', ARRAY[
  'users:read','organizations:read','buses:read','routes:read','schedules:read',
  'reservations:read','payments:read','payments:export',
  'fuel_vouchers:read','fuel_vouchers:validate','bus_expenses:read','bus_expenses:validate',
  'work_orders:read','spare_parts:read','reports:read','reports:export','loyalty:read'
]);

SELECT _assign_perms('gestionnaire', ARRAY[
  'users:read','organizations:read','buses:read','buses:update',
  'routes:read','schedules:read','schedules:create','schedules:update',
  'reservations:read','reservations:validate','payments:read',
  'fuel_vouchers:read','fuel_vouchers:create','bus_expenses:read','bus_expenses:create',
  'work_orders:read','spare_parts:read','reports:read','loyalty:read','driver_reviews:read'
]);

SELECT _assign_perms('planificateur', ARRAY[
  'users:read','buses:read','routes:read',
  'schedules:read','schedules:create','schedules:update','schedules:delete',
  'reservations:read','reports:read'
]);

SELECT _assign_perms('chef_garage', ARRAY[
  'buses:read','buses:update',
  'work_orders:read','work_orders:create','work_orders:update',
  'spare_parts:read','spare_parts:create','spare_parts:update',
  'fuel_vouchers:read','fuel_vouchers:validate',
  'bus_expenses:read','reports:read','driver_reviews:read'
]);

SELECT _assign_perms('chauffeur', ARRAY[
  'schedules:read','reservations:read',
  'fuel_vouchers:read','fuel_vouchers:create','work_orders:read'
]);

SELECT _assign_perms('guichetier', ARRAY[
  'reservations:read','reservations:create','reservations:validate',
  'payments:read','loyalty:read','loyalty:manage',
  'schedules:read','buses:read','routes:read'
]);

SELECT _assign_perms('mecanicien', ARRAY[
  'work_orders:read','work_orders:update','spare_parts:read','buses:read'
]);

SELECT _assign_perms('pompiste', ARRAY[
  'fuel_vouchers:read','fuel_vouchers:validate','buses:read'
]);

SELECT _assign_perms('client', ARRAY[
  'reservations:read','reservations:create','schedules:read',
  'routes:read','loyalty:read','driver_reviews:create'
]);

DROP FUNCTION IF EXISTS _assign_perms(text, text[]);

-- ============================================================
-- SEED : Organisations SBTA
-- ============================================================
INSERT INTO organizations (name, code, description, status) VALUES
  ('SBTA Express',   'SBTA-EXP', 'Service de transport express inter-urbain',   'active'),
  ('SBTA Premium',   'SBTA-PRM', 'Service de transport premium et VIP',         'active'),
  ('SBTA Regional',  'SBTA-REG', 'Service de transport régional et périphérique','active')
ON CONFLICT (code) DO NOTHING;
