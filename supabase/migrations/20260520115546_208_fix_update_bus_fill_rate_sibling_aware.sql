/*
  # Fix update_bus_fill_rate to be sibling-schedule aware

  ## Problem
  The `update_bus_fill_rate()` trigger on reservations only counts seats for the
  single schedule a reservation belongs to. When the same bus is shared across
  multiple schedules (different departure stations, e.g., Adjame and Yopougon),
  this trigger overwrites the correct sibling-aware values set by
  `sync_schedule_seat_counts()`.

  Result: Adjame sees 0/45 while Yopougon correctly sees 10/45 for the same bus.

  ## Solution
  1. Replace `update_bus_fill_rate()` to count reservations across ALL sibling
     schedules (same bus_id + departure_datetime) and update ALL of them.
  2. Resync all currently out-of-sync schedule rows.

  ## Modified Functions
  - `update_bus_fill_rate()` — now sibling-aware, updates all sibling schedules

  ## Important Notes
  - The trigger `trigger_update_bus_fill_rate_*` remains attached to reservations
  - Works alongside `sync_schedule_seat_counts()` with consistent logic
*/

CREATE OR REPLACE FUNCTION public.update_bus_fill_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule_id UUID;
  v_bus_id UUID;
  v_departure_dt timestamptz;
  v_total_seats INTEGER;
  v_reserved_seats INTEGER;
  v_fill_rate DECIMAL(5,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_schedule_id := OLD.schedule_id;
  ELSE
    v_schedule_id := NEW.schedule_id;
  END IF;

  SELECT s.bus_id, s.departure_datetime, COALESCE(b.capacity, b.total_seats, 0)
  INTO v_bus_id, v_departure_dt, v_total_seats
  FROM schedules s
  JOIN buses b ON b.id = s.bus_id
  WHERE s.id = v_schedule_id;

  IF v_bus_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(r.total_seats), 0)
  INTO v_reserved_seats
  FROM reservations r
  JOIN schedules s ON s.id = r.schedule_id
  WHERE s.bus_id = v_bus_id
    AND s.departure_datetime = v_departure_dt
    AND r.status IN ('confirme', 'confirmee', 'en_attente', 'embarque');

  IF v_total_seats > 0 THEN
    v_fill_rate := (v_reserved_seats::DECIMAL / v_total_seats::DECIMAL * 100)::DECIMAL(5,2);
  ELSE
    v_fill_rate := 0;
  END IF;

  UPDATE schedules
  SET
    seats_reserved  = v_reserved_seats,
    seats_available = GREATEST(0, v_total_seats - v_reserved_seats),
    fill_rate       = v_fill_rate,
    updated_at      = now()
  WHERE bus_id = v_bus_id
    AND departure_datetime = v_departure_dt;

  UPDATE buses
  SET
    fill_rate_current = v_fill_rate,
    updated_at        = now()
  WHERE id = v_bus_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Resync all schedules that share a bus with siblings
DO $$
DECLARE
  grp RECORD;
  v_total_seats INTEGER;
  v_reserved INTEGER;
  v_fill DECIMAL(5,2);
BEGIN
  FOR grp IN
    SELECT DISTINCT s.bus_id, s.departure_datetime
    FROM schedules s
    WHERE s.departure_datetime >= CURRENT_DATE - interval '1 day'
  LOOP
    SELECT COALESCE(b.capacity, b.total_seats, 0)
    INTO v_total_seats
    FROM buses b WHERE b.id = grp.bus_id;

    SELECT COALESCE(SUM(r.total_seats), 0)
    INTO v_reserved
    FROM reservations r
    JOIN schedules s ON s.id = r.schedule_id
    WHERE s.bus_id = grp.bus_id
      AND s.departure_datetime = grp.departure_datetime
      AND r.status IN ('confirme', 'confirmee', 'en_attente', 'embarque');

    IF v_total_seats > 0 THEN
      v_fill := (v_reserved::DECIMAL / v_total_seats::DECIMAL * 100)::DECIMAL(5,2);
    ELSE
      v_fill := 0;
    END IF;

    UPDATE schedules
    SET seats_reserved  = v_reserved,
        seats_available = GREATEST(0, v_total_seats - v_reserved),
        fill_rate       = v_fill
    WHERE bus_id = grp.bus_id
      AND departure_datetime = grp.departure_datetime
      AND (seats_reserved IS DISTINCT FROM v_reserved
        OR seats_available IS DISTINCT FROM GREATEST(0, v_total_seats - v_reserved));
  END LOOP;
END $$;
