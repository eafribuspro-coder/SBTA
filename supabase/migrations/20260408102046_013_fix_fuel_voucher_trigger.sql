/*
  # Correction du trigger de génération de bons de carburant

  1. Modifications
    - Mise à jour de la fonction `generate_fuel_voucher_after_schedule()` pour utiliser les bonnes colonnes de la table buses
    - fuel_consumption au lieu de fuel_consumption_per_100km
    - mileage au lieu de current_mileage
    
  2. Notes
    - Utilise la consommation de carburant réelle du bus si disponible
    - Sinon utilise une valeur par défaut de 28.5L/100km
*/

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
  IF TG_OP = 'INSERT' AND NEW.bus_id IS NOT NULL THEN
    
    SELECT 
      r.distance_km,
      b.fuel_consumption,
      b.mileage
    INTO 
      v_route_distance,
      v_bus_fuel_consumption,
      v_bus_current_mileage
    FROM routes r
    CROSS JOIN buses b
    WHERE r.id = NEW.route_id
      AND b.id = NEW.bus_id;

    IF v_route_distance IS NULL OR v_route_distance = 0 THEN
      v_route_distance := 100;
    END IF;

    IF v_bus_fuel_consumption IS NULL OR v_bus_fuel_consumption = 0 THEN
      v_bus_fuel_consumption := 28.5;
    END IF;

    v_estimated_liters := (v_route_distance * v_bus_fuel_consumption / 100.0)::DECIMAL(10,2);
    
    v_fuel_price := 700;
    
    v_estimated_total := (v_estimated_liters * v_fuel_price)::DECIMAL(10,2);

    v_voucher_number := 'FV-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(nextval('fuel_voucher_seq')::TEXT, 6, '0');

    BEGIN
      PERFORM nextval('fuel_voucher_seq');
    EXCEPTION WHEN undefined_table THEN
      CREATE SEQUENCE IF NOT EXISTS fuel_voucher_seq START 1;
    END;

    INSERT INTO fuel_vouchers (
      voucher_number,
      schedule_id,
      bus_id,
      driver_id,
      route_id,
      estimated_liters,
      estimated_total,
      fuel_price_per_liter,
      departure_mileage,
      status,
      created_at
    ) VALUES (
      v_voucher_number,
      NEW.id,
      NEW.bus_id,
      NEW.driver_id,
      NEW.route_id,
      v_estimated_liters,
      v_estimated_total,
      v_fuel_price,
      v_bus_current_mileage,
      'pending',
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;
