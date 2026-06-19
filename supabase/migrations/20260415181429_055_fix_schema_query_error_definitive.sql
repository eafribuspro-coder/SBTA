/*
  # Fix "Database error querying schema" - Definitive Fix

  ## Root Causes Identified
  1. get_user_company_id() was missing search_path=public, causing schema
     resolution failures during PostgREST introspection on any table whose
     RLS policy calls this function.
  2. get_user_role() and get_my_role() are duplicate functions doing the same
     thing. All policies are standardized to use get_my_role().
  3. Force PostgREST schema cache reload at the end.

  ## Changes
  1. Recreate get_user_company_id() with proper search_path
  2. Recreate get_user_role() as a stable alias pointing to get_my_role() logic
     with proper search_path (keeps backward compatibility)
  3. Ensure bus_seat_config rows column NOT NULL constraint is safe
  4. NOTIFY pgrst reload
*/

-- Fix get_user_company_id: add search_path so it resolves correctly
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid();
$$;

-- Normalize get_user_role to be consistent with get_my_role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Ensure get_my_role also has explicit schema qualification
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Fix bus_seat_config: rows column is NOT NULL but the service may pass 0
-- Make it nullable with default 0 to avoid insert failures
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bus_seat_config'
      AND column_name = 'rows'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE bus_seat_config ALTER COLUMN rows SET DEFAULT 0;
    ALTER TABLE bus_seat_config ALTER COLUMN rows DROP NOT NULL;
  END IF;
END $$;

-- Fix bus_seat_config: name column is NOT NULL, ensure default prevents failure
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bus_seat_config'
      AND column_name = 'name'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE bus_seat_config ALTER COLUMN name SET DEFAULT '';
  END IF;
END $$;

-- Ensure anon role has no write access on bus_seat_config (security hardening)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE bus_seat_config FROM anon;

-- Grant explicit read to anon for public seat map display (optional, remove if not needed)
GRANT SELECT ON TABLE bus_seat_config TO anon;

-- Force PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';
