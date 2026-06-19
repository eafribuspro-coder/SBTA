/*
  # Fix bus_seat_config RLS policies and schema cache

  ## Problem
  - "Database error querying schema" caused by PostgREST failing to introspect
    the schema when the RLS policy uses FOR ALL (covering INSERT/UPDATE/DELETE/SELECT)
    with get_user_role() function evaluation during schema introspection.
  - The FOR ALL policy is replaced with 4 separate, explicit policies.
  - Both get_user_role() and get_my_role() exist and are identical; we standardize
    on get_my_role() which is used everywhere else.

  ## Changes
  1. Drop the problematic FOR ALL policy on bus_seat_config
  2. Replace with 4 separate policies (SELECT, INSERT, UPDATE, DELETE)
  3. Extend SELECT to include all roles that need to read seat configs
  4. Force PostgREST schema cache reload

  ## Security
  - SELECT: any authenticated user (needed for booking, planning, display)
  - INSERT: admin only
  - UPDATE: admin only
  - DELETE: admin only
*/

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Admin can manage seat configs" ON bus_seat_config;
DROP POLICY IF EXISTS "Anyone can view seat configs" ON bus_seat_config;

-- SELECT: all authenticated users need to read seat configs (booking, guichetier, planificateur, etc.)
CREATE POLICY "Authenticated users can view seat configs"
  ON bus_seat_config FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: admin only
CREATE POLICY "Admin can insert seat configs"
  ON bus_seat_config FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

-- UPDATE: admin only
CREATE POLICY "Admin can update seat configs"
  ON bus_seat_config FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- DELETE: admin only
CREATE POLICY "Admin can delete seat configs"
  ON bus_seat_config FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');

-- Ensure anon role cannot bypass RLS (revoke anon grants - they shouldn't have DML)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON bus_seat_config FROM anon;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
