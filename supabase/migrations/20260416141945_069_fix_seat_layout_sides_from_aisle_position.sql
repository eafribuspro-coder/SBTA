/*
  # Fix seat layout side assignment

  ## Problem
  All seats in bus_seat_config.seat_layout are stored with side='left'
  regardless of their column position. The SeatMap component splits seats
  into left/right columns using the side field, so right-side seats never
  appear in the visual grid.

  ## Fix
  Recalculate each seat's side based on its column position relative to
  aisle_position:
  - col <= aisle_position → side = 'left'
  - col >  aisle_position → side = 'right'
  - row after last normal row (back row pattern) stays 'back' if already set

  ## Scope
  All rows in bus_seat_config where seat_layout is a non-empty JSON array.
*/

UPDATE bus_seat_config
SET seat_layout = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'row', row_obj->'row',
      'seats', (
        SELECT jsonb_agg(
          seat_obj
          || CASE
               WHEN (seat_obj->>'side') = 'back' THEN jsonb_build_object('side', 'back')
               WHEN (seat_obj->'position'->>'col')::int > bus_seat_config.aisle_position
               THEN jsonb_build_object('side', 'right')
               ELSE jsonb_build_object('side', 'left')
             END
        )
        FROM jsonb_array_elements(row_obj->'seats') AS seat_obj
      )
    )
  )
  FROM jsonb_array_elements(seat_layout) AS row_obj
)
WHERE seat_layout IS NOT NULL
  AND jsonb_array_length(seat_layout) > 0
  AND aisle_position IS NOT NULL;
