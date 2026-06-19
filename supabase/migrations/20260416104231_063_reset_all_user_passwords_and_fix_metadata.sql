/*
  # Reset all user passwords and fix metadata

  ## Summary
  This migration resets all user passwords to known values and ensures
  all auth metadata (role, email confirmation, app_meta_data) is correct
  so every profile can log in successfully.

  ## Changes
  - Admin password reset to: Admin@SBTA2026
  - All other users password reset to: Password123!
  - All users email confirmed
  - raw_app_meta_data updated to include role for all users
  - auth.identities ensured for all users
*/

-- Reset admin password
UPDATE auth.users
SET
  encrypted_password = crypt('Admin@SBTA2026', gen_salt('bf', 10)),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now(),
  raw_app_meta_data = jsonb_build_object(
    'provider', 'email',
    'providers', jsonb_build_array('email'),
    'role', 'admin'
  ),
  raw_user_meta_data = jsonb_build_object(
    'full_name', 'Administrateur Système',
    'role', 'admin'
  )
WHERE email = 'admin@sbta.ci';

-- Reset all non-admin operational users to Password123!
UPDATE auth.users
SET
  encrypted_password = crypt('Password123!', gen_salt('bf', 10)),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now(),
  raw_app_meta_data = jsonb_build_object(
    'provider', 'email',
    'providers', jsonb_build_array('email'),
    'role', p.role
  )
FROM public.users p
WHERE auth.users.id = p.id
  AND auth.users.email != 'admin@sbta.ci'
  AND p.role IS NOT NULL;

-- Ensure auth.identities exist for all users (required for login)
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  u.id::text,
  now(),
  now(),
  now()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i
  WHERE i.user_id = u.id AND i.provider = 'email'
);
