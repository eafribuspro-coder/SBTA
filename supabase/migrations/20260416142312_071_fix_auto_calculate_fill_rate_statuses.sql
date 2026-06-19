/*
  # Fix auto_calculate_fill_rate trigger — wrong reservation status values

  ## Problem
  The BEFORE UPDATE/INSERT trigger on schedules recalculates seats_available
  and seats_reserved using status IN ('confirmed', 'boarded') — English values.
  The application uses French status values: 'confirmee', 'en_attente', 'embarque'.
  This causes every UPDATE on schedules to reset seats_reserved to 0.

  ## Fix
  Update the function to use the correct French status values.
  Also use total_seats column instead of capacity (which may be null).
*/

CREATE OR REPLACE FUNCTION public.auto_calculate_fill_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  SELECT COALESCE(SUM(r.total_seats), 0)
  INTO v_seats_reserved
  FROM reservations r
  WHERE r.schedule_id = NEW.id
    AND r.status IN ('confirmee', 'confirme', 'en_attente', 'embarque');

  NEW.fill_rate := ROUND((v_seats_reserved::numeric / v_bus_capacity::numeric) * 100, 2);
  NEW.seats_reserved  := v_seats_reserved;
  NEW.seats_available := GREATEST(0, v_bus_capacity - v_seats_reserved);

  RETURN NEW;
END;
$$;
