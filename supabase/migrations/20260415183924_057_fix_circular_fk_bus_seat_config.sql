/*
  # Fix circular FK between buses and bus_seat_config

  ## Problem
  PostgREST fails schema introspection ("Database error querying schema") due to a
  circular foreign key reference:
    - buses.seat_config_id          -> bus_seat_config.id
    - buses.lower_deck_config_id    -> bus_seat_config.id
    - buses.upper_deck_config_id    -> bus_seat_config.id
    - bus_seat_config.bus_id        -> buses.id  <-- creates the cycle

  PostgREST cannot resolve the schema graph when two tables reference each other
  as parent AND child simultaneously.

  ## Fix
  Drop the FK constraint on bus_seat_config.bus_id (the column is kept for data
  integrity as a plain column, the relationship is already expressed by
  buses.seat_config_id). This breaks the cycle without any data loss.

  ## Impact
  - No data is deleted or modified
  - bus_seat_config.bus_id column is preserved (just loses FK enforcement)
  - The canonical relationship remains: buses.seat_config_id -> bus_seat_config.id
*/

ALTER TABLE public.bus_seat_config
  DROP CONSTRAINT IF EXISTS bus_seat_config_bus_id_fkey;

-- Reload PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');
