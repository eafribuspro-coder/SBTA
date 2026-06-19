/*
  # Fix try_lock_seat: all ambiguous column references

  The RETURNS TABLE columns (id, schedule_id, seat_number, locked_by, session_id, expires_at)
  create PL/pgSQL variables that shadow the seat_locks table columns, causing
  "column reference is ambiguous" errors at runtime.
  
  ## Fix
  - Drop and recreate with out_ prefixed return column names
  - Use explicit variable assignment instead of RETURNING INTO
  - Rebuild all grants
*/

DROP FUNCTION IF EXISTS try_lock_seat(uuid, text, text);

CREATE FUNCTION try_lock_seat(
  p_schedule_id  uuid,
  p_seat_number  text,
  p_session_id   text DEFAULT ''
)
RETURNS TABLE (
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
  v_user_id   uuid := auth.uid();
  v_existing  seat_locks%ROWTYPE;
  v_new_exp   timestamptz := now() + interval '3 minutes';
BEGIN
  -- 1. Clean up expired locks
  DELETE FROM seat_locks sl WHERE sl.expires_at <= now();

  -- 2. Check if seat already has a confirmed reservation
  IF EXISTS (
    SELECT 1 FROM reservations r
    WHERE r.schedule_id = p_schedule_id
      AND r.seat_numbers @> ARRAY[p_seat_number]::text[]
      AND r.status IN ('confirme','confirmee','en_attente','embarque')
  ) THEN
    RETURN; -- already reserved
  END IF;

  -- 3. Check existing lock
  SELECT sl.* INTO v_existing
    FROM seat_locks sl
    WHERE sl.schedule_id = p_schedule_id
      AND sl.seat_number  = p_seat_number;

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

  -- 4. No existing lock → create one
  INSERT INTO seat_locks(schedule_id, seat_number, locked_by, session_id, expires_at)
  VALUES (p_schedule_id, p_seat_number, v_user_id, p_session_id, v_new_exp)
  ON CONFLICT (schedule_id, seat_number) DO NOTHING;

  -- Verify the insert succeeded (DO NOTHING might not insert if race)
  SELECT sl.* INTO v_existing
    FROM seat_locks sl
    WHERE sl.schedule_id = p_schedule_id
      AND sl.seat_number  = p_seat_number
      AND sl.locked_by    = v_user_id;

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

GRANT EXECUTE ON FUNCTION try_lock_seat(uuid, text, text) TO authenticated;
