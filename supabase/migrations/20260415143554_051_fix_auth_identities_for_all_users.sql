
/*
  # Fix auth.identities — Insert missing identity records for all seed users

  ## Problem
  All 16 users were inserted into auth.users via seed migration (050) but
  WITHOUT corresponding rows in auth.identities. In Supabase Auth v2+,
  the auth.identities table is REQUIRED for email/password login.
  Without it, GoTrue returns "Database error querying schema" (HTTP 500)
  on every login attempt, blocking ALL users from signing in.

  ## Fix
  Insert one identity row per user into auth.identities with:
  - provider = 'email'
  - provider_id = user's email address
  - identity_data includes sub, email, email_verified, phone_verified
  - email column is a generated column (excluded from INSERT)

  ON CONFLICT DO NOTHING to be idempotent.
*/

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT
  gen_random_uuid(),
  au.id,
  au.email,
  jsonb_build_object(
    'sub',            au.id::text,
    'email',          au.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  NOW(),
  NOW(),
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities ai WHERE ai.user_id = au.id
);
