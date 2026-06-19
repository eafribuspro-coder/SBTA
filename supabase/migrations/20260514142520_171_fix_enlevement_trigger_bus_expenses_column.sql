/*
  # Fix after_enlevement_update_tank trigger

  ## Problem
  Two issues in the trigger function:
  1. Referenced `type` column instead of `expense_type`
  2. Used status value 'valide' which violates the check constraint
     (valid values: 'en_attente', 'validee', 'rejetee')

  ## Changes
  - Corrects column name to `expense_type`
  - Corrects status value to `validee`
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
      'validee',
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
