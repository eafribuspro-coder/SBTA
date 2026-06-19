/*
  # Migration 026 — Correction récursion infinie RLS (stack depth exceeded)

  ## Problème
  Les fonctions helper get_my_role() et get_my_org() interrogent la table `users`,
  mais les politiques RLS de `users` appellent ces mêmes fonctions → récursion infinie
  → erreur "stack depth limit exceeded" → Supabase Auth ne peut pas interroger le schéma.

  ## Solution
  1. Recréer get_my_role() et get_my_org() avec SECURITY DEFINER pour court-circuiter le RLS
  2. Supprimer toutes les politiques existantes sur users
  3. Recréer des politiques propres sans récursion

  ## Notes
  - SECURITY DEFINER sur les helpers permet de lire la table users sans passer par le RLS
  - Les politiques SELECT peuvent donc appeler get_my_role() sans récursion
*/

-- ============================================================
-- STEP 1 : Fonctions helper SECURITY DEFINER (contournent RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_my_org()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION has_permission(perm_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
-- STEP 2 : Supprimer TOUTES les politiques existantes sur users
-- ============================================================

DROP POLICY IF EXISTS "admin_daf_see_all_users"    ON users;
DROP POLICY IF EXISTS "admin_manage_users"          ON users;
DROP POLICY IF EXISTS "gestionnaire_see_org_users"  ON users;
DROP POLICY IF EXISTS "user_update_own_profile"     ON users;
DROP POLICY IF EXISTS "users_delete_admin"          ON users;
DROP POLICY IF EXISTS "users_insert_own"            ON users;
DROP POLICY IF EXISTS "users_see_own"               ON users;
DROP POLICY IF EXISTS "users_select_admin"          ON users;
DROP POLICY IF EXISTS "users_select_own"            ON users;
DROP POLICY IF EXISTS "users_select_staff"          ON users;
DROP POLICY IF EXISTS "users_update_admin"          ON users;
DROP POLICY IF EXISTS "users_update_own"            ON users;

-- Anciennes politiques d'autres migrations
DROP POLICY IF EXISTS "Users can view own profile"  ON users;
DROP POLICY IF EXISTS "Admins can view all users"   ON users;
DROP POLICY IF EXISTS "Admins can insert users"     ON users;
DROP POLICY IF EXISTS "Admins can update users"     ON users;
DROP POLICY IF EXISTS "Users can update own data"   ON users;
DROP POLICY IF EXISTS "allow_own_read"              ON users;
DROP POLICY IF EXISTS "allow_admin_read"            ON users;
DROP POLICY IF EXISTS "allow_own_update"            ON users;
DROP POLICY IF EXISTS "allow_admin_all"             ON users;

-- ============================================================
-- STEP 3 : Recréer les politiques sans récursion
-- ============================================================

-- SELECT : chaque utilisateur voit son propre profil (pas d'appel à get_my_role)
CREATE POLICY "users_select_own"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- SELECT : admin et DAF voient tout (get_my_role est SECURITY DEFINER → pas de récursion)
CREATE POLICY "users_select_admin_daf"
  ON users
  FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('admin', 'daf'));

-- SELECT : autres rôles staff voient les profils de base
CREATE POLICY "users_select_staff"
  ON users
  FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('comptable', 'planificateur', 'chef_garage', 'gestionnaire', 'guichetier'));

-- INSERT : admin seulement
CREATE POLICY "users_insert_admin"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

-- UPDATE : chaque user modifie son propre profil
CREATE POLICY "users_update_own"
  ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- UPDATE : admin modifie tous les utilisateurs
CREATE POLICY "users_update_admin"
  ON users
  FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- DELETE : admin seulement
CREATE POLICY "users_delete_admin"
  ON users
  FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');
