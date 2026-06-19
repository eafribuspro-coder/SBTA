/*
  # Correction RLS employees pour permettre l'INSERT par le rôle rh

  ## Problème
  La policy "rh_gerer_employes" (FOR ALL) fait une sous-requête récursive
  sur la table employees elle-même, ce qui provoque une erreur lors de l'INSERT
  (infinite recursion / stack depth exceeded).

  ## Solution
  Remplacer toutes les policies employees par des versions simples basées
  uniquement sur le JWT (app_metadata.role) sans sous-requêtes récursives.
*/

-- Supprimer toutes les policies existantes sur employees
DROP POLICY IF EXISTS "rh_gerer_employes"           ON public.employees;
DROP POLICY IF EXISTS "rh_can_insert_employees"     ON public.employees;
DROP POLICY IF EXISTS "rh_can_select_employees"     ON public.employees;
DROP POLICY IF EXISTS "rh_can_update_employees"     ON public.employees;
DROP POLICY IF EXISTS "admin_voir_tous_employes"    ON public.employees;
DROP POLICY IF EXISTS "admin_update_account_fields" ON public.employees;
DROP POLICY IF EXISTS "daf_lecture_employes"        ON public.employees;
DROP POLICY IF EXISTS "employe_voir_son_profil"     ON public.employees;
DROP POLICY IF EXISTS "gestionnaire_sa_societe"     ON public.employees;

-- Helper : extraire le rôle depuis le JWT sans récursion
-- Toutes les policies utilisent auth.jwt() directement

CREATE POLICY "employees_select_rh_admin_daf"
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin','rh','daf'])
    OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = ANY (ARRAY['admin','rh','daf'])
  );

CREATE POLICY "employees_select_own_profile"
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "employees_insert_rh_admin"
  ON public.employees
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin','rh'])
    OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = ANY (ARRAY['admin','rh'])
  );

CREATE POLICY "employees_update_rh_admin"
  ON public.employees
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin','rh'])
    OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = ANY (ARRAY['admin','rh'])
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin','rh'])
    OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = ANY (ARRAY['admin','rh'])
  );

CREATE POLICY "employees_delete_admin"
  ON public.employees
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
