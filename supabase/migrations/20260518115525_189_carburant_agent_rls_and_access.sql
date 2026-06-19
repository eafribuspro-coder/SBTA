/*
  # Accès agent carburant aux prélèvements

  ## Objectif
  Permettre aux agents ayant le rôle "carburant" de :
  - Créer des prélèvements de carburant pour tous les bus (pas de filtre société)
  - Lire tous les prélèvements qu'ils ont créés
  - Lire tous les bus actifs et chauffeurs (SELECT sur buses, users)
  - Lire les stations carburant actives

  ## Modifications
  - Ajout de politiques RLS sur `comptable_fuel_withdrawals` pour le rôle carburant
  - Helper function `get_my_role_for_carburant` réutilisé depuis fuel_services module
  - Le carburant peut voir tous ses prélèvements (created_by = auth.uid())
  - Le carburant peut insérer des prélèvements (avec company_id de sa société)

  ## Notes de sécurité
  - Le carburant ne peut PAS modifier ou supprimer des prélèvements
  - Le carburant ne voit que les prélèvements qu'il a créés personnellement
*/

-- Helper function (idem fuel_services, mais pour carburant)
CREATE OR REPLACE FUNCTION get_my_role_carburant()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT role FROM users WHERE id = auth.uid() LIMIT 1;
$$;

-- ── comptable_fuel_withdrawals: carburant access ──────────────

-- Agent carburant peut voir tous les prélèvements qu'il a créés
CREATE POLICY "Agent carburant can select own withdrawals"
  ON comptable_fuel_withdrawals FOR SELECT
  TO authenticated
  USING (
    get_my_role_carburant() = 'carburant'
    AND created_by = auth.uid()
  );

-- Agent carburant peut insérer des prélèvements
CREATE POLICY "Agent carburant can insert withdrawals"
  ON comptable_fuel_withdrawals FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role_carburant() = 'carburant'
    AND created_by = auth.uid()
  );

-- ── buses: carburant can read all active buses ─────────────────
-- (buses table already has authenticated read policies from earlier migrations)
-- We just ensure carburant is covered by checking if policy already exists

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'buses'
      AND policyname = 'Agent carburant can select all active buses'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Agent carburant can select all active buses"
        ON buses FOR SELECT
        TO authenticated
        USING (get_my_role_carburant() = 'carburant')
    $policy$;
  END IF;
END
$$;

-- ── users (chauffeurs): carburant can read all drivers ─────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users'
      AND policyname = 'Agent carburant can select all drivers'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Agent carburant can select all drivers"
        ON users FOR SELECT
        TO authenticated
        USING (
          get_my_role_carburant() = 'carburant'
          AND role = 'chauffeur'
        )
    $policy$;
  END IF;
END
$$;

-- ── fuel_stations: carburant can read active stations ──────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fuel_stations'
      AND policyname = 'Agent carburant can select active stations'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Agent carburant can select active stations"
        ON fuel_stations FOR SELECT
        TO authenticated
        USING (
          get_my_role_carburant() = 'carburant'
          AND is_active = true
        )
    $policy$;
  END IF;
END
$$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
