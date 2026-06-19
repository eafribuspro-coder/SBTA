/*
  # Enable Realtime on reservations and schedules tables

  ## Problem
  When counter A sells a ticket, counter B never receives the update because
  the `reservations` and `schedules` tables are not in the `supabase_realtime` publication.

  ## Fix
  - Add `reservations` to `supabase_realtime` publication
  - Add `schedules` to `supabase_realtime` publication

  This enables Postgres Changes events to fire for INSERT/UPDATE/DELETE on these tables,
  allowing all connected counters to see seat map and availability changes in real time.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'reservations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'schedules'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE schedules;
  END IF;
END $$;
