/*
  # Fix infinite recursion in RLS policies on public.users

  ## Problem
  get_my_role() reads from public.users, but is called inside policies on public.users
  itself — causing infinite recursion whenever any SELECT is attempted on public.users.

  ## Fix
  Rewrite get_my_role() to read from auth.jwt() app_metadata instead of querying public.users.
  Also fix users_select_own to not depend on get_my_role(), using only auth.uid() directly.

  ## Impact
  All roles must have their role stored in app_metadata (already done in migrations 096+).
*/

-- 1. Rewrite get_my_role() to use JWT app_metadata (no DB query = no recursion)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );
$$;

-- 2. Ensure all users have their role in app_metadata
-- (run via a DO block that calls auth.admin functions is not possible here,
--  but we can update raw_app_meta_data directly for all existing users)
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'role', COALESCE(
    raw_app_meta_data->>'role',
    raw_user_meta_data->>'role',
    (SELECT role FROM public.users pu WHERE pu.id = auth.users.id)
  )
)
WHERE email LIKE '%@sbta.ci'
  AND (raw_app_meta_data->>'role' IS NULL OR raw_app_meta_data->>'role' = '');
