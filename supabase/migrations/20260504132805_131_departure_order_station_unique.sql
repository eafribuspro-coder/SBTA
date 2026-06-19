/*
  # Departure Order — Station-wide unique sequence per date

  ## Problem
  `departure_number` in `departure_sequence` was computed per-counter, so two
  different counters both produced "Départ 1", "Départ 2", etc.

  ## Changes
  1. Add `departure_order` integer column to `departure_sequence` — this is the
     station-wide sequential number (unique per station + departure_date).
  2. Add `station_id` column (denormalized from counters) to support the uniqueness
     constraint and fast lookup.
  3. Unique constraint: (station_id, departure_date, departure_order).
  4. Backfill existing rows with chronological order per station + date based on
     the schedule departure_datetime.
  5. Recreate `chef_gare_assign_departure` to compute station-scoped order.
  6. Recreate `chef_gare_unassign_departure` (no change in logic, but redeployed
     together for consistency).
*/

-- 1. Add new columns
ALTER TABLE departure_sequence
  ADD COLUMN IF NOT EXISTS station_id uuid REFERENCES stations(id),
  ADD COLUMN IF NOT EXISTS departure_order integer;

-- 2. Backfill station_id from counters
UPDATE departure_sequence ds
SET station_id = c.station_id
FROM counters c
WHERE c.id = ds.counter_id
  AND ds.station_id IS NULL;

-- 3. Backfill departure_order: chronological rank per station + departure_date
WITH ranked AS (
  SELECT
    ds.id,
    ROW_NUMBER() OVER (
      PARTITION BY ds.station_id, ds.departure_date
      ORDER BY s.departure_datetime ASC
    ) AS rn
  FROM departure_sequence ds
  JOIN schedules s ON s.id = ds.schedule_id
  WHERE ds.station_id IS NOT NULL
)
UPDATE departure_sequence ds
SET departure_order = ranked.rn
FROM ranked
WHERE ds.id = ranked.id
  AND ds.departure_order IS NULL;

-- 4. Unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'departure_sequence_station_date_order_unique'
  ) THEN
    ALTER TABLE departure_sequence
      ADD CONSTRAINT departure_sequence_station_date_order_unique
      UNIQUE (station_id, departure_date, departure_order);
  END IF;
END $$;

-- 5. Recreate chef_gare_assign_departure with station-scoped departure_order
CREATE OR REPLACE FUNCTION public.chef_gare_assign_departure(
  p_schedule_id uuid,
  p_counter_id  uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_station  uuid;
  v_counter_station uuid;
  v_next_order      int;
  v_dep_date        date;
BEGIN
  -- Get station of the calling chef de gare
  SELECT id INTO v_caller_station
  FROM stations WHERE station_manager_id = auth.uid();

  IF v_caller_station IS NULL THEN
    RAISE EXCEPTION 'Vous n''êtes pas chef de gare d''une gare assignée';
  END IF;

  -- Verify counter belongs to this station
  SELECT station_id INTO v_counter_station
  FROM counters WHERE id = p_counter_id;

  IF v_counter_station IS DISTINCT FROM v_caller_station THEN
    RAISE EXCEPTION 'Ce guichet n''appartient pas à votre gare';
  END IF;

  -- Get departure date from schedule
  SELECT departure_datetime::date INTO v_dep_date
  FROM schedules WHERE id = p_schedule_id;

  -- Check if already assigned — preserve existing departure_order
  IF EXISTS (SELECT 1 FROM departure_sequence WHERE schedule_id = p_schedule_id) THEN
    -- Reassign to different counter but keep same departure_order
    UPDATE departure_sequence
    SET counter_id = p_counter_id
    WHERE schedule_id = p_schedule_id;

    SELECT departure_order INTO v_next_order
    FROM departure_sequence WHERE schedule_id = p_schedule_id;

    RETURN v_next_order;
  END IF;

  -- New assignment: compute next station-wide sequential number for this date
  -- based on chronological position of this schedule among all today's station departures
  SELECT COALESCE(MAX(departure_order), 0) + 1 INTO v_next_order
  FROM departure_sequence
  WHERE station_id   = v_caller_station
    AND departure_date = v_dep_date;

  INSERT INTO departure_sequence (counter_id, schedule_id, departure_date, departure_number, station_id, departure_order)
  VALUES (p_counter_id, p_schedule_id, v_dep_date, v_next_order, v_caller_station, v_next_order);

  RETURN v_next_order;
END;
$$;

-- 6. Recreate chef_gare_unassign_departure (same logic, updated for new columns)
CREATE OR REPLACE FUNCTION public.chef_gare_unassign_departure(
  p_schedule_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_station  uuid;
  v_counter_station uuid;
  v_counter_id      uuid;
BEGIN
  SELECT id INTO v_caller_station
  FROM stations WHERE station_manager_id = auth.uid();

  IF v_caller_station IS NULL THEN
    RAISE EXCEPTION 'Vous n''êtes pas chef de gare d''une gare assignée';
  END IF;

  SELECT counter_id INTO v_counter_id
  FROM departure_sequence WHERE schedule_id = p_schedule_id;

  IF v_counter_id IS NULL THEN
    RETURN;
  END IF;

  SELECT station_id INTO v_counter_station
  FROM counters WHERE id = v_counter_id;

  IF v_counter_station IS DISTINCT FROM v_caller_station THEN
    RAISE EXCEPTION 'Ce guichet n''appartient pas à votre gare';
  END IF;

  DELETE FROM departure_sequence WHERE schedule_id = p_schedule_id;
END;
$$;
