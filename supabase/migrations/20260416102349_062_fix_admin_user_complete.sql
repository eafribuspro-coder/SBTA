
/*
  # Fix Admin User - Complete Setup

  1. Ensures admin exists in auth.users with correct password hash ($2b$ prefix)
  2. Creates/fixes the corresponding public.users profile record
  3. Sets email as confirmed so login works
*/

-- Fix password hash prefix and confirm email for admin
UPDATE auth.users
SET 
  encrypted_password = replace(encrypted_password, '$2a$', '$2b$'),
  email_confirmed_at = NOW(),
  updated_at = NOW(),
  raw_user_meta_data = '{"full_name": "Administrateur Système", "role": "admin"}'::jsonb,
  raw_app_meta_data = '{"provider": "email", "providers": ["email"], "role": "admin"}'::jsonb
WHERE email = 'admin@sbta.ci';

-- Upsert public.users record for admin
INSERT INTO public.users (id, email, full_name, role, is_active, created_at, updated_at)
SELECT 
  u.id,
  'admin@sbta.ci',
  'Administrateur Système',
  'admin',
  true,
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email = 'admin@sbta.ci'
ON CONFLICT (id) DO UPDATE SET
  full_name = 'Administrateur Système',
  role = 'admin',
  is_active = true,
  updated_at = NOW();
