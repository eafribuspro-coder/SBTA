
-- 1) Drop the old counter_id+date+number unique constraint if it still exists
ALTER TABLE departure_sequence
  DROP CONSTRAINT IF EXISTS departure_sequence_counter_id_departure_date_departure_numb_key;

-- 2) Make the RPC fully idempotent: use advisory lock to prevent race conditions
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
  v_existing_order  int;
BEGIN
  -- Get station of the calling chef de gare
  SELECT id INTO v_caller_station
  FROM stations WHERE station_manager_id = auth.uid();

  IF v_caller_station IS NULL THEN
    RAISE EXCEPTION 'Vous n''etes pas chef de gare d''une gare assignee';
  END IF;

  -- Verify counter belongs to this station
  SELECT station_id INTO v_counter_station
  FROM counters WHERE id = p_counter_id;

  IF v_counter_station IS DISTINCT FROM v_caller_station THEN
    RAISE EXCEPTION 'Ce guichet n''appartient pas a votre gare';
  END IF;

  -- Get departure date + route from schedule
  SELECT departure_datetime::date, route_id
  INTO v_dep_date, v_route_id
  FROM schedules WHERE id = p_schedule_id;

  -- Already assigned: just update the counter, keep same departure_order
  SELECT departure_order INTO v_existing_order
  FROM departure_sequence WHERE schedule_id = p_schedule_id;

  IF v_existing_order IS NOT NULL THEN
    UPDATE departure_sequence
    SET counter_id = p_counter_id
    WHERE schedule_id = p_schedule_id;
    RETURN v_existing_order;
  END IF;

  -- Lock to prevent concurrent inserts getting same order number
  PERFORM pg_advisory_xact_lock(
    hashtext(v_caller_station::text || v_dep_date::text || COALESCE(v_route_id::text, ''))
  );

  -- Compute next per station+date+route
  SELECT COALESCE(MAX(departure_order), 0) + 1 INTO v_next_order
  FROM departure_sequence
  WHERE station_id    = v_caller_station
    AND departure_date = v_dep_date
    AND route_id IS NOT DISTINCT FROM v_route_id;

  -- Insert with ON CONFLICT guard
  INSERT INTO departure_sequence (counter_id, schedule_id, departure_date, departure_number, station_id, departure_order, route_id)
  VALUES (p_counter_id, p_schedule_id, v_dep_date, v_next_order, v_caller_station, v_next_order, v_route_id)
  ON CONFLICT (schedule_id) DO UPDATE
    SET counter_id = EXCLUDED.counter_id;

  -- Auto-add route to counter_routes if not already there
  IF v_route_id IS NOT NULL THEN
    INSERT INTO counter_routes (id, counter_id, route_id)
    VALUES (gen_random_uuid(), p_counter_id, v_route_id)
    ON CONFLICT (counter_id, route_id) DO NOTHING;
  END IF;

  RETURN v_next_order;
END;
$function$;

-- 3) Create RPC for chef de gare to manage route assignments
CREATE OR REPLACE FUNCTION public.chef_gare_assign_routes(p_counter_id uuid, p_route_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_station uuid;
  v_counter_station uuid;
BEGIN
  SELECT id INTO v_caller_station
  FROM stations WHERE station_manager_id = auth.uid();

  IF v_caller_station IS NULL THEN
    RAISE EXCEPTION 'Vous n''etes pas chef de gare d''une gare assignee';
  END IF;

  SELECT station_id INTO v_counter_station
  FROM counters WHERE id = p_counter_id;

  IF v_counter_station IS DISTINCT FROM v_caller_station THEN
    RAISE EXCEPTION 'Ce guichet n''appartient pas a votre gare';
  END IF;

  -- Remove routes no longer in the list
  DELETE FROM counter_routes
  WHERE counter_id = p_counter_id
    AND route_id != ALL(p_route_ids);

  -- Add new routes
  INSERT INTO counter_routes (id, counter_id, route_id)
  SELECT gen_random_uuid(), p_counter_id, unnest(p_route_ids)
  ON CONFLICT (counter_id, route_id) DO NOTHING;
END;
$function$;

NOTIFY pgrst, 'reload schema';
