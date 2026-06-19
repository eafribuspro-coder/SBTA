/*
  # Fix auto_calculate_fill_rate trigger to consolidate sibling schedules

  ## Problem
  The BEFORE INSERT/UPDATE trigger on `schedules` recalculates seats_available
  using only reservations linked to the specific schedule being updated.
  When the same bus is shared across multiple schedules (different counters),
  this causes each schedule to only see its own sold seats, not the total.

  ## Solution
  Update the trigger to count reservations across ALL schedules sharing the
  same bus_id AND departure_datetime, giving the true consolidated seat count.

  ## Impact
  - seats_available, seats_reserved, and fill_rate now reflect total sales
    across all counters sharing the same physical bus trip.
*/

CREATE OR REPLACE FUNCTION auto_calculate_fill_rate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_bus_capacity integer;
  v_seats_reserved integer;
BEGIN
  SELECT COALESCE(b.total_seats, b.capacity, 0)
    INTO v_bus_capacity
    FROM buses b WHERE b.id = NEW.bus_id;

  IF v_bus_capacity IS NULL OR v_bus_capacity = 0 THEN
    NEW.fill_rate := 0;
    NEW.seats_available := 0;
    NEW.seats_reserved := 0;
    RETURN NEW;
  END IF;

  -- Count seats from ALL schedules sharing the same bus and departure time
  SELECT COALESCE(SUM(r.total_seats), 0)
    INTO v_seats_reserved
    FROM reservations r
    JOIN schedules s ON s.id = r.schedule_id
    WHERE s.bus_id = NEW.bus_id
      AND s.departure_datetime = NEW.departure_datetime
      AND r.status IN ('confirmee', 'confirme', 'en_attente', 'embarque');

  NEW.fill_rate := ROUND((v_seats_reserved::numeric / v_bus_capacity::numeric) * 100, 2);
  NEW.seats_reserved  := v_seats_reserved;
  NEW.seats_available := GREATEST(0, v_bus_capacity - v_seats_reserved);

  RETURN NEW;
END;
$$;
