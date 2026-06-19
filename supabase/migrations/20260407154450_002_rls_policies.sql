/*
  # RLS Policies pour SBTA

  1. Règles de sécurité
    - Admin: accès complet à toutes les tables
    - DAF: lecture seule sur les données financières
    - Comptable: validation des dépenses (fuel_vouchers, bus_expenses, maintenance_work_orders)
    - Gestionnaire: accès aux bus de sa société uniquement
    - Chauffeur: accès à ses propres données et voyages assignés
    - Guichetier: création et gestion des réservations
    - Chef garage: gestion des pannes et diagnostics
    - Mécanicien: accès aux OT qui lui sont assignés
    - Planificateur: gestion des plannings
    - Pompiste: gestion des ravitaillements
    - Client: accès à ses propres réservations et profil

  2. Politiques par table
    - Chaque table a des policies SELECT, INSERT, UPDATE, DELETE adaptées au rôle
    - Les données sont filtrées selon le rôle et la société si applicable
*/

-- Helper function pour récupérer le rôle de l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Helper function pour récupérer la société de l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid();
$$;

-- ============================================================================
-- COMPANIES POLICIES
-- ============================================================================
CREATE POLICY "Admin can view all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Gestionnaire can view own company"
  ON companies FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'gestionnaire' AND id = public.get_user_company_id());

CREATE POLICY "Staff can view all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('daf', 'comptable', 'planificateur', 'chef_garage'));

CREATE POLICY "Admin can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Admin can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Admin can delete companies"
  ON companies FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- ============================================================================
-- USERS POLICIES
-- ============================================================================
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admin can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Staff can view users"
  ON users FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('daf', 'comptable', 'planificateur', 'chef_garage', 'guichetier'));

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admin can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Admin can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Admin can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- ============================================================================
-- CITIES POLICIES
-- ============================================================================
CREATE POLICY "Anyone can view active cities"
  ON cities FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admin can manage cities"
  ON cities FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ============================================================================
-- AMENITIES POLICIES
-- ============================================================================
CREATE POLICY "Anyone can view amenities"
  ON amenities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage amenities"
  ON amenities FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ============================================================================
-- BUS_SEAT_CONFIG POLICIES
-- ============================================================================
CREATE POLICY "Anyone can view seat configs"
  ON bus_seat_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage seat configs"
  ON bus_seat_config FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ============================================================================
-- STATIONS POLICIES
-- ============================================================================
CREATE POLICY "Anyone can view active stations"
  ON stations FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admin can manage stations"
  ON stations FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ============================================================================
-- COUNTERS POLICIES
-- ============================================================================
CREATE POLICY "Staff can view counters"
  ON counters FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'guichetier', 'planificateur'));

CREATE POLICY "Admin can manage counters"
  ON counters FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ============================================================================
-- BOARDING_POINTS POLICIES
-- ============================================================================
CREATE POLICY "Anyone can view active boarding points"
  ON boarding_points FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admin can manage boarding points"
  ON boarding_points FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ============================================================================
-- BUSES POLICIES
-- ============================================================================
CREATE POLICY "Staff can view all buses"
  ON buses FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'daf', 'comptable', 'planificateur', 'chef_garage', 'mecanicien', 'pompiste', 'chauffeur'));

CREATE POLICY "Gestionnaire can view own company buses"
  ON buses FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'gestionnaire' AND company_id = public.get_user_company_id());

CREATE POLICY "Admin can insert buses"
  ON buses FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Admin can update buses"
  ON buses FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Chef garage can update bus status"
  ON buses FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'chef_garage')
  WITH CHECK (public.get_user_role() = 'chef_garage');

CREATE POLICY "Admin can delete buses"
  ON buses FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- ============================================================================
-- ROUTES POLICIES
-- ============================================================================
CREATE POLICY "Anyone can view active routes"
  ON routes FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admin can manage routes"
  ON routes FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Planificateur can manage routes"
  ON routes FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'planificateur')
  WITH CHECK (public.get_user_role() = 'planificateur');

-- ============================================================================
-- SCHEDULES POLICIES
-- ============================================================================
CREATE POLICY "Anyone can view schedules"
  ON schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Planificateur can insert schedules"
  ON schedules FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'planificateur'));

CREATE POLICY "Planificateur can update schedules"
  ON schedules FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'planificateur'))
  WITH CHECK (public.get_user_role() IN ('admin', 'planificateur'));

CREATE POLICY "Chauffeur can update own schedules"
  ON schedules FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'chauffeur' AND driver_id = auth.uid())
  WITH CHECK (public.get_user_role() = 'chauffeur' AND driver_id = auth.uid());

CREATE POLICY "Admin can delete schedules"
  ON schedules FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- ============================================================================
-- RESERVATIONS POLICIES
-- ============================================================================
CREATE POLICY "Clients can view own reservations"
  ON reservations FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'client' AND customer_id = auth.uid());

CREATE POLICY "Staff can view all reservations"
  ON reservations FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'daf', 'comptable', 'guichetier', 'planificateur'));

CREATE POLICY "Chauffeur can view own trip reservations"
  ON reservations FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'chauffeur' AND
    EXISTS (
      SELECT 1 FROM schedules
      WHERE schedules.id = reservations.schedule_id
      AND schedules.driver_id = auth.uid()
    )
  );

CREATE POLICY "Guichetier can insert reservations"
  ON reservations FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'guichetier'));

CREATE POLICY "Client can insert own reservations"
  ON reservations FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'client' AND customer_id = auth.uid());

CREATE POLICY "Guichetier can update reservations"
  ON reservations FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'guichetier'))
  WITH CHECK (public.get_user_role() IN ('admin', 'guichetier'));

CREATE POLICY "Client can cancel own reservations"
  ON reservations FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'client' AND customer_id = auth.uid())
  WITH CHECK (public.get_user_role() = 'client' AND customer_id = auth.uid());

-- ============================================================================
-- PAYMENTS POLICIES
-- ============================================================================
CREATE POLICY "Client can view own payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'client' AND
    EXISTS (
      SELECT 1 FROM reservations
      WHERE reservations.id = payments.reservation_id
      AND reservations.customer_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view all payments"
  ON payments FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'daf', 'comptable', 'guichetier'));

CREATE POLICY "Guichetier can insert payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'guichetier'));

CREATE POLICY "Guichetier can update payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'guichetier'))
  WITH CHECK (public.get_user_role() IN ('admin', 'guichetier'));

-- ============================================================================
-- DRIVER_HOURS_LOG POLICIES
-- ============================================================================
CREATE POLICY "Chauffeur can view own hours"
  ON driver_hours_log FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'chauffeur' AND driver_id = auth.uid());

CREATE POLICY "Staff can view all driver hours"
  ON driver_hours_log FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'daf', 'planificateur'));

CREATE POLICY "System can insert driver hours"
  ON driver_hours_log FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'planificateur', 'chauffeur'));

-- ============================================================================
-- DRIVER_REVIEWS POLICIES
-- ============================================================================
CREATE POLICY "Chauffeur can view own reviews"
  ON driver_reviews FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'chauffeur' AND driver_id = auth.uid());

CREATE POLICY "Client can view own reviews"
  ON driver_reviews FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'client' AND customer_id = auth.uid());

CREATE POLICY "Staff can view all reviews"
  ON driver_reviews FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'daf'));

CREATE POLICY "Client can insert reviews"
  ON driver_reviews FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'client' AND customer_id = auth.uid());

-- ============================================================================
-- DRIVER_PERFORMANCE POLICIES
-- ============================================================================
CREATE POLICY "Chauffeur can view own performance"
  ON driver_performance FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'chauffeur' AND driver_id = auth.uid());

CREATE POLICY "Staff can view all driver performance"
  ON driver_performance FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'daf', 'planificateur'));

CREATE POLICY "System can manage driver performance"
  ON driver_performance FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'planificateur'))
  WITH CHECK (public.get_user_role() IN ('admin', 'planificateur'));

-- ============================================================================
-- LOYALTY_REWARDS_CATALOG POLICIES
-- ============================================================================
CREATE POLICY "Anyone can view active rewards"
  ON loyalty_rewards_catalog FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admin can manage rewards catalog"
  ON loyalty_rewards_catalog FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ============================================================================
-- LOYALTY_POINTS_LOG POLICIES
-- ============================================================================
CREATE POLICY "Client can view own points log"
  ON loyalty_points_log FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'client' AND customer_id = auth.uid());

CREATE POLICY "Staff can view all points logs"
  ON loyalty_points_log FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'guichetier'));

CREATE POLICY "System can insert points log"
  ON loyalty_points_log FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'guichetier'));

-- ============================================================================
-- LOYALTY_REDEMPTIONS POLICIES
-- ============================================================================
CREATE POLICY "Client can view own redemptions"
  ON loyalty_redemptions FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'client' AND customer_id = auth.uid());

CREATE POLICY "Staff can view all redemptions"
  ON loyalty_redemptions FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'guichetier'));

CREATE POLICY "Client can insert redemptions"
  ON loyalty_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'client' AND customer_id = auth.uid());

CREATE POLICY "Guichetier can validate redemptions"
  ON loyalty_redemptions FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'guichetier'))
  WITH CHECK (public.get_user_role() IN ('admin', 'guichetier'));

-- ============================================================================
-- FUEL_VOUCHERS POLICIES
-- ============================================================================
CREATE POLICY "Chauffeur can view own fuel vouchers"
  ON fuel_vouchers FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'chauffeur' AND driver_id = auth.uid());

CREATE POLICY "Staff can view all fuel vouchers"
  ON fuel_vouchers FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'daf', 'comptable', 'pompiste'));

CREATE POLICY "System can insert fuel vouchers"
  ON fuel_vouchers FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'planificateur'));

CREATE POLICY "Comptable can validate fuel vouchers"
  ON fuel_vouchers FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'comptable')
  WITH CHECK (public.get_user_role() = 'comptable');

CREATE POLICY "Pompiste can use fuel vouchers"
  ON fuel_vouchers FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'pompiste')
  WITH CHECK (public.get_user_role() = 'pompiste');

-- ============================================================================
-- FUEL_ESTIMATIONS POLICIES
-- ============================================================================
CREATE POLICY "Staff can view fuel estimations"
  ON fuel_estimations FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'daf', 'comptable', 'planificateur'));

CREATE POLICY "Admin can manage fuel estimations"
  ON fuel_estimations FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ============================================================================
-- FUEL_LOGS POLICIES
-- ============================================================================
CREATE POLICY "Staff can view fuel logs"
  ON fuel_logs FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'daf', 'comptable', 'pompiste'));

CREATE POLICY "Pompiste can insert fuel logs"
  ON fuel_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'pompiste'));

CREATE POLICY "Pompiste can update fuel logs"
  ON fuel_logs FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'pompiste'))
  WITH CHECK (public.get_user_role() IN ('admin', 'pompiste'));

-- ============================================================================
-- BUS_EXPENSES POLICIES
-- ============================================================================
CREATE POLICY "Staff can view bus expenses"
  ON bus_expenses FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'daf', 'comptable', 'chauffeur', 'chef_garage'));

CREATE POLICY "Chauffeur can insert bus expenses"
  ON bus_expenses FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'chauffeur', 'chef_garage'));

CREATE POLICY "Comptable can validate bus expenses"
  ON bus_expenses FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'comptable')
  WITH CHECK (public.get_user_role() = 'comptable');

-- ============================================================================
-- BREAKDOWN_REPORTS POLICIES
-- ============================================================================
CREATE POLICY "Staff can view breakdown reports"
  ON breakdown_reports FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'chauffeur', 'chef_garage', 'mecanicien', 'planificateur'));

CREATE POLICY "Chauffeur can insert breakdown reports"
  ON breakdown_reports FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'chauffeur'));

CREATE POLICY "Chef garage can update breakdown reports"
  ON breakdown_reports FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'chef_garage'))
  WITH CHECK (public.get_user_role() IN ('admin', 'chef_garage'));

-- ============================================================================
-- MAINTENANCE_DIAGNOSTICS POLICIES
-- ============================================================================
CREATE POLICY "Staff can view diagnostics"
  ON maintenance_diagnostics FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'chef_garage', 'mecanicien', 'comptable'));

CREATE POLICY "Chef garage can insert diagnostics"
  ON maintenance_diagnostics FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'chef_garage'));

CREATE POLICY "Chef garage can update diagnostics"
  ON maintenance_diagnostics FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'chef_garage'))
  WITH CHECK (public.get_user_role() IN ('admin', 'chef_garage'));

-- ============================================================================
-- SPARE_PARTS POLICIES
-- ============================================================================
CREATE POLICY "Staff can view spare parts"
  ON spare_parts FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'chef_garage', 'mecanicien', 'comptable'));

CREATE POLICY "Chef garage can manage spare parts"
  ON spare_parts FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'chef_garage'))
  WITH CHECK (public.get_user_role() IN ('admin', 'chef_garage'));

-- ============================================================================
-- SPARE_PARTS_SUPPLIERS POLICIES
-- ============================================================================
CREATE POLICY "Staff can view suppliers"
  ON spare_parts_suppliers FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'chef_garage', 'comptable'));

CREATE POLICY "Admin can manage suppliers"
  ON spare_parts_suppliers FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ============================================================================
-- SPARE_PARTS_PURCHASE_ORDERS POLICIES
-- ============================================================================
CREATE POLICY "Staff can view purchase orders"
  ON spare_parts_purchase_orders FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'chef_garage', 'comptable'));

CREATE POLICY "Chef garage can insert purchase orders"
  ON spare_parts_purchase_orders FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'chef_garage'));

CREATE POLICY "Comptable can validate purchase orders"
  ON spare_parts_purchase_orders FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'comptable')
  WITH CHECK (public.get_user_role() = 'comptable');

-- ============================================================================
-- SPARE_PARTS_STOCK_MOVEMENTS POLICIES
-- ============================================================================
CREATE POLICY "Staff can view stock movements"
  ON spare_parts_stock_movements FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'chef_garage', 'mecanicien', 'comptable'));

CREATE POLICY "Staff can insert stock movements"
  ON spare_parts_stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'chef_garage', 'mecanicien'));

-- ============================================================================
-- MAINTENANCE_WORK_ORDERS POLICIES
-- ============================================================================
CREATE POLICY "Staff can view work orders"
  ON maintenance_work_orders FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'chef_garage', 'mecanicien', 'comptable'));

CREATE POLICY "Mecanicien can view assigned work orders"
  ON maintenance_work_orders FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'mecanicien' AND assigned_to = auth.uid());

CREATE POLICY "Chef garage can insert work orders"
  ON maintenance_work_orders FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'chef_garage'));

CREATE POLICY "Comptable can validate work orders"
  ON maintenance_work_orders FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'comptable')
  WITH CHECK (public.get_user_role() = 'comptable');

CREATE POLICY "Chef garage can update work orders"
  ON maintenance_work_orders FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'chef_garage'))
  WITH CHECK (public.get_user_role() IN ('admin', 'chef_garage'));

CREATE POLICY "Mecanicien can update assigned work orders"
  ON maintenance_work_orders FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'mecanicien' AND assigned_to = auth.uid())
  WITH CHECK (public.get_user_role() = 'mecanicien' AND assigned_to = auth.uid());

-- ============================================================================
-- INCIDENTS POLICIES
-- ============================================================================
CREATE POLICY "Staff can view incidents"
  ON incidents FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'daf', 'chauffeur', 'planificateur'));

CREATE POLICY "Chauffeur can insert incidents"
  ON incidents FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'chauffeur'));

CREATE POLICY "Admin can update incidents"
  ON incidents FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ============================================================================
-- STATION_DISPLAY_BOARDS POLICIES
-- ============================================================================
CREATE POLICY "Anyone can view display boards"
  ON station_display_boards FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admin can manage display boards"
  ON station_display_boards FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');
