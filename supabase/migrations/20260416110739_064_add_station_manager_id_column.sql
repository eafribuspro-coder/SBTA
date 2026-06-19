
/*
  # Add station_manager_id column to stations table

  1. Changes
    - Add `station_manager_id` column (uuid, nullable, foreign key to users.id)
  
  2. Notes
    - Column was referenced in the frontend but missing from the schema
    - No data loss possible as it's an additive change
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'station_manager_id'
  ) THEN
    ALTER TABLE stations ADD COLUMN station_manager_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
