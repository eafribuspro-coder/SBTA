/*
  # Fix bus_seat_config Schema
  
  1. Changes
    - Add missing columns to bus_seat_config table:
      - left_columns (integer)
      - right_columns (integer)
      - back_row (boolean)
      - back_row_seats (integer)
      - aisle_position (integer)
      - seat_layout (jsonb)
      - total_capacity (integer)
    - Keep existing columns for backward compatibility
  
  2. Notes
    - This migration aligns the database schema with the application code
    - The table already exists, so we only add missing columns
*/

-- Add missing columns to bus_seat_config table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bus_seat_config' AND column_name = 'left_columns'
  ) THEN
    ALTER TABLE bus_seat_config ADD COLUMN left_columns integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bus_seat_config' AND column_name = 'right_columns'
  ) THEN
    ALTER TABLE bus_seat_config ADD COLUMN right_columns integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bus_seat_config' AND column_name = 'back_row'
  ) THEN
    ALTER TABLE bus_seat_config ADD COLUMN back_row boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bus_seat_config' AND column_name = 'back_row_seats'
  ) THEN
    ALTER TABLE bus_seat_config ADD COLUMN back_row_seats integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bus_seat_config' AND column_name = 'aisle_position'
  ) THEN
    ALTER TABLE bus_seat_config ADD COLUMN aisle_position integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bus_seat_config' AND column_name = 'seat_layout'
  ) THEN
    ALTER TABLE bus_seat_config ADD COLUMN seat_layout jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bus_seat_config' AND column_name = 'total_capacity'
  ) THEN
    ALTER TABLE bus_seat_config ADD COLUMN total_capacity integer;
  END IF;
END $$;