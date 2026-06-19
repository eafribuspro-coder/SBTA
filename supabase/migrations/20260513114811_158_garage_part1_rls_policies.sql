/*
  # PARTIE 1 — Migration 1.8
  Politiques RLS pour garages, garage_staff, maintenance_quotes.

  ## Règles
  - Admin : accès total à tout
  - Tous les rôles authentifiés (sauf client) : lecture des garages actifs
  - Chef de garage : lecture de son/ses garages, gestion de ses devis
  - Comptable : lecture + validation des devis des bus de SA société
  - Gestionnaire : lecture des devis des bus de sa société
  - DAF : lecture de tous les devis

  ## Notes
  - Utilise get_my_role() (fonction sécurisée existante, pas de récursion)
  - Séparation stricte SELECT / INSERT / UPDATE / DELETE
*/

-- ── garages ──────────────────────────────────────────────────────────────────

-- Admin : accès total
CREATE POLICY "admin_garages_select"
  ON garages FOR SELECT
  TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "admin_garages_insert"
  ON garages FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "admin_garages_update"
  ON garages FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "admin_garages_delete"
  ON garages FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');

-- Tous (hors client) : lecture des garages actifs/inactifs (pas archivés)
CREATE POLICY "auth_read_active_garages"
  ON garages FOR SELECT
  TO authenticated
  USING (
    status != 'archive'
    AND get_my_role() NOT IN ('client')
  );

-- ── garage_staff ─────────────────────────────────────────────────────────────

CREATE POLICY "admin_garage_staff_select"
  ON garage_staff FOR SELECT
  TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "admin_garage_staff_insert"
  ON garage_staff FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "admin_garage_staff_update"
  ON garage_staff FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "admin_garage_staff_delete"
  ON garage_staff FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');

-- Un membre du staff voit les entrées de son garage
CREATE POLICY "staff_read_own_garage_team"
  ON garage_staff FOR SELECT
  TO authenticated
  USING (
    garage_id IN (
      SELECT gs2.garage_id FROM garage_staff gs2
      WHERE gs2.user_id = auth.uid() AND gs2.is_active = true
    )
  );

-- ── maintenance_quotes ───────────────────────────────────────────────────────

-- Admin : accès total
CREATE POLICY "admin_quotes_select"
  ON maintenance_quotes FOR SELECT
  TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "admin_quotes_insert"
  ON maintenance_quotes FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "admin_quotes_update"
  ON maintenance_quotes FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "admin_quotes_delete"
  ON maintenance_quotes FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');

-- Chef de garage : crée et gère les devis de son garage
CREATE POLICY "chef_garage_quotes_select"
  ON maintenance_quotes FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'chef_garage'
    AND garage_id IN (
      SELECT gs.garage_id FROM garage_staff gs
      WHERE gs.user_id = auth.uid() AND gs.is_active = true
    )
  );

CREATE POLICY "chef_garage_quotes_insert"
  ON maintenance_quotes FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() = 'chef_garage'
    AND garage_id IN (
      SELECT gs.garage_id FROM garage_staff gs
      WHERE gs.user_id = auth.uid() AND gs.is_active = true
    )
  );

CREATE POLICY "chef_garage_quotes_update"
  ON maintenance_quotes FOR UPDATE
  TO authenticated
  USING (
    get_my_role() = 'chef_garage'
    AND garage_id IN (
      SELECT gs.garage_id FROM garage_staff gs
      WHERE gs.user_id = auth.uid() AND gs.is_active = true
    )
  )
  WITH CHECK (
    get_my_role() = 'chef_garage'
    AND garage_id IN (
      SELECT gs.garage_id FROM garage_staff gs
      WHERE gs.user_id = auth.uid() AND gs.is_active = true
    )
  );

-- Comptable : voit et valide les devis dont le bus appartient à SA société
CREATE POLICY "comptable_quotes_select"
  ON maintenance_quotes FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'comptable'
    AND bus_company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "comptable_quotes_update"
  ON maintenance_quotes FOR UPDATE
  TO authenticated
  USING (
    get_my_role() = 'comptable'
    AND bus_company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    get_my_role() = 'comptable'
    AND bus_company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Gestionnaire : lecture des devis des bus de sa société
CREATE POLICY "gestionnaire_quotes_select"
  ON maintenance_quotes FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'gestionnaire'
    AND bus_company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- DAF : lecture de tous les devis
CREATE POLICY "daf_quotes_select"
  ON maintenance_quotes FOR SELECT
  TO authenticated
  USING (get_my_role() = 'daf');
