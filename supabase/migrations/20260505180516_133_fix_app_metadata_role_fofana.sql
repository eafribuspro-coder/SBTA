/*
  # Fix app_metadata role for Saïd Fofana (fofafana@gmail.com)

  ## Problem
  The user fofafana@gmail.com has `role` only in `raw_user_meta_data` but NOT in
  `raw_app_meta_data`. The RLS policy `users_select_staff` checks
  `auth.jwt() -> 'app_metadata' ->> 'role'`, so this user fails the check
  and cannot read any other users (drivers appear empty).

  ## Fix
  Copy the role into `raw_app_meta_data` so the JWT claim is present.
*/

UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', 'chef_gare')
WHERE email = 'fofafana@gmail.com'
  AND (raw_app_meta_data ->> 'role') IS NULL;
