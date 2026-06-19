/*
  # Chargé d'Achat — Vehicle Expenses Module

  ## New Tables
  1. `expense_categories` — Configurable categories (Dépannage mécanique, Pneus, etc.)
  2. `fleet_vehicles` — Vehicles per company (identified by registration plate)
  3. `vehicle_expenses` — Individual expense entries per vehicle per week

  ## Security
  - RLS enabled on all tables
  - charge_achat, admin, daf can read/write all
  - gestionnaire, comptable can read
*/

-- 1. Expense categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  icon        text NOT NULL DEFAULT '📦',
  color       text NOT NULL DEFAULT '#6B7280',
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read expense categories"
  ON expense_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "charge_achat and admin can insert expense categories"
  ON expense_categories FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('charge_achat','admin','daf')
  );

CREATE POLICY "charge_achat and admin can update expense categories"
  ON expense_categories FOR UPDATE TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) IN ('charge_achat','admin','daf'))
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) IN ('charge_achat','admin','daf'));

CREATE POLICY "charge_achat and admin can delete expense categories"
  ON expense_categories FOR DELETE TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) IN ('charge_achat','admin','daf'));

-- 2. Fleet vehicles
CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number text NOT NULL,
  company_id          uuid REFERENCES companies(id) ON DELETE CASCADE,
  brand               text,
  model               text,
  is_active           boolean NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE (registration_number, company_id)
);

CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_company ON fleet_vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_reg ON fleet_vehicles(registration_number);

ALTER TABLE fleet_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read fleet vehicles"
  ON fleet_vehicles FOR SELECT TO authenticated USING (true);

CREATE POLICY "charge_achat and admin can insert fleet vehicles"
  ON fleet_vehicles FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) IN ('charge_achat','admin','daf'));

CREATE POLICY "charge_achat and admin can update fleet vehicles"
  ON fleet_vehicles FOR UPDATE TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) IN ('charge_achat','admin','daf'))
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) IN ('charge_achat','admin','daf'));

CREATE POLICY "charge_achat and admin can delete fleet vehicles"
  ON fleet_vehicles FOR DELETE TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) IN ('charge_achat','admin','daf'));

-- 3. Vehicle expenses
CREATE TABLE IF NOT EXISTS vehicle_expenses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id          uuid REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration_number text NOT NULL,
  expense_date        date NOT NULL,
  week_start          date NOT NULL,
  category_id         uuid REFERENCES expense_categories(id) ON DELETE SET NULL,
  description         text NOT NULL,
  supplier            text,
  amount              numeric(12,0) NOT NULL CHECK (amount >= 0),
  notes               text,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_company    ON vehicle_expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_vehicle    ON vehicle_expenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_week       ON vehicle_expenses(week_start);
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_date       ON vehicle_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_reg        ON vehicle_expenses(registration_number);

ALTER TABLE vehicle_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "charge_achat admin daf can read all expenses"
  ON vehicle_expenses FOR SELECT TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('charge_achat','admin','daf','comptable','gestionnaire')
  );

CREATE POLICY "charge_achat and admin can insert expenses"
  ON vehicle_expenses FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) IN ('charge_achat','admin','daf'));

CREATE POLICY "charge_achat and admin can update expenses"
  ON vehicle_expenses FOR UPDATE TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) IN ('charge_achat','admin','daf'))
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) IN ('charge_achat','admin','daf'));

CREATE POLICY "charge_achat and admin can delete expenses"
  ON vehicle_expenses FOR DELETE TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) IN ('charge_achat','admin','daf'));
