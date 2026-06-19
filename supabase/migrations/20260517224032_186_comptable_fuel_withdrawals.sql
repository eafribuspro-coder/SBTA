/*
  # Comptable Fuel Withdrawals Module

  ## Summary
  Creates a table for tracking fuel withdrawals recorded by the comptable role.
  This is separate from the pompiste fuel operations (tank deliveries/removals)
  and from the guichetier carburant BE (bus departure fuel surcharges).
  
  This table records each fuel fill-up event for a bus, linked to a fuel station,
  and is scoped to the comptable's company.

  ## New Tables
  - `comptable_fuel_withdrawals`
    - `id` (uuid, pk)
    - `company_id` (uuid, fk → companies) — multi-tenancy isolation
    - `bus_id` (uuid, fk → buses)
    - `registration_number` (text) — denormalized for reporting
    - `driver_id` (uuid, fk → users, nullable) — assigned driver
    - `driver_name` (text, nullable) — denormalized
    - `fuel_station_id` (uuid, fk → fuel_stations, nullable) — station selected
    - `station_name` (text) — denormalized for history
    - `station_code` (text) — denormalized
    - `city` (text, nullable) — city of the withdrawal
    - `fuel_type` (text) — 'essence' | 'gasoil'
    - `liters` (numeric) — quantity in liters
    - `unit_price` (numeric, nullable) — price per liter at time of recording
    - `total_amount` (numeric) — computed: liters × unit_price
    - `withdrawal_date` (date) — date of the withdrawal
    - `observations` (text, nullable)
    - `created_by` (uuid, fk → users)
    - `created_at`, `updated_at` (timestamps)

  ## Security
  - RLS enabled
  - Comptable can only see/manage their own company's withdrawals
  - Admin can read all
*/

CREATE TABLE IF NOT EXISTS comptable_fuel_withdrawals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id),
  bus_id              uuid NOT NULL REFERENCES buses(id),
  registration_number text NOT NULL DEFAULT '',
  driver_id           uuid REFERENCES users(id),
  driver_name         text,
  fuel_station_id     uuid REFERENCES fuel_stations(id),
  station_name        text NOT NULL DEFAULT '',
  station_code        text NOT NULL DEFAULT '',
  city                text,
  fuel_type           text NOT NULL CHECK (fuel_type IN ('essence', 'gasoil')),
  liters              numeric(10,2) NOT NULL CHECK (liters > 0),
  unit_price          numeric(12,2),
  total_amount        numeric(14,2) NOT NULL CHECK (total_amount >= 0),
  withdrawal_date     date NOT NULL DEFAULT CURRENT_DATE,
  observations        text,
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS idx_cfw_company_date ON comptable_fuel_withdrawals (company_id, withdrawal_date DESC);
CREATE INDEX IF NOT EXISTS idx_cfw_bus         ON comptable_fuel_withdrawals (bus_id);
CREATE INDEX IF NOT EXISTS idx_cfw_station     ON comptable_fuel_withdrawals (fuel_station_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_comptable_fuel_withdrawals_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cfw_updated_at ON comptable_fuel_withdrawals;
CREATE TRIGGER trg_cfw_updated_at
  BEFORE UPDATE ON comptable_fuel_withdrawals
  FOR EACH ROW EXECUTE FUNCTION update_comptable_fuel_withdrawals_updated_at();

-- RLS
ALTER TABLE comptable_fuel_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comptable can select own company withdrawals"
  ON comptable_fuel_withdrawals
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT u.company_id FROM users u
      WHERE u.id = auth.uid() AND u.is_active = true
      LIMIT 1
    )
  );

CREATE POLICY "Comptable can insert own company withdrawals"
  ON comptable_fuel_withdrawals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (
      SELECT u.company_id FROM users u
      WHERE u.id = auth.uid() AND u.is_active = true
      LIMIT 1
    )
  );

CREATE POLICY "Comptable can update own company withdrawals"
  ON comptable_fuel_withdrawals
  FOR UPDATE
  TO authenticated
  USING (
    company_id = (
      SELECT u.company_id FROM users u
      WHERE u.id = auth.uid() AND u.is_active = true
      LIMIT 1
    )
  )
  WITH CHECK (
    company_id = (
      SELECT u.company_id FROM users u
      WHERE u.id = auth.uid() AND u.is_active = true
      LIMIT 1
    )
  );

CREATE POLICY "Comptable can delete own company withdrawals"
  ON comptable_fuel_withdrawals
  FOR DELETE
  TO authenticated
  USING (
    company_id = (
      SELECT u.company_id FROM users u
      WHERE u.id = auth.uid() AND u.is_active = true
      LIMIT 1
    )
  );

CREATE POLICY "Admin can read all fuel withdrawals"
  ON comptable_fuel_withdrawals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
        AND u.is_active = true
    )
  );
