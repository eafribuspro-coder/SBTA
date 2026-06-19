/*
  # Fix update_bus_fill_rate trigger function search_path

  ## Problem
  The trigger function update_bus_fill_rate is declared SECURITY DEFINER but
  its search_path may cause it to silently fail when updating schedules/buses
  tables after a reservation INSERT.

  ## Fix
  Recreate the function with explicit SET search_path = public to ensure it
  always resolves table names correctly.

  ## Also
  Synchronize seats_available / seats_reserved on all schedules where the
  trigger-calculated values differ from stored values.
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
  v_total_seats INTEGER;
  v_reserved_seats INTEGER;
  v_fill_rate DECIMAL(5,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_schedule_id := OLD.schedule_id;
  ELSE
    v_schedule_id := NEW.schedule_id;
  END IF;

  SELECT s.bus_id, b.total_seats
  INTO v_bus_id, v_total_seats
  FROM schedules s
  JOIN buses b ON b.id = s.bus_id
  WHERE s.id = v_schedule_id;

  IF v_bus_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(total_seats), 0)
  INTO v_reserved_seats
  FROM reservations
  WHERE schedule_id = v_schedule_id
    AND status IN ('confirmee', 'en_attente');

  IF v_total_seats > 0 THEN
    v_fill_rate := (v_reserved_seats::DECIMAL / v_total_seats::DECIMAL * 100)::DECIMAL(5,2);
  ELSE
    v_fill_rate := 0;
  END IF;

  UPDATE schedules
  SET
    seats_reserved  = v_reserved_seats,
    seats_available = GREATEST(0, v_total_seats - v_reserved_seats),
    updated_at      = now()
  WHERE id = v_schedule_id;

  UPDATE buses
  SET
    fill_rate_current = v_fill_rate,
    updated_at        = now()
  WHERE id = v_bus_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  rec RECORD;
  v_reserved INTEGER;
  v_total INTEGER;
BEGIN
  FOR rec IN
    SELECT s.id AS schedule_id, b.total_seats
    FROM schedules s
    JOIN buses b ON b.id = s.bus_id
  LOOP
    SELECT COALESCE(SUM(r.total_seats), 0)
    INTO v_reserved
    FROM reservations r
    WHERE r.schedule_id = rec.schedule_id
      AND r.status IN ('confirmee', 'en_attente');

    UPDATE schedules
    SET
      seats_reserved  = v_reserved,
      seats_available = GREATEST(0, rec.total_seats - v_reserved),
      updated_at      = now()
    WHERE id = rec.schedule_id
      AND seats_reserved IS DISTINCT FROM v_reserved;
  END LOOP;
END $$;
