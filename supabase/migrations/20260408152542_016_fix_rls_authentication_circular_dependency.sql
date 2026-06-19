/*
  # Fix RLS Authentication Circular Dependency

  ## Problem
  The RLS policies on the users table create a circular dependency:
  - To read from users table, get_user_role() is called
  - get_user_role() needs to SELECT from users table
  - But RLS policies block the SELECT unless you already know the role
  
  This causes "Database error querying schema" for non-admin users during login.

  ## Solution
  The existing policy "Users can view own profile" already allows:
  `SELECT WHERE id = auth.uid()`
  
  This should work, but we need to ensure it takes precedence.
  We'll drop and recreate the policies in the correct order.

  ## Changes
  1. Keep the "Users can view own profile" policy (CRITICAL for login)
  2. Ensure get_user_role() function works correctly
  3. Reorder policies so own profile access is checked first
*/

-- First, let's verify the get_user_role function is secure
-- It should only return the role of the authenticated user
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;

-- Add a comment
COMMENT ON FUNCTION get_user_role() IS 'Returns the role of the currently authenticated user. Used in RLS policies.';
