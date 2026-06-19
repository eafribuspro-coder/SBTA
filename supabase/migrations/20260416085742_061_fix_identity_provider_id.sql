/*
  # Fix auth.identities provider_id for all seeded users

  ## Problem
  All seeded users have provider_id = email address in auth.identities.
  In Supabase GoTrue 2026+, the provider_id for the 'email' provider
  must be the user's UUID (not their email address).

  The working test user (testlogin9999@test.com) was created via normal
  signup and has provider_id = user UUID. Seeded users have provider_id = email.
  This causes GoTrue to fail with "Database error querying schema" (500)
  during login.

  ## Fix
  Update provider_id in auth.identities to match the user's UUID
  for all rows where provider = 'email'.
*/

UPDATE auth.identities
SET provider_id = user_id::text
WHERE provider = 'email'
  AND provider_id != user_id::text;
