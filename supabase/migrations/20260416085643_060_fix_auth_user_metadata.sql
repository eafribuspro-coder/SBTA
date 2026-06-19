/*
  # Fix auth.users raw_user_meta_data for all seeded users

  ## Problem
  Seeded users are missing required fields in raw_user_meta_data:
  - sub (must match user id)
  - email_verified
  - phone_verified

  GoTrue requires these fields to be present in raw_user_meta_data
  to complete the login flow and issue a JWT.

  ## Fix
  Update raw_user_meta_data for all seeded users to include the
  required fields while preserving any existing metadata (like full_name).
*/

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
  'sub', id::text,
  'email', email,
  'email_verified', true,
  'phone_verified', false
)
WHERE email LIKE '%@sbta.ci'
   OR email LIKE '%@gmail.com' AND id NOT IN (
     SELECT id FROM auth.users WHERE email = 'testlogin9999@test.com'
   );
