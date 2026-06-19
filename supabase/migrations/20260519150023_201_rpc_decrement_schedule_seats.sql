/*
  # Atomic schedule seats decrement RPC

  ## Problem
  When multiple counters sell tickets simultaneously, they each read `seats_available`,
  compute the new value on the client, and write it back. This overwrites each other's
  changes (lost-update race condition).

  ## Fix
  Create an atomic RPC `decrement_schedule_seats(p_schedule_id, p_count)` that uses
  SQL GREATEST to prevent going below 0 and atomic increment/decrement.
*/

CREATE OR REPLACE FUNCTION decrement_schedule_seats(
  p_schedule_id uuid,
  p_count       int
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE schedules
  SET seats_available = GREATEST(0, seats_available - p_count),
      seats_reserved  = seats_reserved + p_count
  WHERE id = p_schedule_id;
$$;

GRANT EXECUTE ON FUNCTION decrement_schedule_seats(uuid, int) TO authenticated;
