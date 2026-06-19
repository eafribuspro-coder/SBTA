/*
  # Migration 027 — Correction RLS companies : remplacer get_user_role() par get_my_role()

  ## Problème
  Les politiques RLS de la table `companies` utilisent get_user_role() qui n'est pas
  SECURITY DEFINER. Cela provoque une récursion infinie quand users est interrogé
  via le RLS → erreur "stack depth limit exceeded" lors du chargement des utilisateurs.

  ## Solution
  Remplacer get_user_role() par get_my_role() (SECURITY DEFINER, migration 026)
  dans toutes les politiques de `companies`.

  ## Changements
  - Suppression et recréation de toutes les politiques SELECT/INSERT/UPDATE/DELETE sur companies
  - Toutes utilisent maintenant get_my_role() au lieu de get_user_role()
*/

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Admin can delete companies"       ON companies;
DROP POLICY IF EXISTS "Admin can insert companies"       ON companies;
DROP POLICY IF EXISTS "Gestionnaire can view own company" ON companies;
DROP POLICY IF EXISTS "Admin can view all companies"     ON companies;
DROP POLICY IF EXISTS "Staff can view all companies"     ON companies;
DROP POLICY IF EXISTS "Admin can update companies"       ON companies;

-- Recréer avec get_my_role() (SECURITY DEFINER)
CREATE POLICY "companies_select_admin"
  ON companies FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "companies_select_staff"
  ON companies FOR SELECT TO authenticated
  USING (get_my_role() IN ('daf', 'comptable', 'planificateur', 'chef_garage', 'gestionnaire', 'guichetier', 'chauffeur', 'mecanicien', 'pompiste'));

CREATE POLICY "companies_insert_admin"
  ON companies FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "companies_update_admin"
  ON companies FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "companies_delete_admin"
  ON companies FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');
