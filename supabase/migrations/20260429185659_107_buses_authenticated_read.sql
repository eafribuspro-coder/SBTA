/*
  # Lecture buses pour tous les utilisateurs authentifiés

  ## Problème
  Les policies SELECT sur buses utilisent get_user_role() avec des listes
  de rôles qui excluaient 'rh', 'chef_gare', 'daf', etc.
  Le formulaire RH ne pouvait pas charger la liste des bus.

  ## Solution
  Une policy SELECT unique pour tous les authenticated.
  Les données bus (immatriculation, marque) ne sont pas sensibles.
*/

DROP POLICY IF EXISTS "Staff can view all buses"          ON public.buses;
DROP POLICY IF EXISTS "Gestionnaire can view own company buses" ON public.buses;
DROP POLICY IF EXISTS "operational_staff_see_company_buses"    ON public.buses;

CREATE POLICY "buses_authenticated_read"
  ON public.buses
  FOR SELECT
  TO authenticated
  USING (true);
