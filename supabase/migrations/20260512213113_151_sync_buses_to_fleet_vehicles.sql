/*
  # Sync buses → fleet_vehicles

  ## Problem
  The Admin module stores vehicles in the `buses` table.
  The Chargé d'Achat module reads vehicles from `fleet_vehicles`.
  These two tables were not connected, so buses created in Admin
  were invisible in the expense form autocomplete.

  ## Solution
  1. Trigger on `buses` (INSERT / UPDATE / DELETE) that upserts / deletes
     the corresponding row in `fleet_vehicles`.
  2. Backfill: copy every existing active bus into `fleet_vehicles`
     (using ON CONFLICT DO UPDATE to avoid duplicates).

  ## Fields mapped
  - registration_number  → registration_number
  - company_id           → company_id
  - brand                → brand
  - model                → model
  - is_active (buses)    → is_active (fleet_vehicles)
*/

-- ── Trigger function ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_bus_to_fleet_vehicle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Mark as inactive instead of deleting so expense history is preserved
    UPDATE fleet_vehicles
    SET is_active = false, updated_at = now()
    WHERE registration_number = OLD.registration_number
      AND company_id = OLD.company_id;
    RETURN OLD;
  END IF;

  -- INSERT or UPDATE
  INSERT INTO fleet_vehicles (registration_number, company_id, brand, model, is_active, updated_at)
  VALUES (
    NEW.registration_number,
    NEW.company_id,
    NEW.brand,
    NEW.model,
    COALESCE(NEW.is_active, true),
    now()
  )
  ON CONFLICT (registration_number, company_id)
  DO UPDATE SET
    brand      = EXCLUDED.brand,
    model      = EXCLUDED.model,
    is_active  = EXCLUDED.is_active,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- ── Attach trigger to buses ──────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_sync_bus_to_fleet_vehicle ON buses;

CREATE TRIGGER trg_sync_bus_to_fleet_vehicle
AFTER INSERT OR UPDATE OR DELETE ON buses
FOR EACH ROW EXECUTE FUNCTION sync_bus_to_fleet_vehicle();

-- ── Backfill existing buses ──────────────────────────────────────────────────

INSERT INTO fleet_vehicles (registration_number, company_id, brand, model, is_active, updated_at)
SELECT
  b.registration_number,
  b.company_id,
  b.brand,
  b.model,
  COALESCE(b.is_active, true),
  now()
FROM buses b
WHERE b.registration_number IS NOT NULL
  AND b.company_id IS NOT NULL
ON CONFLICT (registration_number, company_id)
DO UPDATE SET
  brand      = EXCLUDED.brand,
  model      = EXCLUDED.model,
  is_active  = EXCLUDED.is_active,
  updated_at = now();
