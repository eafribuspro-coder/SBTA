/*
  # Fix Users RLS Policies and Admin Access

  ## Summary
  The users table currently only has 3 very basic RLS policies (own select/insert/update),
  which means admins cannot list, update, or manage other users through the client.
  This migration adds proper admin and staff policies, and creates the missing `is_admin`
  function used by edge functions.

  ## Changes

  ### New Function
  - `is_admin(user_id uuid)` — returns true if the given user has the 'admin' role.
    Used by edge functions to authorize admin-only operations.

  ### New RLS Policies on `users`
  - Admins can SELECT all users
  - Admins can UPDATE any user
  - Admins can DELETE any user
  - Staff roles (daf, comptable, gestionnaire, planificateur, chef_garage, guichetier) can SELECT all users
  - Service role insert is already unrestricted (used by edge functions)

  ## Notes
  - All policies use SECURITY DEFINER functions to avoid recursive RLS lookups
  - The existing `users_insert_own` policy allows clients to self-register
  - The edge function uses service_role key which bypasses RLS entirely
*/

-- Create is_admin function used by edge functions
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_id AND role = 'admin'
  );
$$;

-- Drop existing policies to rebuild cleanly
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_insert_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;

-- SELECT: own profile
CREATE POLICY "users_select_own"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- SELECT: admins can see all users
CREATE POLICY "users_select_admin"
  ON users FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- SELECT: staff roles can see all users (needed for dropdowns, assignments, etc.)
CREATE POLICY "users_select_staff"
  ON users FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() IN (
      'daf', 'comptable', 'gestionnaire', 'planificateur',
      'chef_garage', 'guichetier', 'pompiste', 'mecanicien'
    )
  );

-- INSERT: own profile (self-registration for clients)
CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- UPDATE: own profile
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- UPDATE: admins can update any user
CREATE POLICY "users_update_admin"
  ON users FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- DELETE: admins can delete users
CREATE POLICY "users_delete_admin"
  ON users FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');
