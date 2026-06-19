/*
# Add Login/Logout Tracking Columns to user_sessions

## Purpose
Extend the existing user_sessions table with columns to track real
login/logout times for guichetiers so work time is calculated only
when the user is actually connected.

## Modified Tables
- `user_sessions`
  - Added `station_id` (uuid, FK to stations, nullable)
  - Added `session_date` (date, default CURRENT_DATE)
  - Added `logged_in_at` (timestamptz, default now())
  - Added `logged_out_at` (timestamptz, nullable)

## Indexes
- Index on (station_id, session_date) for chef de gare queries
- Unique partial index on (user_id, session_date) WHERE logged_out_at IS NULL

## Notes
1. These columns allow tracking when guichetiers actually log in/out.
2. The chef de gare Counters page will check these to show real connection status.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'station_id') THEN
    ALTER TABLE user_sessions ADD COLUMN station_id uuid REFERENCES stations(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'session_date') THEN
    ALTER TABLE user_sessions ADD COLUMN session_date date NOT NULL DEFAULT CURRENT_DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'logged_in_at') THEN
    ALTER TABLE user_sessions ADD COLUMN logged_in_at timestamptz NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'logged_out_at') THEN
    ALTER TABLE user_sessions ADD COLUMN logged_out_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_sessions_station_date
  ON user_sessions(station_id, session_date);

DROP INDEX IF EXISTS idx_user_sessions_active_login;
CREATE UNIQUE INDEX idx_user_sessions_active_login
  ON user_sessions(user_id, session_date) WHERE logged_out_at IS NULL;

-- RLS policies for the new query patterns
DROP POLICY IF EXISTS "select_user_sessions" ON user_sessions;
CREATE POLICY "select_user_sessions" ON user_sessions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_session" ON user_sessions;
CREATE POLICY "insert_own_session" ON user_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_session" ON user_sessions;
CREATE POLICY "update_own_session" ON user_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
