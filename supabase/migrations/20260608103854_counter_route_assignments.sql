
-- 1. Drop the old constraint that causes duplicate key errors
ALTER TABLE departure_sequence
  DROP CONSTRAINT IF EXISTS departure_sequence_counter_id_departure_date_departure_numb_key;

-- 2. Create counter_routes junction table: which routes a counter handles
CREATE TABLE IF NOT EXISTS counter_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counter_id uuid NOT NULL REFERENCES counters(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (counter_id, route_id)
);

ALTER TABLE counter_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_counter_routes_authenticated" ON counter_routes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert_counter_routes_chef_gare" ON counter_routes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM counters c
      JOIN stations s ON s.id = c.station_id
      WHERE c.id = counter_id
      AND s.station_manager_id = auth.uid()
    )
  );

CREATE POLICY "delete_counter_routes_chef_gare" ON counter_routes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM counters c
      JOIN stations s ON s.id = c.station_id
      WHERE c.id = counter_id
      AND s.station_manager_id = auth.uid()
    )
  );

-- 3. Update the assign departure RPC to be fully resilient against duplicates
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

  SELECT departure_datetime::date, route_id
  INTO v_dep_date, v_route_id
  FROM schedules WHERE id = p_schedule_id;

  -- Already assigned: update counter, keep departure_order
  SELECT departure_order INTO v_existing_order
  FROM departure_sequence WHERE schedule_id = p_schedule_id;

  IF v_existing_order IS NOT NULL THEN
    UPDATE departure_sequence
    SET counter_id = p_counter_id
    WHERE schedule_id = p_schedule_id;
    RETURN v_existing_order;
  END IF;

  -- New: compute next per station+date+route
  SELECT COALESCE(MAX(departure_order), 0) + 1 INTO v_next_order
  FROM departure_sequence
  WHERE station_id    = v_caller_station
    AND departure_date = v_dep_date
    AND route_id       = v_route_id;

  INSERT INTO departure_sequence (counter_id, schedule_id, departure_date, departure_number, station_id, departure_order, route_id)
  VALUES (p_counter_id, p_schedule_id, v_dep_date, v_next_order, v_caller_station, v_next_order, v_route_id)
  ON CONFLICT (schedule_id) DO UPDATE SET counter_id = p_counter_id;

  RETURN v_next_order;
END;
$function$;

NOTIFY pgrst, 'reload schema';
