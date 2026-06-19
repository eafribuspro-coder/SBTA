/*
  # Fix missing raw_user_meta_data roles for legacy users

  ## Problem
  Many users were created without setting raw_user_meta_data->>'role' in auth.users.
  The get_user_role() function reads from raw_app_meta_data (for security), which also
  may be missing. The RLS policies rely on get_user_role() returning the correct role.

  ## Fix
  Sync raw_app_meta_data and raw_user_meta_data from the public.users profile table
  for all auth users whose metadata is missing or incomplete.

  ## Users affected
  guichet1, chauffeur1-3, chefgarage1, chefgare1, client01-03,
  comptable, daf, gest.express, gest.premium, meca1, planif1, pompiste1
*/

DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN
    SELECT au.id, au.email, p.role
    FROM auth.users au
    JOIN public.users p ON p.id = au.id
    WHERE p.role IS NOT NULL
      AND (
        au.raw_user_meta_data->>'role' IS NULL
        OR au.raw_app_meta_data->>'role' IS NULL
      )
  LOOP
    UPDATE auth.users
    SET
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', u.role),
      raw_app_meta_data  = COALESCE(raw_app_meta_data, '{}'::jsonb)  || jsonb_build_object('role', u.role)
    WHERE id = u.id;
  END LOOP;
END $$;
