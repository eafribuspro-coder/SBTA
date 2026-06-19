/*
  # Create RH user account

  Creates a full RH user in auth.users and public.users with:
  - Email: rh@sbta.ci
  - Password: Password123!
  - Role: rh
*/

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
BEGIN
  -- Insert into auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'rh@sbta.ci',
    crypt('Password123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"],"role":"rh"}'::jsonb,
    '{"role":"rh"}'::jsonb,
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- Insert identity
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    'rh@sbta.ci',
    jsonb_build_object('sub', v_user_id::text, 'email', 'rh@sbta.ci'),
    'email',
    now(),
    now(),
    now()
  );

  -- Insert public profile
  INSERT INTO public.users (
    id,
    email,
    full_name,
    first_name,
    last_name,
    role,
    status,
    is_active,
    is_self_registered
  ) VALUES (
    v_user_id,
    'rh@sbta.ci',
    'Responsable RH',
    'Responsable',
    'RH',
    'rh',
    'active',
    true,
    false
  );
END $$;
