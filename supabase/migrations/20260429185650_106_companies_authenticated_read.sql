/*
  # Lecture companies pour tous les utilisateurs authentifiés

  ## Problème
  La policy companies_select_staff utilise get_my_role() qui peut échouer
  silencieusement dans certains contextes (jointures implicites PostgREST,
  utilisateurs dont le rôle n'est pas encore dans employees).

  ## Solution
  Ajouter une policy SELECT simple pour tout utilisateur authentifié.
  Les données société (nom, code) ne sont pas sensibles — tous les employés
  doivent pouvoir les lire pour alimenter les formulaires.
*/

-- Remplacer les deux policies SELECT par une seule simple et fiable
DROP POLICY IF EXISTS "companies_select_admin"  ON public.companies;
DROP POLICY IF EXISTS "companies_select_staff"  ON public.companies;

-- Une seule policy : tout utilisateur authentifié peut lire les sociétés
CREATE POLICY "companies_authenticated_read"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (true);

-- Garder les policies write admin-only
-- (companies_insert_admin, companies_update_admin, companies_delete_admin inchangées)
