/*
  # Migration 003 — RLS Policies RBAC

  ## Résumé
  Activation du Row Level Security et définition des politiques d'accès
  pour les tables du système RBAC SBTA.

  ## Tables concernées
  - users, organizations, roles, permissions, role_permissions, activity_logs, user_sessions

  ## Helper Functions
  - get_my_role() : retourne le rôle de l'utilisateur connecté
  - get_my_org()  : retourne l'organization_id de l'utilisateur connecté
  - has_permission(perm_name) : vérifie si l'utilisateur possède une permission

  ## Politiques RLS
  - users : accès propre + admin/daf voient tout + gestionnaire voit son org
  - organizations : lecture par rôles autorisés, gestion admin
  - roles/permissions/role_permissions : lecture authentifiée, gestion admin
  - activity_logs : admin voit tout, user voit ses propres logs, insertion système libre
  - user_sessions : RLS activé (pas de politiques dans cette partie)

  ## Notes
  - ON CONFLICT DO NOTHING sur les politiques pour éviter les erreurs si elles existent déjà
  - Les helper functions sont créées avec CREATE OR REPLACE
*/

-- ============================================================
-- ACTIVATION RLS SUR LES TABLES RBAC
-- ============================================================
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_my_org()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT organization_id FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION has_permission(perm_name text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    JOIN roles r ON r.id = rp.role_id
    JOIN users u ON u.role = r.name
    WHERE u.id = auth.uid()
      AND p.name = perm_name
      AND rp.granted = true
  )
$$;

-- ============================================================
-- POLITIQUES RLS — USERS
-- ============================================================

DROP POLICY IF EXISTS "users_see_own" ON users;
CREATE POLICY "users_see_own" ON users
  FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "admin_daf_see_all_users" ON users;
CREATE POLICY "admin_daf_see_all_users" ON users
  FOR SELECT
  USING (get_my_role() IN ('admin', 'daf'));

DROP POLICY IF EXISTS "gestionnaire_see_org_users" ON users;
CREATE POLICY "gestionnaire_see_org_users" ON users
  FOR SELECT
  USING (
    get_my_role() = 'gestionnaire'
    AND organization_id = get_my_org()
  );

DROP POLICY IF EXISTS "admin_manage_users" ON users;
CREATE POLICY "admin_manage_users" ON users
  FOR ALL
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "user_update_own_profile" ON users;
CREATE POLICY "user_update_own_profile" ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM users WHERE id = auth.uid())
  );

-- ============================================================
-- POLITIQUES RLS — ORGANIZATIONS
-- ============================================================

DROP POLICY IF EXISTS "all_can_read_orgs" ON organizations;
CREATE POLICY "all_can_read_orgs" ON organizations
  FOR SELECT
  USING (get_my_role() IN ('admin', 'daf', 'comptable', 'gestionnaire', 'planificateur'));

DROP POLICY IF EXISTS "admin_manage_orgs" ON organizations;
CREATE POLICY "admin_manage_orgs" ON organizations
  FOR ALL
  USING (get_my_role() = 'admin');

-- ============================================================
-- POLITIQUES RLS — ROLES
-- ============================================================

DROP POLICY IF EXISTS "admin_manage_roles" ON roles;
CREATE POLICY "admin_manage_roles" ON roles
  FOR ALL
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "all_read_roles" ON roles;
CREATE POLICY "all_read_roles" ON roles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- POLITIQUES RLS — PERMISSIONS
-- ============================================================

DROP POLICY IF EXISTS "all_read_permissions" ON permissions;
CREATE POLICY "all_read_permissions" ON permissions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- POLITIQUES RLS — ROLE_PERMISSIONS
-- ============================================================

DROP POLICY IF EXISTS "admin_manage_role_permissions" ON role_permissions;
CREATE POLICY "admin_manage_role_permissions" ON role_permissions
  FOR ALL
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "all_read_role_permissions" ON role_permissions;
CREATE POLICY "all_read_role_permissions" ON role_permissions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- POLITIQUES RLS — ACTIVITY_LOGS
-- ============================================================

DROP POLICY IF EXISTS "admin_see_all_logs" ON activity_logs;
CREATE POLICY "admin_see_all_logs" ON activity_logs
  FOR SELECT
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "user_see_own_logs" ON activity_logs;
CREATE POLICY "user_see_own_logs" ON activity_logs
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "system_insert_logs" ON activity_logs;
CREATE POLICY "system_insert_logs" ON activity_logs
  FOR INSERT
  WITH CHECK (true);
