/*
  # PARTIE 1.4 — Politiques RLS sur employees

  ## Politiques
  - RH : gestion complète de tous les employés
  - Admin : lecture de tous + mise à jour des champs de compte
  - Employé : lecture de son propre profil
  - Gestionnaire : lecture des employés de sa société
  - DAF : lecture seule de tous les employés
*/

-- RH : peut créer, voir et modifier tous les employés
CREATE POLICY "rh_gerer_employes"
  ON public.employees FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'rh'
    OR (SELECT role FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1) = 'rh'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'rh'
    OR (SELECT role FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1) = 'rh'
  );

-- Admin : voit tous les employés (pour créer les comptes)
CREATE POLICY "admin_voir_tous_employes"
  ON public.employees FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (SELECT role FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1) = 'admin'
  );

-- Admin : peut mettre à jour les champs de compte
CREATE POLICY "admin_update_account_fields"
  ON public.employees FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (SELECT role FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1) = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (SELECT role FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1) = 'admin'
  );

-- Chaque employé voit son propre profil
CREATE POLICY "employe_voir_son_profil"
  ON public.employees FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Gestionnaire : voit les employés de sa société
CREATE POLICY "gestionnaire_sa_societe"
  ON public.employees FOR SELECT
  TO authenticated
  USING (
    (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'gestionnaire'
      OR (SELECT role FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1) = 'gestionnaire'
    )
    AND company_id = public.get_my_company_id()
  );

-- DAF : lecture seule de tous les employés
CREATE POLICY "daf_lecture_employes"
  ON public.employees FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = ANY(ARRAY['daf','admin','rh'])
    OR (SELECT role FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1) = ANY(ARRAY['daf','admin','rh'])
  );
