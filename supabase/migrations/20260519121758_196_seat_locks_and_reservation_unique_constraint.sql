/*
  # Seat Locks & Reservation Uniqueness

  ## Purpose
  Prevent double-selling of seats when multiple counters/agents sell on the same bus/schedule.

  ## Changes

  ### New Table: seat_locks
  - Temporary seat reservations (3-minute TTL)
  - Columns: id, schedule_id, seat_number, locked_by (user id), session_id, expires_at, created_at
  - One row per (schedule_id, seat_number) — unique constraint; expired rows cleaned before insert

  ### Cleanup Function
  - expire_seat_locks(): deletes seat_locks where expires_at < now()

  ### RPCs
  - try_lock_seat: atomically acquire or refresh a seat lock
  - release_seat_lock: release a lock held by the current user

  ### Realtime
  - seat_locks table added to supabase_realtime publication
*/

-- ── seat_locks table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seat_locks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id  uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  seat_number  text NOT NULL,
  locked_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id   text NOT NULL DEFAULT '',
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '3 minutes'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, seat_number)
);

CREATE INDEX IF NOT EXISTS seat_locks_expires_idx ON seat_locks(expires_at);
CREATE INDEX IF NOT EXISTS seat_locks_locked_by_idx ON seat_locks(locked_by);

ALTER TABLE seat_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view seat locks"
  ON seat_locks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create seat locks"
  ON seat_locks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = locked_by);

CREATE POLICY "Users can update their own seat locks"
  ON seat_locks FOR UPDATE
  TO authenticated
  USING (auth.uid() = locked_by)
  WITH CHECK (auth.uid() = locked_by);

CREATE POLICY "Users can release their own seat locks"
  ON seat_locks FOR DELETE
  TO authenticated
  USING (auth.uid() = locked_by);

-- ── Cleanup function ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION expire_seat_locks()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM seat_locks WHERE expires_at <= now();
$$;

GRANT EXECUTE ON FUNCTION expire_seat_locks() TO authenticated;

-- ── RPC: try_lock_seat ────────────────────────────────────────────────────────

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
  -- 1. Clean up expired locks
  DELETE FROM seat_locks WHERE expires_at <= now();

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
  SELECT * INTO v_existing
    FROM seat_locks sl
    WHERE sl.schedule_id = p_schedule_id
      AND sl.seat_number  = p_seat_number;

  IF FOUND THEN
    -- Locked by current user → refresh expiry
    IF v_existing.locked_by = v_user_id THEN
      UPDATE seat_locks
         SET expires_at = v_new_exp,
             session_id = p_session_id
       WHERE seat_locks.id = v_existing.id
      RETURNING seat_locks.id, seat_locks.schedule_id, seat_locks.seat_number,
                seat_locks.locked_by, seat_locks.session_id, seat_locks.expires_at
      INTO id, schedule_id, seat_number, locked_by, session_id, expires_at;
      RETURN NEXT;
    END IF;
    -- Locked by someone else → return empty (caller handles UI)
    RETURN;
  END IF;

  -- 4. No existing lock → create one
  INSERT INTO seat_locks(schedule_id, seat_number, locked_by, session_id, expires_at)
  VALUES (p_schedule_id, p_seat_number, v_user_id, p_session_id, v_new_exp)
  ON CONFLICT (schedule_id, seat_number) DO NOTHING
  RETURNING seat_locks.id, seat_locks.schedule_id, seat_locks.seat_number,
            seat_locks.locked_by, seat_locks.session_id, seat_locks.expires_at
  INTO id, schedule_id, seat_number, locked_by, session_id, expires_at;

  IF id IS NOT NULL THEN
    RETURN NEXT;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION try_lock_seat(uuid, text, text) TO authenticated;

-- ── RPC: release_seat_lock ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION release_seat_lock(
  p_schedule_id uuid,
  p_seat_number text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM seat_locks
  WHERE schedule_id = p_schedule_id
    AND seat_number  = p_seat_number
    AND locked_by    = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION release_seat_lock(uuid, text) TO authenticated;

-- ── Realtime ─────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'seat_locks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE seat_locks;
  END IF;
END $$;
