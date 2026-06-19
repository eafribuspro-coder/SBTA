/*
  # Extend fuel_vouchers and breakdown_reports for chauffeur workflow

  1. Changes to fuel_vouchers
    - Add estimated_unit_price (price per liter estimated)
    - Add actual_unit_price (actual price per liter paid)
    - Add departure_mileage (bus mileage at departure)
    - Add current_mileage (bus mileage after refuel)
    - Add fuel_station (name of the fuel station)
    - Add fuel_city (city where refueled)
    - Add receipt_photo_url (photo of the receipt)
    - Add notes (driver notes)
    - Add submitted_at (when driver submitted the form)

  2. Changes to breakdown_reports
    - Add driver_id column (who reported it)
    - Add title column (short description)
    - Add latitude / longitude (GPS coords)
    - Add photo_urls (array, replaces photos_urls)
    - Rename photos_urls -> keep both for compatibility

  3. New schedules for chauffeur1 test data (added via SQL)
*/

-- Fuel vouchers extensions
ALTER TABLE fuel_vouchers
  ADD COLUMN IF NOT EXISTS estimated_unit_price numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_unit_price numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS departure_mileage numeric(10,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_mileage numeric(10,1) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fuel_station text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fuel_city text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS receipt_photo_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz DEFAULT NULL;

-- Breakdown reports extensions
ALTER TABLE breakdown_reports
  ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES users(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS title text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS latitude numeric(10,6) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS longitude numeric(10,6) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}';
