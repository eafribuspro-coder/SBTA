/*
  # Fix try_lock_seat: ambiguous column reference

  The function `try_lock_seat` was failing with:
    "column reference 'expires_at' is ambiguous"

  This happened because the function RETURNS TABLE(..., expires_at timestamptz)
  which creates a PL/pgSQL variable named `expires_at` that conflicts with the
  `seat_locks.expires_at` column in the DELETE statement.

  ## Fix
  - Qualify all `seat_locks` column references with the table alias
  - Use explicit table-qualified references in DELETE, SELECT, UPDATE, INSERT
*/

CREATE OR REPLACE FUNCTION try_lock_seat(
  p_schedule_id  uuid,
  p_seat_number  text,
  p_session_id   text DEFAULT ''
)
RETURNS TABLE (
  id          uuid,
  schedule_id uuid,
  seat_number text,
  locked_by   uuid,
  session_id  text,
  expires_at  timestamptz
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
  -- 1. Clean up expired locks (use table-qualified column to avoid ambiguity)
  DELETE FROM seat_locks sl WHERE sl.expires_at <= now();

  -- 2. Check if seat already has a confirmed reservation
  IF EXISTS (
    SELECT 1 FROM reservations r
    WHERE r.schedule_id = p_schedule_id
      AND r.seat_numbers @> ARRAY[p_seat_number]::text[]
      AND r.status IN ('confirme','confirmee','en_attente','embarque')
  ) THEN
    RETURN; -- already reserved — no lock possible
  END IF;

  -- 3. Check existing lock for this seat
  SELECT sl.* INTO v_existing
    FROM seat_locks sl
    WHERE sl.schedule_id = p_schedule_id
      AND sl.seat_number  = p_seat_number;

  IF FOUND THEN
    -- Locked by current user → refresh expiry
    IF v_existing.locked_by = v_user_id THEN
      UPDATE seat_locks sl2
         SET expires_at = v_new_exp,
             session_id = p_session_id
       WHERE sl2.id = v_existing.id
      RETURNING sl2.id, sl2.schedule_id, sl2.seat_number,
                sl2.locked_by, sl2.session_id, sl2.expires_at
      INTO id, try_lock_seat.schedule_id, try_lock_seat.seat_number,
           try_lock_seat.locked_by, try_lock_seat.session_id, try_lock_seat.expires_at;
      RETURN NEXT;
      RETURN;
    END IF;
    -- Locked by someone else → return empty
    RETURN;
  END IF;

  -- 4. No existing lock → create one
  INSERT INTO seat_locks(schedule_id, seat_number, locked_by, session_id, expires_at)
  VALUES (p_schedule_id, p_seat_number, v_user_id, p_session_id, v_new_exp)
  ON CONFLICT (schedule_id, seat_number) DO NOTHING
  RETURNING seat_locks.id, seat_locks.schedule_id, seat_locks.seat_number,
            seat_locks.locked_by, seat_locks.session_id, seat_locks.expires_at
  INTO id, try_lock_seat.schedule_id, try_lock_seat.seat_number,
       try_lock_seat.locked_by, try_lock_seat.session_id, try_lock_seat.expires_at;

  IF id IS NOT NULL THEN
    RETURN NEXT;
  END IF;
END;
$$;
