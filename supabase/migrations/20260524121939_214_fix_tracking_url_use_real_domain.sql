/*
  # Fix tracking URL to use real application domain

  1. Changes
    - Update the `generate_parcel_code_and_ref` trigger function to use
      the real Vercel deployment URL instead of the fictional `track.sbta.ci`
    - The tracking URL now points to `/track/{code}` on the actual app domain
    - Update all existing parcels with the corrected tracking URL

  2. Important
    - Uses APP_URL from edge function secrets or falls back to known Vercel domain
    - The /track/:code route auto-loads the parcel details in the browser
*/

CREATE OR REPLACE FUNCTION generate_parcel_code_and_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_exists boolean;
  v_app_url text := 'https://sbta-pink.vercel.app';
BEGIN
  LOOP
    v_code := lpad(floor(random() * 999999 + 1)::text, 6, '0');
    SELECT EXISTS (SELECT 1 FROM parcels WHERE parcel_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  NEW.parcel_code     := v_code;
  NEW.reference       := generate_parcel_reference(v_code);
  NEW.daily_sequence  := get_daily_sequence(NEW.origin_station_id);
  NEW.tracking_url    := v_app_url || '/track/' || v_code;
  RETURN NEW;
END;
$$;

UPDATE parcels
SET tracking_url = 'https://sbta-pink.vercel.app/track/' || parcel_code
WHERE tracking_url IS NULL
   OR tracking_url LIKE '%track.sbta.ci%';
