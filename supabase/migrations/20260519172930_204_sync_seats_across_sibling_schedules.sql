/*
  # Sync seats_available across sibling schedules sharing the same bus

  ## Problem
  When the same bus is assigned to multiple schedules (different counters/stations)
  at the same departure time, selling a ticket on one schedule only updates that
  schedule's seats_available. Other schedules sharing the same bus still show their
  old (higher) seat count.

  Example: Bus AA 830 HV 01 (45 seats) on two schedules:
  - Schedule A (Adjame): 8 sold => seats_available = 37
  - Schedule B (Yopougon): 5 sold => seats_available = 40
  - Correct: both should show seats_available = 32 (45 - 13 total)

  ## Solution
  Replace the trigger function to:
  1. Find ALL schedules sharing the same bus_id + departure_datetime
  2. Sum reservations across ALL of those sibling schedules
  3. Update seats_available on ALL siblings to reflect the consolidated count

  ## Impact
  - All counters selling from the same physical bus will immediately see the
    correct remaining seat count after any ticket sale.
  - Prevents double-selling of seats across counters.
*/

CREATE OR REPLACE FUNCTION sync_schedule_seat_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule_id uuid;
  v_bus_id uuid;
  v_departure_dt timestamptz;
  v_total_seats int;
  v_all_sold int;
  v_sib RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_schedule_id := OLD.schedule_id;
  ELSE
    v_schedule_id := NEW.schedule_id;
  END IF;

  -- Get bus_id and departure_datetime for the affected schedule
  SELECT s.bus_id, s.departure_datetime
    INTO v_bus_id, v_departure_dt
    FROM schedules s
    WHERE s.id = v_schedule_id;

  IF v_bus_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get the bus total seats
  SELECT COALESCE(b.capacity, b.total_seats, 0)
    INTO v_total_seats
    FROM buses b
    WHERE b.id = v_bus_id;

  -- Calculate total sold seats across ALL sibling schedules (same bus + same departure time)
  SELECT COALESCE(SUM(r.total_seats), 0)
    INTO v_all_sold
    FROM reservations r
    JOIN schedules s ON s.id = r.schedule_id
    WHERE s.bus_id = v_bus_id
      AND s.departure_datetime = v_departure_dt
      AND r.status IN ('confirme','confirmee','en_attente','embarque');

  -- Update ALL sibling schedules with the consolidated seat count
  UPDATE schedules
    SET seats_available = GREATEST(0, v_total_seats - v_all_sold),
        seats_reserved  = v_all_sold
    WHERE bus_id = v_bus_id
      AND departure_datetime = v_departure_dt;

  -- Handle UPDATE where schedule_id changed: also recalc the OLD schedule's siblings
  IF TG_OP = 'UPDATE' AND OLD.schedule_id IS DISTINCT FROM NEW.schedule_id THEN
    SELECT s.bus_id, s.departure_datetime
      INTO v_bus_id, v_departure_dt
      FROM schedules s
      WHERE s.id = OLD.schedule_id;

    IF v_bus_id IS NOT NULL THEN
      SELECT COALESCE(b.capacity, b.total_seats, 0)
        INTO v_total_seats
        FROM buses b
        WHERE b.id = v_bus_id;

      SELECT COALESCE(SUM(r.total_seats), 0)
        INTO v_all_sold
        FROM reservations r
        JOIN schedules s ON s.id = r.schedule_id
        WHERE s.bus_id = v_bus_id
          AND s.departure_datetime = v_departure_dt
          AND r.status IN ('confirme','confirmee','en_attente','embarque');

      UPDATE schedules
        SET seats_available = GREATEST(0, v_total_seats - v_all_sold),
            seats_reserved  = v_all_sold
        WHERE bus_id = v_bus_id
          AND departure_datetime = v_departure_dt;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;
