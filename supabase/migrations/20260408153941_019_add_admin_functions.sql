/*
  # Add Admin Functions with SECURITY DEFINER

  ## Problem
  Admin/Staff users need to read all users, but RLS policies only allow reading own profile.
  We can't add RLS policies that check role because that creates infinite recursion.

  ## Solution
  Create SECURITY DEFINER functions that bypass RLS for authorized users.
  These functions check the caller's role and return data accordingly.

  ## Changes
  1. Create function to check if current user is admin
  2. Create function to get all users (admin only)
  3. Create function to get user by id (for lookups)
*/

-- Function to check if current user has a specific role
-- This uses SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get the role of the current authenticated user
  SELECT role INTO user_role
  FROM users
  WHERE id = auth.uid();
  
  -- Return true if user has the required role
  RETURN user_role = required_role;
END;
$$;

-- Function to get all users (for admin/staff pages)
-- This bypasses RLS but checks authorization first
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS SETOF users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Get the role of the caller
  SELECT role INTO caller_role
  FROM users
  WHERE id = auth.uid();
  
  -- Only allow admin, daf, gestionnaire, and other staff to see all users
  IF caller_role IN ('admin', 'daf', 'comptable', 'gestionnaire', 'planificateur', 'chef_garage', 'guichetier') THEN
    RETURN QUERY SELECT * FROM users;
  ELSE
    -- Regular users can only see their own profile
    RETURN QUERY SELECT * FROM users WHERE id = auth.uid();
  END IF;
END;
$$;

-- Function to get a specific user by ID (for lookups)
CREATE OR REPLACE FUNCTION get_user_by_id(user_id UUID)
RETURNS SETOF users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Return the user (RLS is bypassed via SECURITY DEFINER)
  RETURN QUERY SELECT * FROM users WHERE id = user_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION has_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_by_id(UUID) TO authenticated;
