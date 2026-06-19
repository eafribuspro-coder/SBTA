/*
  # Reload PostgREST schema cache

  This migration triggers PostgREST to reload its schema cache so that
  recently added columns (has_back_row, left_columns, etc.) on bus_seat_config
  are recognized and accessible via the API.
*/

NOTIFY pgrst, 'reload schema';
