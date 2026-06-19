/*
  # Relax schedule conflict trigger — bus/driver overlap is now a warning, not an error

  ## Summary
  The trigger function `validate_schedule_conflicts` previously blocked INSERT/UPDATE
  on the `schedules` table when the bus or driver was already assigned to an overlapping
  schedule.  Per the new business rule, multiple stations (Chefs de Gare) are allowed to
  share the same bus or driver on the same time slot.

  ## Changes
  - `validate_schedule_conflicts`: remove the RAISE EXCEPTION for bus conflict and
    driver/copilot conflict based on schedule overlap.
  - Keep the check that blocks a bus whose STATUS is not 'disponible' or 'en_service'
    (hardware availability), because that is still a hard constraint.
  - Driver hour-limit enforcement is handled on the client side only; the trigger no
    longer raises for it.
*/

CREATE OR REPLACE FUNCTION validate_schedule_conflicts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bus_status text;
BEGIN
  -- Hard block: bus must be in an operable status (hardware constraint).
  SELECT status INTO v_bus_status FROM buses WHERE id = NEW.bus_id;

  IF v_bus_status IS NULL THEN
    RAISE EXCEPTION 'Bus introuvable';
  END IF;

  IF v_bus_status NOT IN ('disponible', 'en_service') THEN
    RAISE EXCEPTION 'Bus non disponible (statut: %)', v_bus_status;
  END IF;

  -- Schedule-overlap conflicts (bus already on another trip, driver already assigned)
  -- are now soft warnings handled in the UI.  The trigger no longer blocks them.

  RETURN NEW;
END;
$$;
