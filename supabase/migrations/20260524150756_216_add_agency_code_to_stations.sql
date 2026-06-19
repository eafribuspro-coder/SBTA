/*
  # Add agency_code column to stations table

  1. New Columns
    - `stations.agency_code` (varchar(10), nullable, unique)
      - Short numeric code identifying the agency (e.g. '01', '02', '03')
      - Used as prefix in parcel code generation to identify origin station

  2. Seed Data
    - Adjame = 01, Bouake = 02, Korhogo = 03, San-Pedro = 04,
      Yamoussoukro = 05, Yopougon = 06

  3. Parcel Code Generation
    - Updated `generate_parcel_code_and_ref()` trigger to prepend the
      origin station's agency_code to the random 4-digit code
    - Result: 6-digit code like 01XXXX where 01 = Adjame
    - Falls back to pure 6-digit random code if no agency_code is set
    - Reference format unchanged
*/

-- 1. Add the column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'agency_code'
  ) THEN
    ALTER TABLE stations ADD COLUMN agency_code varchar(10);
  END IF;
END $$;

-- Add unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stations_agency_code_unique'
  ) THEN
    ALTER TABLE stations ADD CONSTRAINT stations_agency_code_unique UNIQUE (agency_code);
  END IF;
END $$;

-- 2. Seed existing stations
UPDATE stations SET agency_code = '01' WHERE id = '51000001-0000-0000-0000-000000000001'; -- Adjame
UPDATE stations SET agency_code = '02' WHERE id = '51000001-0000-0000-0000-000000000003'; -- Bouake
UPDATE stations SET agency_code = '03' WHERE id = '51000001-0000-0000-0000-000000000005'; -- Korhogo
UPDATE stations SET agency_code = '04' WHERE id = '51000001-0000-0000-0000-000000000004'; -- San-Pedro
UPDATE stations SET agency_code = '05' WHERE id = '51000001-0000-0000-0000-000000000002'; -- Yamoussoukro
UPDATE stations SET agency_code = '06' WHERE id = '232639e7-86ef-4506-a46f-b0a36868859a'; -- Yopougon

-- 3. Update the parcel code generation trigger to use agency_code prefix
CREATE OR REPLACE FUNCTION generate_parcel_code_and_ref()
RETURNS trigger
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
  -- Fetch the agency code for the origin station
  SELECT s.agency_code INTO v_agency_code
  FROM stations s
  WHERE s.id = NEW.origin_station_id;

  IF v_agency_code IS NOT NULL AND length(v_agency_code) > 0 THEN
    -- Generate code: agency_code prefix + random 4-digit suffix
    LOOP
      v_suffix := lpad(floor(random() * 9999 + 1)::text, 4, '0');
      v_code := v_agency_code || v_suffix;
      SELECT EXISTS (SELECT 1 FROM parcels WHERE parcel_code = v_code) INTO v_exists;
      EXIT WHEN NOT v_exists;
    END LOOP;
  ELSE
    -- Fallback: pure 6-digit random code
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

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
