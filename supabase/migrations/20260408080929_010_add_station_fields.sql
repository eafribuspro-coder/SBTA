/*
  # Add email and display_screen_enabled to stations

  1. Changes
    - Add `email` column to stations table
    - Add `display_screen_enabled` column to stations table (default false)
  
  2. Notes
    - Uses IF NOT EXISTS to prevent errors if columns already exist
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'email'
  ) THEN
    ALTER TABLE stations ADD COLUMN email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'display_screen_enabled'
  ) THEN
    ALTER TABLE stations ADD COLUMN display_screen_enabled boolean DEFAULT false;
  END IF;
END $$;
