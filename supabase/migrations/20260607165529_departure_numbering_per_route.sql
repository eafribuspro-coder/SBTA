
-- Add route_id to departure_sequence for per-route numbering
ALTER TABLE departure_sequence ADD COLUMN IF NOT EXISTS route_id uuid REFERENCES routes(id);

-- Backfill route_id from existing schedules
UPDATE departure_sequence ds
SET route_id = s.route_id
FROM schedules s
WHERE ds.schedule_id = s.id
AND ds.route_id IS NULL;

-- Drop the old station-wide unique constraint on departure_order
ALTER TABLE departure_sequence DROP CONSTRAINT IF EXISTS departure_sequence_station_date_order_unique;

-- Add new unique constraint per station+date+route
ALTER TABLE departure_sequence ADD CONSTRAINT departure_sequence_station_date_route_order_unique
  UNIQUE (station_id, departure_date, route_id, departure_order);

-- Recreate the assign function with per-route numbering
CREATE OR REPLACE FUNCTION public.chef_gare_assign_departure(p_schedule_id uuid, p_counter_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_station  uuid;
  v_counter_station uuid;
  v_next_order      int;
  v_dep_date        date;
  v_route_id        uuid;
BEGIN
  SELECT id INTO v_caller_station
  FROM stations WHERE station_manager_id = auth.uid();

  IF v_caller_station IS NULL THEN
    RAISE EXCEPTION 'Vous n''êtes pas chef de gare d''une gare assignée';
  END IF;

  SELECT station_id INTO v_counter_station
  FROM counters WHERE id = p_counter_id;

  IF v_counter_station IS DISTINCT FROM v_caller_station THEN
    RAISE EXCEPTION 'Ce guichet n''appartient pas à votre gare';
  END IF;

  SELECT departure_datetime::date, route_id
  INTO v_dep_date, v_route_id
  FROM schedules WHERE id = p_schedule_id;

  -- Already assigned: reassign counter but keep same departure_order
  IF EXISTS (SELECT 1 FROM departure_sequence WHERE schedule_id = p_schedule_id) THEN
    UPDATE departure_sequence
    SET counter_id = p_counter_id
    WHERE schedule_id = p_schedule_id;

    SELECT departure_order INTO v_next_order
    FROM departure_sequence WHERE schedule_id = p_schedule_id;

    RETURN v_next_order;
  END IF;

  -- New assignment: compute next sequential number per station + date + route
  SELECT COALESCE(MAX(departure_order), 0) + 1 INTO v_next_order
  FROM departure_sequence
  WHERE station_id    = v_caller_station
    AND departure_date = v_dep_date
    AND route_id       = v_route_id;

  INSERT INTO departure_sequence (counter_id, schedule_id, departure_date, departure_number, station_id, departure_order, route_id)
  VALUES (p_counter_id, p_schedule_id, v_dep_date, v_next_order, v_caller_station, v_next_order, v_route_id);

  RETURN v_next_order;
END;
$function$;

NOTIFY pgrst, 'reload schema';
