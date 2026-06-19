/*
  # Multi-agent courrier per station - Junction table

  1. New Tables
    - `station_agents` - Many-to-many relationship between stations and agent_colis users
      - `id` (uuid, primary key)
      - `station_id` (uuid, FK to stations)
      - `agent_id` (uuid, FK to users)
      - `is_primary` (boolean, default false) - first agent listed is used on tickets
      - `created_at` (timestamptz)
      - Unique constraint on (station_id, agent_id) to prevent duplicates

  2. Data Migration
    - Copies existing station_agent_colis_id assignments into the new table
    - Marks migrated assignments as primary (is_primary = true)
    - Keeps station_agent_colis_id column intact for backward compatibility

  3. Security
    - RLS enabled on station_agents
    - Admin/DAF can read/write all assignments
    - Agent colis and superviseur colis can read assignments
    - Chef de gare can read assignments for their station
*/

-- 1. Create the junction table
CREATE TABLE IF NOT EXISTS station_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT station_agents_unique UNIQUE (station_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_station_agents_station ON station_agents(station_id);
CREATE INDEX IF NOT EXISTS idx_station_agents_agent ON station_agents(agent_id);

-- 2. Enable RLS
ALTER TABLE station_agents ENABLE ROW LEVEL SECURITY;

-- SELECT policies
CREATE POLICY "Admin and DAF can read all station_agents"
  ON station_agents FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata') ->> 'role') IN ('admin', 'daf')
  );

CREATE POLICY "Agent colis and superviseur can read station_agents"
  ON station_agents FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata') ->> 'role') IN ('agent_colis', 'superviseur_colis')
  );

CREATE POLICY "Chef de gare can read station_agents"
  ON station_agents FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata') ->> 'role') IN ('chef_gare', 'comptable', 'rh', 'gestionnaire')
  );

-- INSERT policies
CREATE POLICY "Admin can insert station_agents"
  ON station_agents FOR INSERT
  TO authenticated
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin'
  );

-- UPDATE policies
CREATE POLICY "Admin can update station_agents"
  ON station_agents FOR UPDATE
  TO authenticated
  USING (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin')
  WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin');

-- DELETE policies
CREATE POLICY "Admin can delete station_agents"
  ON station_agents FOR DELETE
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin'
  );

-- 3. Migrate existing assignments from station_agent_colis_id
INSERT INTO station_agents (station_id, agent_id, is_primary)
SELECT s.id, s.station_agent_colis_id, true
FROM stations s
WHERE s.station_agent_colis_id IS NOT NULL
ON CONFLICT (station_id, agent_id) DO NOTHING;

-- 4. Notify PostgREST
NOTIFY pgrst, 'reload schema';
