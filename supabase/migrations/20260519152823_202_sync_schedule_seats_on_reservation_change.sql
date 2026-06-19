/*
  # Auto-sync schedule seat counts on reservation changes

  ## Problem
  When reservations are created/updated/deleted by multiple counters simultaneously,
  the `seats_available` and `seats_reserved` columns in `schedules` can drift out of
  sync with the actual reservation data.

  ## Fix
  Create a trigger function that recalculates `seats_available` and `seats_reserved`
  from actual reservation data every time a reservation is inserted, updated, or deleted.
  This ensures all counters always see accurate seat counts regardless of race conditions.

  1. New function: `sync_schedule_seat_counts()`
     - Counts total seats sold from active reservations for the schedule
     - Updates `seats_reserved` = total sold seats
     - Updates `seats_available` = bus total_seats - total sold seats

  2. New trigger on `reservations` table (AFTER INSERT, UPDATE, DELETE)
*/

CREATE OR REPLACE FUNCTION sync_schedule_seat_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule_id uuid;
  v_total_seats int;
  v_sold_seats int;
BEGIN
  -- Determine which schedule was affected
  IF TG_OP = 'DELETE' THEN
    v_schedule_id := OLD.schedule_id;
  ELSE
    v_schedule_id := NEW.schedule_id;
  END IF;

  -- Also handle the old schedule_id on UPDATE if it changed
  IF TG_OP = 'UPDATE' AND OLD.schedule_id IS DISTINCT FROM NEW.schedule_id THEN
    -- Recalculate old schedule
    SELECT COALESCE(b.total_seats, 0) INTO v_total_seats
      FROM schedules s JOIN buses b ON b.id = s.bus_id
      WHERE s.id = OLD.schedule_id;

    SELECT COALESCE(SUM(array_length(r.seat_numbers, 1)), 0) INTO v_sold_seats
      FROM reservations r
      WHERE r.schedule_id = OLD.schedule_id
        AND r.status IN ('confirme','confirmee','en_attente','embarque');

    UPDATE schedules
      SET seats_reserved = v_sold_seats,
          seats_available = GREATEST(0, COALESCE(v_total_seats, 0) - v_sold_seats)
      WHERE id = OLD.schedule_id;
  END IF;

  -- Recalculate current schedule
  SELECT COALESCE(b.total_seats, 0) INTO v_total_seats
    FROM schedules s JOIN buses b ON b.id = s.bus_id
    WHERE s.id = v_schedule_id;

  SELECT COALESCE(SUM(array_length(r.seat_numbers, 1)), 0) INTO v_sold_seats
    FROM reservations r
    WHERE r.schedule_id = v_schedule_id
      AND r.status IN ('confirme','confirmee','en_attente','embarque');

  UPDATE schedules
    SET seats_reserved = v_sold_seats,
        seats_available = GREATEST(0, COALESCE(v_total_seats, 0) - v_sold_seats)
    WHERE id = v_schedule_id;

  RETURN NULL; -- AFTER trigger, return value ignored
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_sync_schedule_seats ON reservations;

CREATE TRIGGER trg_sync_schedule_seats
  AFTER INSERT OR UPDATE OR DELETE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION sync_schedule_seat_counts();
