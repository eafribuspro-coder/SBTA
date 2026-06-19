/*
  # Fuel Stations Module

  ## Summary
  Creates a dedicated table for managing fuel stations used in the fuel management workflow.
  These stations are different from the bus "gares" (bus stations) — they are refueling points
  where vehicles go to fill up.

  ## New Tables
  - `fuel_stations`
    - `id` (uuid, primary key)
    - `name` (text, required) — display name of the station
    - `code` (text, unique, required) — short identifier code (e.g. "STF-001")
    - `fuel_types` (text[], required) — supported fuel types: 'essence', 'gasoil'
    - `price_essence` (numeric) — price per liter for essence at this station
    - `price_gasoil` (numeric) — price per liter for gasoil at this station
    - `phone` (text) — contact phone number
    - `is_active` (boolean, default true)
    - `observations` (text) — free-form notes
    - `created_at`, `updated_at` (timestamps)

  ## Security
  - RLS enabled
  - Admin: full CRUD access
  - Authenticated users: SELECT only (for fuel voucher workflows)
*/

CREATE TABLE IF NOT EXISTS fuel_stations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  code            text NOT NULL,
  fuel_types      text[] NOT NULL DEFAULT ARRAY['gasoil'],
  price_essence   numeric(12,2),
  price_gasoil    numeric(12,2),
  phone           text,
  is_active       boolean NOT NULL DEFAULT true,
  observations    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fuel_stations_code_unique UNIQUE (code)
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_fuel_stations_updated_at()
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

DROP TRIGGER IF EXISTS trg_fuel_stations_updated_at ON fuel_stations;
CREATE TRIGGER trg_fuel_stations_updated_at
  BEFORE UPDATE ON fuel_stations
  FOR EACH ROW EXECUTE FUNCTION update_fuel_stations_updated_at();

-- RLS
ALTER TABLE fuel_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage fuel stations"
  ON fuel_stations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
        AND users.is_active = true
    )
  );

CREATE POLICY "Admin can insert fuel stations"
  ON fuel_stations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
        AND users.is_active = true
    )
  );

CREATE POLICY "Admin can update fuel stations"
  ON fuel_stations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
        AND users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
        AND users.is_active = true
    )
  );

CREATE POLICY "Authenticated users can read active fuel stations"
  ON fuel_stations
  FOR SELECT
  TO authenticated
  USING (is_active = true);
