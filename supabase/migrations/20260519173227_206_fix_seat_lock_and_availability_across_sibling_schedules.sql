/*
  # Fix seat locking and availability checks across sibling schedules

  ## Problem
  When the same bus serves multiple schedules (from different counters) at the same
  departure time, try_lock_seat only checks reservations/locks on the specific schedule.
  Seats sold from another counter's schedule are not detected, allowing double-selling.

  ## Solution
  1. Create helper function `get_sibling_schedule_ids` that returns all schedule IDs
     sharing the same bus_id and departure_datetime.
  2. Update `try_lock_seat` to check reservations AND locks across all siblings.

  ## Impact
  - A seat sold from any counter will be detected by all other counters.
  - Seat locks are checked across all sibling schedules.
  - No double-selling possible even with shared buses.
*/

-- Helper: returns all schedule IDs sharing the same bus+departure_datetime
CREATE OR REPLACE FUNCTION get_sibling_schedule_ids(p_schedule_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(s2.id)
  FROM schedules s1
  JOIN schedules s2 ON s2.bus_id = s1.bus_id
                   AND s2.departure_datetime = s1.departure_datetime
  WHERE s1.id = p_schedule_id;
$$;

-- Drop and recreate try_lock_seat with sibling awareness
DROP FUNCTION IF EXISTS try_lock_seat(uuid, text, text);

CREATE FUNCTION try_lock_seat(
  p_schedule_id  uuid,
  p_seat_number  text,
  p_session_id   text
)
RETURNS TABLE(
  out_id          uuid,
  out_schedule_id uuid,
  out_seat_number text,
  out_locked_by   uuid,
  out_session_id  text,
  expires_at      timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_existing    seat_locks%ROWTYPE;
  v_new_exp     timestamptz := now() + interval '3 minutes';
  v_sibling_ids uuid[];
BEGIN
  -- Get all sibling schedule IDs (same bus + same departure time)
  v_sibling_ids := get_sibling_schedule_ids(p_schedule_id);

  -- 1. Clean up expired locks
  DELETE FROM seat_locks sl WHERE sl.expires_at <= now();

  -- 2. Check if seat already has a confirmed reservation on ANY sibling schedule
  IF EXISTS (
    SELECT 1 FROM reservations r
    WHERE r.schedule_id = ANY(v_sibling_ids)
      AND r.seat_numbers @> ARRAY[p_seat_number]::text[]
      AND r.status IN ('confirme','confirmee','en_attente','embarque')
  ) THEN
    RETURN; -- already reserved on a sibling
  END IF;

  -- 3. Check existing lock on ANY sibling schedule
  SELECT sl.* INTO v_existing
    FROM seat_locks sl
    WHERE sl.schedule_id = ANY(v_sibling_ids)
      AND sl.seat_number = p_seat_number;

  IF FOUND THEN
    IF v_existing.locked_by = v_user_id THEN
      -- Refresh expiry for our own lock
      UPDATE seat_locks sl2
        SET expires_at = v_new_exp,
            session_id = p_session_id
        WHERE sl2.id = v_existing.id;

      out_id          := v_existing.id;
      out_schedule_id := v_existing.schedule_id;
      out_seat_number := v_existing.seat_number;
      out_locked_by   := v_existing.locked_by;
      out_session_id  := p_session_id;
      try_lock_seat.expires_at := v_new_exp;
      RETURN NEXT;
      RETURN;
    END IF;
    -- Locked by someone else
    RETURN;
  END IF;

  -- 4. No existing lock -> create one
  INSERT INTO seat_locks(schedule_id, seat_number, locked_by, session_id, expires_at)
    VALUES (p_schedule_id, p_seat_number, v_user_id, p_session_id, v_new_exp)
    ON CONFLICT (schedule_id, seat_number) DO NOTHING;

  -- Verify the insert succeeded
  SELECT sl.* INTO v_existing
    FROM seat_locks sl
    WHERE sl.schedule_id = p_schedule_id
      AND sl.seat_number = p_seat_number
      AND sl.locked_by   = v_user_id;

  IF FOUND THEN
    out_id          := v_existing.id;
    out_schedule_id := v_existing.schedule_id;
    out_seat_number := v_existing.seat_number;
    out_locked_by   := v_existing.locked_by;
    out_session_id  := v_existing.session_id;
    try_lock_seat.expires_at := v_existing.expires_at;
    RETURN NEXT;
  END IF;
END;
$$;
