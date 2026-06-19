/*
  # Simplify Users RLS Policies for Login

  ## Problem
  Users cannot login because RLS policies are too restrictive.
  The "Users can view own profile" policy should work but might have issues.

  ## Solution
  1. Drop all existing SELECT policies on users table
  2. Create a single, simple SELECT policy that allows:
     - Users to see their own profile (auth.uid() = id)
     - This is all that's needed for login to work
  3. Keep other policies for admin/staff access

  ## Changes
  - Drop old SELECT policies
  - Create new simplified SELECT policy for own profile
  - Ensure get_user_role() works with SECURITY DEFINER
*/

-- Drop existing SELECT policies to recreate them properly
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admin can view all users" ON users;
DROP POLICY IF EXISTS "Staff can view users" ON users;

-- Create the most important policy first: users can always see their own profile
-- This is CRITICAL for login to work
CREATE POLICY "Enable read access for users to own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admin can view all users
CREATE POLICY "Enable read access for admin to all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Staff roles can view users (for their operations)
CREATE POLICY "Enable read access for staff to users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('daf', 'comptable', 'planificateur', 'chef_garage', 'guichetier', 'gestionnaire')
    )
  );

-- Ensure get_user_role() function is SECURITY DEFINER so it bypasses RLS
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM users WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;
