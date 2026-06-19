/*
  # Fix seed seat configs and generate per-bus seat layouts

  1. Problem
    - Seed bus_seat_config records (fc000001-...) have no seat_layout, left_columns, right_columns or aisle_position
    - Multiple buses share the same config id — so editing one would break all others
    - The guichetier booking page cannot show the seat map without a proper seat_layout

  2. Fix
    - Update seed configs with proper left_columns, right_columns, aisle_position values
    - Generate proper seat_layout JSONB for each seed config based on its name/capacity type
    - Give every bus that shares a config its own dedicated bus_seat_config record

  3. Layout generation approach
    - Standard 49 (2+2): 13 rows × 4 seats, aisle after col 2, back row 5 seats
    - VIP 39 (2+1): 13 rows × 3 seats, aisle after col 2, back row 5 seats
    - Executive 30 (1+1): 15 rows × 2 seats, aisle after col 1, no back row
    - Minibus 22 (2+2): 5 rows × 4 seats + back row 4 seats, aisle after col 2
    - Grande 65: 16 rows × 4 seats, aisle after col 2, back row 5 seats
*/

-- ============================================================
-- Helper: generate_seat_layout_json
-- Returns a jsonb array of rows with seats (same format as busConfig.service.ts)
-- ============================================================
CREATE OR REPLACE FUNCTION generate_seat_layout_json(
  p_rows        integer,
  p_left_cols   integer,
  p_right_cols  integer,
  p_has_back    boolean,
  p_back_seats  integer
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result       jsonb := '[]'::jsonb;
  row_obj      jsonb;
  seats_arr    jsonb;
  seat_obj     jsonb;
  r            integer;
  c            integer;
  col_index    integer;
  seat_label   text;
  col_letter   text;
  total_cols   integer;
BEGIN
  total_cols := p_left_cols + p_right_cols;

  -- Normal rows
  FOR r IN 1..p_rows LOOP
    seats_arr := '[]'::jsonb;
    col_index := 0;
    FOR c IN 1..total_cols LOOP
      col_index := c;
      -- Map column index to letter (A, B, C, D...)
      col_letter := chr(64 + c);
      seat_label := r::text || col_letter;
      seat_obj := jsonb_build_object(
        'id',       seat_label,
        'label',    seat_label,
        'side',     CASE WHEN c <= p_left_cols THEN 'left' ELSE 'right' END,
        'type',     'normal',
        'position', jsonb_build_object('row', r, 'col', c)
      );
      seats_arr := seats_arr || jsonb_build_array(seat_obj);
    END LOOP;
    row_obj := jsonb_build_object('row', r, 'seats', seats_arr);
    result := result || jsonb_build_array(row_obj);
  END LOOP;

  -- Back row
  IF p_has_back AND p_back_seats > 0 THEN
    seats_arr := '[]'::jsonb;
    FOR c IN 1..p_back_seats LOOP
      col_letter := chr(64 + c);
      seat_label := (p_rows + 1)::text || col_letter;
      seat_obj := jsonb_build_object(
        'id',       seat_label,
        'label',    seat_label,
        'side',     'back',
        'type',     'normal',
        'position', jsonb_build_object('row', p_rows + 1, 'col', c)
      );
      seats_arr := seats_arr || jsonb_build_array(seat_obj);
    END LOOP;
    row_obj := jsonb_build_object('row', p_rows + 1, 'seats', seats_arr, 'row_type', 'back');
    result := result || jsonb_build_array(row_obj);
  END IF;

  RETURN result;
END;
$$;

-- ============================================================
-- Update seed configs with proper column info and seat_layout
-- ============================================================

-- Standard 49 places (2+2) — 13 rows, aisle after col 2, no back row
UPDATE bus_seat_config SET
  left_columns   = 2,
  right_columns  = 2,
  aisle_position = 2,
  back_row       = false,
  back_row_seats = 0,
  seat_layout    = generate_seat_layout_json(13, 2, 2, false, 0),
  total_capacity = 52,
  total_seats    = 52
WHERE id = 'fc000001-0000-0000-0000-000000000001';

-- VIP 39 places (2+1) — 13 rows, aisle after col 2, no back row
UPDATE bus_seat_config SET
  left_columns   = 2,
  right_columns  = 1,
  aisle_position = 2,
  back_row       = false,
  back_row_seats = 0,
  seat_layout    = generate_seat_layout_json(13, 2, 1, false, 0),
  total_capacity = 39,
  total_seats    = 39
WHERE id = 'fc000001-0000-0000-0000-000000000002';

-- Executive 30 places (1+1) — 15 rows, aisle after col 1, no back row
UPDATE bus_seat_config SET
  left_columns   = 1,
  right_columns  = 1,
  aisle_position = 1,
  back_row       = false,
  back_row_seats = 0,
  seat_layout    = generate_seat_layout_json(15, 1, 1, false, 0),
  total_capacity = 30,
  total_seats    = 30
WHERE id = 'fc000001-0000-0000-0000-000000000003';

-- Mini-bus 22 places (2+2) — 5 rows + back row 4, aisle after col 2
UPDATE bus_seat_config SET
  left_columns   = 2,
  right_columns  = 2,
  aisle_position = 2,
  back_row       = true,
  back_row_seats = 4,
  seat_layout    = generate_seat_layout_json(5, 2, 2, true, 4),
  total_capacity = 24,
  total_seats    = 24,
  rows           = 5
WHERE id = 'fc000001-0000-0000-0000-000000000004';

-- Grande capacité 65 places (2+2+1) — 16 rows + back row 5
UPDATE bus_seat_config SET
  left_columns   = 2,
  right_columns  = 2,
  aisle_position = 2,
  back_row       = true,
  back_row_seats = 5,
  seat_layout    = generate_seat_layout_json(16, 2, 2, true, 5),
  total_capacity = 69,
  total_seats    = 69,
  rows           = 16
WHERE id = 'fc000001-0000-0000-0000-000000000005';

-- ============================================================
-- Create individual seat configs for each bus that shares one
-- and point each bus to its own config
-- ============================================================

-- We'll use a DO block to loop through buses sharing seed configs and create individual ones
DO $$
DECLARE
  rec RECORD;
  new_config_id uuid;
  src_config RECORD;
BEGIN
  FOR rec IN
    SELECT b.id AS bus_id, b.registration_number, b.seat_config_id, b.capacity, b.total_seats,
           b.bus_deck_type, b.driver_position
    FROM buses b
    WHERE b.seat_config_id IN (
      'fc000001-0000-0000-0000-000000000001',
      'fc000001-0000-0000-0000-000000000002',
      'fc000001-0000-0000-0000-000000000003',
      'fc000001-0000-0000-0000-000000000004',
      'fc000001-0000-0000-0000-000000000005'
    )
    AND b.bus_deck_type = 'simple'
  LOOP
    SELECT * INTO src_config FROM bus_seat_config WHERE id = rec.seat_config_id;
    
    -- Create a new dedicated config for this bus
    INSERT INTO bus_seat_config (
      name, total_capacity, total_seats, rows,
      left_columns, right_columns, has_back_row, back_row, back_row_seats,
      aisle_position, seat_layout, deck_level, driver_position,
      total_columns, aisle_after_columns, default_seat_type, is_active, generated_at
    ) VALUES (
      rec.registration_number || ' — Plan principal',
      src_config.total_seats,
      src_config.total_seats,
      src_config.rows,
      src_config.left_columns,
      src_config.right_columns,
      src_config.back_row,
      src_config.back_row,
      src_config.back_row_seats,
      src_config.aisle_position,
      src_config.seat_layout,
      'simple',
      COALESCE(rec.driver_position, 'gauche'),
      COALESCE(src_config.left_columns, 2) + COALESCE(src_config.right_columns, 2),
      ARRAY[COALESCE(src_config.aisle_position, 2)],
      'normal',
      true,
      now()
    ) RETURNING id INTO new_config_id;

    -- Update the bus to point to its own config
    UPDATE buses SET seat_config_id = new_config_id WHERE id = rec.bus_id;
  END LOOP;
END $$;

-- ============================================================
-- Drop helper function (no longer needed)
-- ============================================================
DROP FUNCTION IF EXISTS generate_seat_layout_json(integer, integer, integer, boolean, integer);
