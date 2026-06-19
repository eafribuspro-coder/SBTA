/*
  # Fix after_enlevement_update_tank trigger

  ## Problem
  The trigger function referenced `type` column in bus_expenses, but the actual
  column name is `expense_type`.

  ## Changes
  - Recreates `after_enlevement_update_tank()` with correct column name `expense_type`
*/

CREATE OR REPLACE FUNCTION after_enlevement_update_tank()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Deduct quantity from the tank's current level
  UPDATE fuel_tanks
  SET current_level_liters = current_level_liters - NEW.quantity_liters
  WHERE id = NEW.tank_id;

  -- Create a bus_expenses record if a bus is linked
  IF NEW.bus_id IS NOT NULL THEN
    INSERT INTO bus_expenses (bus_id, expense_date, expense_type, amount, description, status, created_at)
    VALUES (
      NEW.bus_id,
      NEW.enlevement_date,
      'carburant',
      NEW.total_amount,
      'Enlèvement carburant – ' || NEW.quantity_liters || ' L',
      'valide',
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
