/*
  # Accès RH aux tables de référence

  ## Problème
  Le rôle `rh` n'est pas inclus dans les policies SELECT de :
  - `companies` (companies_select_staff)
  - `buses` (Staff can view all buses)
  
  Résultat : le formulaire RH ne peut pas charger les sociétés ni les bus.

  ## Solution
  Ajouter `rh` dans toutes les policies SELECT pertinentes sur companies et buses.
  Également ajouter `rh` pour la vue employees_rh_view (via les tables sous-jacentes).
*/

-- ── companies : ajouter rh ────────────────────────────────────────
DROP POLICY IF EXISTS "companies_select_staff" ON public.companies;

CREATE POLICY "companies_select_staff"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    get_my_role() = ANY (ARRAY[
      'rh', 'daf', 'comptable', 'planificateur',
      'chef_garage', 'gestionnaire', 'guichetier',
      'chauffeur', 'mecanicien', 'pompiste', 'chef_gare'
    ])
  );

-- ── buses : ajouter rh ────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view all buses" ON public.buses;

CREATE POLICY "Staff can view all buses"
  ON public.buses
  FOR SELECT
  TO authenticated
  USING (
    get_user_role() = ANY (ARRAY[
      'admin', 'rh', 'daf', 'comptable', 'planificateur',
      'chef_garage', 'mecanicien', 'pompiste', 'chauffeur', 'guichetier'
    ])
  );

-- ── stations : rh peut lire (already "Anyone can view active stations" covers it) ──
-- stations policy "Anyone can view active stations" uses is_active = true which is fine

-- ── routes : rh peut lire (already "Anyone can view active routes" covers it) ──
-- routes policy "Anyone can view active routes" uses is_active = true which is fine

-- ── employees_rh_view : policy SELECT pour rh ────────────────────
-- La vue lit employees et users, pas besoin de policy supplémentaire
-- car la vue est SECURITY DEFINER ou hérite des policies des tables sous-jacentes.
-- On s'assure que rh peut lire la table employees.

DO $$
BEGIN
  -- S'assurer que la table employees existe avant de modifier ses policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees' AND table_schema = 'public') THEN

    -- Policy SELECT pour rh sur employees
    DROP POLICY IF EXISTS "rh_can_select_employees" ON public.employees;
    CREATE POLICY "rh_can_select_employees"
      ON public.employees
      FOR SELECT
      TO authenticated
      USING (
        get_my_role() = ANY (ARRAY['admin', 'rh', 'daf'])
      );

    -- Policy INSERT pour rh sur employees (créer les fiches)
    DROP POLICY IF EXISTS "rh_can_insert_employees" ON public.employees;
    CREATE POLICY "rh_can_insert_employees"
      ON public.employees
      FOR INSERT
      TO authenticated
      WITH CHECK (
        get_my_role() = ANY (ARRAY['admin', 'rh'])
      );

    -- Policy UPDATE pour rh sur employees (modifier les fiches)
    DROP POLICY IF EXISTS "rh_can_update_employees" ON public.employees;
    CREATE POLICY "rh_can_update_employees"
      ON public.employees
      FOR UPDATE
      TO authenticated
      USING (
        get_my_role() = ANY (ARRAY['admin', 'rh'])
      )
      WITH CHECK (
        get_my_role() = ANY (ARRAY['admin', 'rh'])
      );

  END IF;
END $$;
