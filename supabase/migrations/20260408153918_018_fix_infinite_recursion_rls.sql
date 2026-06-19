/*
  # Fix Infinite Recursion in RLS Policies

  ## Problem
  The RLS policies create infinite recursion:
  - Admin policy checks: EXISTS (SELECT FROM users WHERE id = auth.uid() AND role = 'admin')
  - This SELECT triggers RLS policies again → infinite loop
  
  ## Solution
  Remove ALL policies that query the users table within their USING clause.
  Keep ONLY the simple policy: users can read their own profile.
  
  For admin/staff operations, they will query through their own profile first,
  then the application layer will handle authorization.

  ## Changes
  1. Drop ALL existing policies on users table
  2. Create minimal policies that don't cause recursion:
     - Users can SELECT their own profile (auth.uid() = id)
     - Users can UPDATE their own profile (auth.uid() = id)
     - Anon users can INSERT during registration
*/

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Admin can delete users" ON users;
DROP POLICY IF EXISTS "Admin can insert users" ON users;
DROP POLICY IF EXISTS "Admin can update users" ON users;
DROP POLICY IF EXISTS "Enable read access for admin to all users" ON users;
DROP POLICY IF EXISTS "Enable read access for staff to users" ON users;
DROP POLICY IF EXISTS "Enable read access for users to own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- CRITICAL: Allow users to read their own profile (needed for login)
CREATE POLICY "users_select_own"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "users_update_own"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow INSERT during registration (handled by auth trigger)
CREATE POLICY "users_insert_own"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- For admin operations, we'll handle authorization in the application layer
-- or through a separate admin-only function with SECURITY DEFINER
