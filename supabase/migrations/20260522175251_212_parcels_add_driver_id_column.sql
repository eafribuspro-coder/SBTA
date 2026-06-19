/*
  # Add driver_id column to parcels table

  1. Modified Tables
    - `parcels`
      - Added `driver_id` (uuid, nullable) - references the manually selected driver

  2. Important notes
    - Allows storing the driver selected manually during parcel creation
    - The bus_id column already exists; driver_id completes the manual selection pair
    - No data loss: existing parcels keep their current schedule_id-based lookup
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parcels' AND column_name = 'driver_id'
  ) THEN
    ALTER TABLE parcels ADD COLUMN driver_id uuid REFERENCES users(id);
  END IF;
END $$;
