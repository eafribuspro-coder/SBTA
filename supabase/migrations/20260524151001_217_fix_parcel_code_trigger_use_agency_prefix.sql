/*
  # Fix parcel code trigger to use agency_code prefix

  1. Problem
    - The active BEFORE INSERT trigger on parcels (`trg_auto_fill_parcel_codes`)
      calls the old `auto_fill_parcel_codes()` function which uses `generate_parcel_code()`
    - The new `generate_parcel_code_and_ref()` function (with agency_code prefix) was
      created but never wired up as the trigger function

  2. Fix
    - Replace `auto_fill_parcel_codes()` with the agency-code-aware logic
    - Keep the same trigger name to avoid disruption
    - Uses the origin station's `agency_code` as prefix (e.g. '01' for Adjame)
    - Result: codes like 012829 (Adjame), 027852 (Bouake), 035655 (Korhogo)
    - Falls back to pure 6-digit random if no agency_code is set
    - Uses correct Vercel app URL for tracking links
*/

CREATE OR REPLACE FUNCTION auto_fill_parcel_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_agency_code text;
  v_suffix text;
  v_exists boolean;
  v_app_url text := 'https://sbta-pink.vercel.app';
BEGIN
  SELECT s.agency_code INTO v_agency_code
  FROM stations s
  WHERE s.id = NEW.origin_station_id;

  IF v_agency_code IS NOT NULL AND length(v_agency_code) > 0 THEN
    LOOP
      v_suffix := lpad(floor(random() * 9999 + 1)::text, 4, '0');
      v_code := v_agency_code || v_suffix;
      SELECT EXISTS (SELECT 1 FROM parcels WHERE parcel_code = v_code) INTO v_exists;
      EXIT WHEN NOT v_exists;
    END LOOP;
  ELSE
    LOOP
      v_code := lpad(floor(random() * 999999 + 1)::text, 6, '0');
      SELECT EXISTS (SELECT 1 FROM parcels WHERE parcel_code = v_code) INTO v_exists;
      EXIT WHEN NOT v_exists;
    END LOOP;
  END IF;

  NEW.parcel_code     := v_code;
  NEW.reference       := generate_parcel_reference(v_code);
  NEW.daily_sequence  := get_daily_sequence(NEW.origin_station_id);
  NEW.tracking_url    := v_app_url || '/track/' || v_code;
  RETURN NEW;
END;
$$;
