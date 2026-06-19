/*
  # Update fuel voucher trigger

  1. Modifications
    - Amélioration du trigger de génération des bons de carburant
    - Utilisation de la consommation réelle du bus (fuel_consumption_per_100km)
    - Prix de référence fixé à 875 FCFA/litre
    - Calcul du kilométrage de départ depuis buses.current_mileage
    
  2. Calculs
    - estimated_liters = route.distance_km * bus.fuel_consumption_per_100km / 100
    - estimated_unit_price = 875 FCFA
    - estimated_total_cost = estimated_liters * estimated_unit_price
    - departure_mileage = bus.current_mileage
*/

-- Drop existing trigger first
DROP TRIGGER IF EXISTS trigger_after_schedule_created ON schedules;
DROP FUNCTION IF EXISTS generate_fuel_voucher_after_schedule();

-- ============================================================================
-- TRIGGER: Generate fuel voucher after schedule created (IMPROVED)
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_fuel_voucher_after_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_route_distance DECIMAL(8,2);
  v_bus_fuel_consumption DECIMAL(5,2);
  v_bus_current_mileage DECIMAL(10,2);
  v_estimated_liters DECIMAL(10,2);
  v_fuel_price DECIMAL(10,2);
  v_estimated_total DECIMAL(10,2);
  v_voucher_number TEXT;
BEGIN
  -- Ne générer un bon que si c'est une nouvelle planification avec un bus assigné
  IF TG_OP = 'INSERT' AND NEW.bus_id IS NOT NULL THEN
    
    -- Récupérer les données du bus et de la route
    SELECT 
      r.distance_km,
      b.fuel_consumption_per_100km,
      b.current_mileage
    INTO 
      v_route_distance,
      v_bus_fuel_consumption,
      v_bus_current_mileage
    FROM routes r
    CROSS JOIN buses b
    WHERE r.id = NEW.route_id
      AND b.id = NEW.bus_id;

    -- Valeurs par défaut si données manquantes
    v_route_distance := COALESCE(v_route_distance, 100);
    v_bus_fuel_consumption := COALESCE(v_bus_fuel_consumption, 35.0);
    v_bus_current_mileage := COALESCE(v_bus_current_mileage, 0);

    -- Calculer la consommation estimée
    v_estimated_liters := (v_route_distance * v_bus_fuel_consumption / 100.0)::DECIMAL(10,2);

    -- Prix de référence du carburant (875 FCFA/litre)
    v_fuel_price := 875;

    -- Calculer le montant total estimé
    v_estimated_total := (v_estimated_liters * v_fuel_price)::DECIMAL(10,2);

    -- Générer un numéro de bon unique
    v_voucher_number := 'BON-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(nextval('fuel_voucher_seq')::TEXT, 5, '0');

    -- Insérer le bon de carburant
    INSERT INTO fuel_vouchers (
      voucher_number,
      schedule_id,
      bus_id,
      driver_id,
      estimated_liters,
      estimated_unit_price,
      estimated_amount,
      departure_mileage,
      status,
      created_at
    )
    VALUES (
      v_voucher_number,
      NEW.id,
      NEW.bus_id,
      NEW.driver_id,
      v_estimated_liters,
      v_fuel_price,
      v_estimated_total,
      v_bus_current_mileage,
      'pending_refuel',
      now()
    );

  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_after_schedule_created
  AFTER INSERT OR UPDATE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION generate_fuel_voucher_after_schedule();
