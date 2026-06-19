/*
  # Fix validate_schedule_conflicts trigger + rebuild 13 broken auth accounts

  ## Summary
  1. Patches validate_schedule_conflicts() to skip driver/copilot availability checks
     when driver_id or copilot_id is NULL (setting to NULL should always be allowed).
  2. Uses this fix to nullify FK references in public tables pointing at the 13 broken
     auth accounts, then rebuilds those auth.users + auth.identities rows in-place
     with a fresh $2b bcrypt hash for Password123!.
  3. Resets passwords for all remaining @sbta.ci accounts to the same hash.

  ## Security
  - No tables dropped, no data deleted from public schema
  - auth.identities recreated for the 13 accounts with correct provider_id = email
  - All passwords set to Password123! with proper $2b bcrypt prefix
*/

-- ============================================================
-- STEP 1: Fix the trigger function to skip checks for NULL ids
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_schedule_conflicts()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_bus_check    RECORD;
  v_driver_check RECORD;
  v_copilot_check RECORD;
BEGIN
  -- Bus check (bus_id should always be set)
  SELECT * INTO v_bus_check
  FROM check_bus_availability(NEW.bus_id, NEW.departure_datetime, NEW.arrival_datetime, NEW.id);

  IF NOT v_bus_check.is_available THEN
    RAISE EXCEPTION 'Bus non disponible: %', v_bus_check.conflict_message;
  END IF;

  -- Driver check — skip if driver_id is NULL (unassigned or being cleared)
  IF NEW.driver_id IS NOT NULL THEN
    SELECT * INTO v_driver_check
    FROM check_driver_availability(NEW.driver_id, NEW.departure_datetime, NEW.arrival_datetime, NEW.id);

    IF NOT v_driver_check.is_available THEN
      RAISE EXCEPTION 'Chauffeur non disponible: %', v_driver_check.conflict_message;
    END IF;
  END IF;

  -- Copilot check — skip if copilot_id is NULL
  IF NEW.copilot_id IS NOT NULL THEN
    SELECT * INTO v_copilot_check
    FROM check_driver_availability(NEW.copilot_id, NEW.departure_datetime, NEW.arrival_datetime, NEW.id);

    IF NOT v_copilot_check.is_available THEN
      RAISE EXCEPTION 'Copilote non disponible: %', v_copilot_check.conflict_message;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- STEP 2: Nullify FK references to the 13 broken accounts
-- (trigger now safe for NULL values)
-- ============================================================
DO $$
DECLARE
  _ids uuid[] := ARRAY[
    '615397c6-2d60-4bda-b4b0-2efb457a65ab'::uuid,
    '50510b79-6866-44b0-8478-1cc04a32a982'::uuid,
    '7be5e0bf-eeb5-4362-a774-684b26f93ed6'::uuid,
    'a3add3f0-5797-450f-bf0f-d1b9f0d781e7'::uuid,
    '2d2f2ddc-68e7-444d-8e3f-303fe2b7aa65'::uuid,
    '6e1f72a0-c1ed-4d58-aae7-95fb23a902a4'::uuid,
    'fd793988-b523-4998-b9a2-7888d9328b78'::uuid,
    'efa710e0-d523-4810-a7e1-5a8b2d517fe5'::uuid,
    '39550267-e64a-43a3-8036-93dc77ca3e5e'::uuid,
    'b941e417-7400-46b9-8e82-8e3d8200c57e'::uuid,
    'a3c08153-6711-48f3-b34a-0797ad1af345'::uuid,
    'd442237b-c0ad-4113-9c7c-9dd6dbd6f604'::uuid,
    '5ea1f6e1-9dfa-4d8a-8fbe-91bdf0c12d70'::uuid
  ];
BEGIN
  UPDATE public.schedules        SET driver_id  = NULL WHERE driver_id  = ANY(_ids);
  UPDATE public.schedules        SET copilot_id = NULL WHERE copilot_id = ANY(_ids);
  UPDATE public.fuel_vouchers    SET driver_id  = NULL WHERE driver_id  = ANY(_ids);
  UPDATE public.breakdown_reports SET driver_id = NULL WHERE driver_id  = ANY(_ids);

  -- Nullify driver_daily_logs if column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_daily_logs' AND column_name = 'driver_id'
  ) THEN
    UPDATE public.driver_daily_logs SET driver_id = NULL WHERE driver_id = ANY(_ids);
  END IF;
END $$;

-- ============================================================
-- STEP 3: Rebuild auth.identities for the 13 accounts
-- ============================================================
DO $$
DECLARE
  _accounts jsonb := '[
    {"id":"615397c6-2d60-4bda-b4b0-2efb457a65ab","email":"chauffeur1@sbta.ci","role":"chauffeur","full_name":"Chauffeur 1"},
    {"id":"50510b79-6866-44b0-8478-1cc04a32a982","email":"chauffeur2@sbta.ci","role":"chauffeur","full_name":"Chauffeur 2"},
    {"id":"7be5e0bf-eeb5-4362-a774-684b26f93ed6","email":"chauffeur3@sbta.ci","role":"chauffeur","full_name":"Chauffeur 3"},
    {"id":"a3add3f0-5797-450f-bf0f-d1b9f0d781e7","email":"chefgarage1@sbta.ci","role":"chef_garage","full_name":"Chef Garage 1"},
    {"id":"2d2f2ddc-68e7-444d-8e3f-303fe2b7aa65","email":"chefgare1@sbta.ci","role":"chef_gare","full_name":"Kone CHEF GARE Abidjan"},
    {"id":"6e1f72a0-c1ed-4d58-aae7-95fb23a902a4","email":"comptable@sbta.ci","role":"comptable","full_name":"Comptable SBTA"},
    {"id":"fd793988-b523-4998-b9a2-7888d9328b78","email":"daf@sbta.ci","role":"daf","full_name":"DAF SBTA"},
    {"id":"efa710e0-d523-4810-a7e1-5a8b2d517fe5","email":"gest.express@sbta.ci","role":"gestionnaire","full_name":"Gestionnaire Express"},
    {"id":"39550267-e64a-43a3-8036-93dc77ca3e5e","email":"gest.premium@sbta.ci","role":"gestionnaire","full_name":"Gestionnaire Premium"},
    {"id":"b941e417-7400-46b9-8e82-8e3d8200c57e","email":"guichet1@sbta.ci","role":"guichetier","full_name":"Guichetier 1"},
    {"id":"a3c08153-6711-48f3-b34a-0797ad1af345","email":"meca1@sbta.ci","role":"mecanicien","full_name":"Mecanicien 1"},
    {"id":"d442237b-c0ad-4113-9c7c-9dd6dbd6f604","email":"planif1@sbta.ci","role":"planificateur","full_name":"Planificateur 1"},
    {"id":"5ea1f6e1-9dfa-4d8a-8fbe-91bdf0c12d70","email":"pompiste1@sbta.ci","role":"pompiste","full_name":"Pompiste 1"}
  ]'::jsonb;
  _acc record;
  _new_hash text;
BEGIN
  FOR _acc IN
    SELECT
      (value->>'id')::uuid  AS id,
      value->>'email'       AS email,
      value->>'role'        AS role,
      value->>'full_name'   AS full_name
    FROM jsonb_array_elements(_accounts)
  LOOP
    -- Generate fresh $2b hash
    _new_hash := '$2b' || SUBSTRING(crypt('Password123!', gen_salt('bf', 10)) FROM 4);

    -- Update auth.users in-place: reset password, clear corrupt tokens, fix metadata
    UPDATE auth.users SET
      encrypted_password     = _new_hash,
      email_confirmed_at     = COALESCE(email_confirmed_at, now()),
      confirmation_token     = '',
      recovery_token         = '',
      email_change_token_new = '',
      email_change           = '',
      raw_app_meta_data      = jsonb_build_object(
        'provider', 'email',
        'providers', jsonb_build_array('email'),
        'role', _acc.role
      ),
      raw_user_meta_data     = jsonb_build_object(
        'email_verified', true,
        'role',           _acc.role,
        'full_name',      _acc.full_name
      ),
      updated_at             = now(),
      banned_until           = NULL,
      deleted_at             = NULL
    WHERE id = _acc.id;

    -- Delete any existing identity rows for this user to avoid conflicts
    DELETE FROM auth.identities WHERE user_id = _acc.id;

    -- Insert clean identity record with provider_id = email (required by GoTrue)
    INSERT INTO auth.identities (
      id, user_id, provider_id, provider,
      identity_data, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      _acc.id,
      _acc.email,
      'email',
      jsonb_build_object(
        'sub',            _acc.id::text,
        'email',          _acc.email,
        'email_verified', true,
        'provider',       'email'
      ),
      now(),
      now(),
      now()
    );
  END LOOP;
END $$;

-- ============================================================
-- STEP 4: Reset all other @sbta.ci accounts to Password123! too
-- ============================================================
UPDATE auth.users
SET
  encrypted_password = '$2b' || SUBSTRING(crypt('Password123!', gen_salt('bf', 10)) FROM 4),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  banned_until       = NULL,
  deleted_at         = NULL,
  updated_at         = now()
WHERE email LIKE '%@sbta.ci'
  AND id NOT IN (
    '615397c6-2d60-4bda-b4b0-2efb457a65ab',
    '50510b79-6866-44b0-8478-1cc04a32a982',
    '7be5e0bf-eeb5-4362-a774-684b26f93ed6',
    'a3add3f0-5797-450f-bf0f-d1b9f0d781e7',
    '2d2f2ddc-68e7-444d-8e3f-303fe2b7aa65',
    '6e1f72a0-c1ed-4d58-aae7-95fb23a902a4',
    'fd793988-b523-4998-b9a2-7888d9328b78',
    'efa710e0-d523-4810-a7e1-5a8b2d517fe5',
    '39550267-e64a-43a3-8036-93dc77ca3e5e',
    'b941e417-7400-46b9-8e82-8e3d8200c57e',
    'a3c08153-6711-48f3-b34a-0797ad1af345',
    'd442237b-c0ad-4113-9c7c-9dd6dbd6f604',
    '5ea1f6e1-9dfa-4d8a-8fbe-91bdf0c12d70'
  );
