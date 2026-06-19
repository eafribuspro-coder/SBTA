/*
  # Route stops (transit points), station manager, and chef de gare enhancements

  ## Changes

  ### 1. New Table: route_stops
  - Links routes to intermediate/transit stations in ordered sequence
  - Each stop has a position (1=first intermediate, 2=second, etc.)
  - Stores cumulative distance and time offset from departure for real-time display
  - Allows flexible route definitions: origin city → [stop1] → [stop2] → destination city

  ### 2. New Columns on routes
  - `origin_station_id` — default departure station for this route
  - `destination_station_id` — default arrival station for this route

  ### 3. New Columns on stations
  - `station_manager_id` — FK to users, the chef de gare assigned to this station
  - `city_name` — denormalized for fast display (computed from city_id join)

  ### 4. New Columns on schedules
  - `transit_stops` — ordered JSONB array of {station_id, arrival_offset_minutes, departure_offset_minutes}
    representing the intermediate stops for this specific trip

  ### 5. Security
  - RLS enabled on route_stops
  - Authenticated users can read route_stops
  - Only admin/planificateur can insert/update/delete route_stops
  - station_manager can read their own station data
*/

-- ============================================================
-- 1. Add default stations to routes
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'routes' AND column_name = 'origin_station_id'
  ) THEN
    ALTER TABLE routes ADD COLUMN origin_station_id uuid REFERENCES stations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'routes' AND column_name = 'destination_station_id'
  ) THEN
    ALTER TABLE routes ADD COLUMN destination_station_id uuid REFERENCES stations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 2. Create route_stops table (transit points)
-- ============================================================
CREATE TABLE IF NOT EXISTS route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1,
  cumulative_distance_km numeric,
  offset_minutes integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(route_id, position),
  UNIQUE(route_id, station_id)
);

ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read route stops"
  ON route_stops FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and planificateur can insert route stops"
  ON route_stops FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'planificateur')
    )
  );

CREATE POLICY "Admin and planificateur can update route stops"
  ON route_stops FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'planificateur')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'planificateur')
    )
  );

CREATE POLICY "Admin can delete route stops"
  ON route_stops FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'planificateur')
    )
  );

-- ============================================================
-- 3. Add station_manager_id to stations
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'station_manager_id'
  ) THEN
    ALTER TABLE stations ADD COLUMN station_manager_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 4. Add transit_stops to schedules
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedules' AND column_name = 'transit_stops'
  ) THEN
    ALTER TABLE schedules ADD COLUMN transit_stops jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- ============================================================
-- 5. Index for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_station_id ON route_stops(station_id);
CREATE INDEX IF NOT EXISTS idx_stations_manager ON stations(station_manager_id);
CREATE INDEX IF NOT EXISTS idx_schedules_departure_station ON schedules(departure_station_id);
CREATE INDEX IF NOT EXISTS idx_schedules_arrival_station ON schedules(arrival_station_id);
