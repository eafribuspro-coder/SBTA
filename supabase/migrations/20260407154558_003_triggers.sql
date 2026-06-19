/*
  # Triggers pour SBTA

  1. Triggers créés
    - after_review_insert: Met à jour driver_performance et champs users après insertion d'un avis
    - after_reservation_confirmed: Crédite points fidélité et vérifie règle 10 voyages
    - after_schedule_created: Génère automatiquement un bon de carburant
    - update_bus_fill_rate: Recalcule le taux de remplissage du bus

  2. Règles métier
    - Chaque avis met à jour les statistiques du chauffeur
    - Chaque réservation confirmée rapporte des points fidélité
    - Tous les 10 voyages: bonus de 500 points et changement de tier
    - Chaque voyage planifié génère un bon de carburant basé sur l'estimation
    - Le taux de remplissage est mis à jour en temps réel
*/

-- ============================================================================
-- 1. TRIGGER: Update driver performance after review
-- ============================================================================
CREATE OR REPLACE FUNCTION update_driver_performance_after_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg_rating DECIMAL(3,2);
  v_total_reviews INTEGER;
BEGIN
  -- Calculer la nouvelle moyenne et le nombre total d'avis
  SELECT 
    COALESCE(AVG(rating), 0)::DECIMAL(3,2),
    COUNT(*)::INTEGER
  INTO v_avg_rating, v_total_reviews
  FROM driver_reviews
  WHERE driver_id = NEW.driver_id;

  -- Mettre à jour la table driver_performance
  INSERT INTO driver_performance (driver_id, avg_rating, total_reviews, updated_at)
  VALUES (NEW.driver_id, v_avg_rating, v_total_reviews, now())
  ON CONFLICT (driver_id)
  DO UPDATE SET
    avg_rating = v_avg_rating,
    total_reviews = v_total_reviews,
    updated_at = now();

  -- Mettre à jour les champs dans la table users
  UPDATE users
  SET 
    driver_avg_rating = v_avg_rating,
    driver_total_reviews = v_total_reviews,
    updated_at = now()
  WHERE id = NEW.driver_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_after_review_insert
  AFTER INSERT ON driver_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_performance_after_review();

-- ============================================================================
-- 2. TRIGGER: Credit loyalty points after reservation confirmed
-- ============================================================================
CREATE OR REPLACE FUNCTION credit_loyalty_points_after_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_points_to_credit INTEGER;
  v_current_total_trips INTEGER;
  v_new_tier TEXT;
BEGIN
  -- Ne rien faire si la réservation n'est pas confirmée ou si pas de client
  IF NEW.status != 'confirmee' OR NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ne rien faire si le statut était déjà confirmé (éviter double crédit)
  IF OLD.status = 'confirmee' THEN
    RETURN NEW;
  END IF;

  -- Calculer les points à créditer (1 point par 100 FCFA)
  v_points_to_credit := FLOOR(NEW.total_price / 100)::INTEGER;

  -- Récupérer le nombre de voyages du client
  SELECT total_trips INTO v_current_total_trips
  FROM users
  WHERE id = NEW.customer_id;

  -- Incrémenter le nombre de voyages
  v_current_total_trips := COALESCE(v_current_total_trips, 0) + 1;

  -- Vérifier si c'est le 10ème voyage (ou multiple de 10)
  IF v_current_total_trips % 10 = 0 THEN
    -- Bonus de 500 points
    v_points_to_credit := v_points_to_credit + 500;
    
    -- Déterminer le nouveau tier basé sur le nombre de voyages
    v_new_tier := CASE
      WHEN v_current_total_trips >= 50 THEN 'platinum'
      WHEN v_current_total_trips >= 30 THEN 'gold'
      WHEN v_current_total_trips >= 10 THEN 'silver'
      ELSE 'bronze'
    END;

    -- Mettre à jour le tier
    UPDATE users
    SET 
      loyalty_tier = v_new_tier,
      loyalty_points = loyalty_points + v_points_to_credit,
      total_trips = v_current_total_trips,
      updated_at = now()
    WHERE id = NEW.customer_id;

    -- Logger le bonus
    INSERT INTO loyalty_points_log (customer_id, points_change, reason, reservation_id)
    VALUES (
      NEW.customer_id,
      500,
      'Bonus 10ème voyage - Tier changé à ' || v_new_tier,
      NEW.id
    );
  ELSE
    -- Mise à jour normale sans changement de tier
    UPDATE users
    SET 
      loyalty_points = loyalty_points + v_points_to_credit,
      total_trips = v_current_total_trips,
      updated_at = now()
    WHERE id = NEW.customer_id;
  END IF;

  -- Logger les points normaux
  INSERT INTO loyalty_points_log (customer_id, points_change, reason, reservation_id)
  VALUES (
    NEW.customer_id,
    FLOOR(NEW.total_price / 100)::INTEGER,
    'Points pour réservation confirmée',
    NEW.id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_after_reservation_confirmed
  AFTER INSERT OR UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION credit_loyalty_points_after_reservation();

-- ============================================================================
-- 3. TRIGGER: Generate fuel voucher after schedule created
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_fuel_voucher_after_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_route_distance DECIMAL(8,2);
  v_estimated_liters DECIMAL(10,2);
  v_fuel_price DECIMAL(10,2);
  v_voucher_number TEXT;
BEGIN
  -- Ne générer un bon que si c'est une nouvelle planification avec un bus assigné
  IF TG_OP = 'INSERT' AND NEW.bus_id IS NOT NULL THEN
    
    -- Récupérer la distance de l'itinéraire
    SELECT distance_km INTO v_route_distance
    FROM routes
    WHERE id = NEW.route_id;

    -- Estimer la consommation (moyenne de 35L/100km pour un bus)
    v_estimated_liters := (COALESCE(v_route_distance, 100) * 35.0 / 100.0)::DECIMAL(10,2);

    -- Prix du carburant (par défaut 700 FCFA/litre, à ajuster)
    v_fuel_price := 700;

    -- Générer un numéro de bon unique
    v_voucher_number := 'FV-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(nextval('fuel_voucher_seq')::TEXT, 6, '0');

    -- Créer la séquence si elle n'existe pas
    BEGIN
      PERFORM nextval('fuel_voucher_seq');
    EXCEPTION WHEN undefined_table THEN
      CREATE SEQUENCE fuel_voucher_seq START 1;
    END;

    -- Insérer le bon de carburant
    INSERT INTO fuel_vouchers (
      voucher_number,
      schedule_id,
      bus_id,
      driver_id,
      estimated_liters,
      estimated_amount,
      fuel_price_per_liter,
      status
    )
    VALUES (
      v_voucher_number,
      NEW.id,
      NEW.bus_id,
      NEW.driver_id,
      v_estimated_liters,
      v_estimated_liters * v_fuel_price,
      v_fuel_price,
      'genere'
    );

  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_after_schedule_created
  AFTER INSERT OR UPDATE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION generate_fuel_voucher_after_schedule();

-- ============================================================================
-- 4. TRIGGER: Update bus fill rate after reservation change
-- ============================================================================
CREATE OR REPLACE FUNCTION update_bus_fill_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_schedule_id UUID;
  v_bus_id UUID;
  v_total_seats INTEGER;
  v_reserved_seats INTEGER;
  v_fill_rate DECIMAL(5,2);
BEGIN
  -- Déterminer le schedule_id selon le type d'opération
  IF TG_OP = 'DELETE' THEN
    v_schedule_id := OLD.schedule_id;
  ELSE
    v_schedule_id := NEW.schedule_id;
  END IF;

  -- Récupérer le bus_id et total_seats du schedule
  SELECT s.bus_id, b.total_seats
  INTO v_bus_id, v_total_seats
  FROM schedules s
  JOIN buses b ON b.id = s.bus_id
  WHERE s.id = v_schedule_id;

  -- Si pas de bus assigné, sortir
  IF v_bus_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculer le nombre de sièges réservés pour ce voyage
  SELECT COALESCE(SUM(total_seats), 0)
  INTO v_reserved_seats
  FROM reservations
  WHERE schedule_id = v_schedule_id
    AND status IN ('confirmee', 'en_attente');

  -- Calculer le taux de remplissage
  IF v_total_seats > 0 THEN
    v_fill_rate := (v_reserved_seats::DECIMAL / v_total_seats::DECIMAL * 100)::DECIMAL(5,2);
  ELSE
    v_fill_rate := 0;
  END IF;

  -- Mettre à jour le schedule
  UPDATE schedules
  SET 
    seats_reserved = v_reserved_seats,
    seats_available = v_total_seats - v_reserved_seats,
    updated_at = now()
  WHERE id = v_schedule_id;

  -- Mettre à jour le fill_rate_current du bus (basé sur le prochain voyage)
  UPDATE buses
  SET 
    fill_rate_current = v_fill_rate,
    updated_at = now()
  WHERE id = v_bus_id;

  -- Calculer les moyennes 30j et 90j
  UPDATE buses b
  SET
    fill_rate_avg_30d = (
      SELECT COALESCE(AVG((r.seats_reserved::DECIMAL / b.total_seats::DECIMAL * 100)), 0)::DECIMAL(5,2)
      FROM schedules s
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(total_seats), 0) as seats_reserved
        FROM reservations
        WHERE schedule_id = s.id AND status IN ('confirmee', 'terminee')
      ) r ON true
      WHERE s.bus_id = b.id
        AND s.departure_datetime >= now() - INTERVAL '30 days'
        AND s.departure_datetime <= now()
    ),
    fill_rate_avg_90d = (
      SELECT COALESCE(AVG((r.seats_reserved::DECIMAL / b.total_seats::DECIMAL * 100)), 0)::DECIMAL(5,2)
      FROM schedules s
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(total_seats), 0) as seats_reserved
        FROM reservations
        WHERE schedule_id = s.id AND status IN ('confirmee', 'terminee')
      ) r ON true
      WHERE s.bus_id = b.id
        AND s.departure_datetime >= now() - INTERVAL '90 days'
        AND s.departure_datetime <= now()
    ),
    updated_at = now()
  WHERE b.id = v_bus_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_update_bus_fill_rate_insert
  AFTER INSERT ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_bus_fill_rate();

CREATE TRIGGER trigger_update_bus_fill_rate_update
  AFTER UPDATE ON reservations
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.total_seats IS DISTINCT FROM NEW.total_seats)
  EXECUTE FUNCTION update_bus_fill_rate();

CREATE TRIGGER trigger_update_bus_fill_rate_delete
  AFTER DELETE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_bus_fill_rate();

-- ============================================================================
-- Create sequence for fuel vouchers if not exists
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'fuel_voucher_seq') THEN
    CREATE SEQUENCE fuel_voucher_seq START 1;
  END IF;
END $$;
