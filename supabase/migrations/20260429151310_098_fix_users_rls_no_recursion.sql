/*
  # Fix infinite recursion in public.users RLS policies

  ## Problem
  The policy "gestionnaire_select_company_staff" contains a subquery that reads
  from public.users inside a policy on public.users — causing infinite recursion.
  Even after fixing get_my_role() to use JWT, this subquery still triggers recursion.

  ## Fix
  Drop and recreate all SELECT policies on public.users without any subquery
  that references public.users. Use auth.jwt() for role checks and a separate
  security-definer function for company_id lookup.
*/

-- Drop all existing SELECT policies on users
DROP POLICY IF EXISTS "users_select_own"                  ON public.users;
DROP POLICY IF EXISTS "users_select_admin_daf"            ON public.users;
DROP POLICY IF EXISTS "users_select_staff"                ON public.users;
DROP POLICY IF EXISTS "rh_select_all_personnel"           ON public.users;
DROP POLICY IF EXISTS "gestionnaire_select_company_staff" ON public.users;

-- Helper: get current user's company_id from JWT or a safe lookup
-- SECURITY DEFINER bypasses RLS when reading users, breaking the recursion
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Recreate SELECT policies — none reference public.users in their QUAL

-- 1. Every user can read their own row
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 2. Admin and DAF can read all rows
CREATE POLICY "users_select_admin_daf"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = ANY(ARRAY['admin','daf'])
  );

-- 3. Staff roles can read all non-client rows
CREATE POLICY "users_select_staff"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = ANY(
      ARRAY['comptable','planificateur','chef_garage','guichetier','chef_gare','mecanicien','pompiste','rh']
    )
    AND role <> 'client'
  );

-- 4. RH can read all non-client, non-admin/daf rows (merged into staff policy above, kept for clarity)
-- Already covered by users_select_staff (rh is included)

-- 5. Gestionnaire can read company staff (no subquery — uses security definer function)
CREATE POLICY "gestionnaire_select_company_staff"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'gestionnaire'
    AND role <> 'client'
    AND company_id = public.get_my_company_id()
  );
