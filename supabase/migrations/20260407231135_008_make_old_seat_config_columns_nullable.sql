/*
  # Make old bus_seat_config columns nullable
  
  1. Changes
    - Make old columns nullable to allow new column structure:
      - total_seats: NOT NULL -> NULLABLE with default 0
      - columns: NOT NULL -> NULLABLE with default 0
      - layout_map: NOT NULL -> NULLABLE with default '{}'
    
  2. Reason
    - The application now uses the new column structure (left_columns, right_columns, etc.)
    - The old columns are kept for backward compatibility but should not be required
    - This allows the application to insert records using the new structure
*/

-- Make total_seats nullable with default
ALTER TABLE bus_seat_config 
  ALTER COLUMN total_seats DROP NOT NULL,
  ALTER COLUMN total_seats SET DEFAULT 0;

-- Make columns nullable with default
ALTER TABLE bus_seat_config 
  ALTER COLUMN columns DROP NOT NULL,
  ALTER COLUMN columns SET DEFAULT 0;

-- Make layout_map nullable with default
ALTER TABLE bus_seat_config 
  ALTER COLUMN layout_map DROP NOT NULL,
  ALTER COLUMN layout_map SET DEFAULT '{}'::jsonb;