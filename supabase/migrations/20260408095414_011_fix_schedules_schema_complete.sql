/*
  # Correction et amélioration complète du schéma schedules

  ## Problèmes identifiés
  - Incohérence entre les colonnes DB et les interfaces frontend
  - Manque de colonnes critiques : copilot_id, fill_rate, route_name
  - Manque de contraintes et validations automatiques
  - Pas de gestion des conflits de ressources

  ## Modifications
  
  ### 1. Nouvelles colonnes
    - `copilot_id` : UUID du copilote (optionnel)
    - `fill_rate` : Taux de remplissage calculé automatiquement (0-100)
    - `route_name` : Nom de la route (dénormalisé pour performance)
    - `estimated_duration_minutes` : Durée estimée en minutes
    - `is_recurring` : Indique si c'est un voyage récurrent
    - `recurrence_pattern` : Modèle de récurrence (JSONB)
    - `parent_schedule_id` : Lien vers le voyage parent si récurrent
    - `notes` : Notes du planificateur
  
  ### 2. Contraintes de validation
    - Vérification que arrival_datetime > departure_datetime
    - Vérification que fill_rate est entre 0 et 100
    - Vérification que driver_id != copilot_id
  
  ### 3. Index pour performance
    - Index sur copilot_id
    - Index composé sur (bus_id, departure_datetime, arrival_datetime)
    - Index composé sur (driver_id, departure_datetime, arrival_datetime)
  
  ### 4. Fonctions de validation
    - check_bus_availability() : Vérifie qu'un bus est disponible
    - check_driver_availability() : Vérifie qu'un chauffeur est disponible
    - check_driver_hours() : Vérifie les heures de conduite légales
  
  ### 5. Triggers automatiques
    - Auto-calcul du fill_rate
    - Auto-extraction du route_name
    - Auto-calcul de estimated_duration_minutes
    - Validation des conflits avant insert/update
  
  ## Sécurité
  - Mise à jour des politiques RLS existantes
  - Ajout de validation au niveau DB
*/

-- Ajouter les nouvelles colonnes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedules' AND column_name = 'copilot_id') THEN
    ALTER TABLE schedules ADD COLUMN copilot_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedules' AND column_name = 'fill_rate') THEN
    ALTER TABLE schedules ADD COLUMN fill_rate numeric(5,2) DEFAULT 0 CHECK (fill_rate >= 0 AND fill_rate <= 100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedules' AND column_name = 'route_name') THEN
    ALTER TABLE schedules ADD COLUMN route_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedules' AND column_name IS NULL) THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedules' AND column_name = 'estimated_duration_minutes') THEN
      ALTER TABLE schedules ADD COLUMN estimated_duration_minutes integer;
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedules' AND column_name = 'is_recurring') THEN
    ALTER TABLE schedules ADD COLUMN is_recurring boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedules' AND column_name = 'recurrence_pattern') THEN
    ALTER TABLE schedules ADD COLUMN recurrence_pattern jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedules' AND column_name = 'parent_schedule_id') THEN
    ALTER TABLE schedules ADD COLUMN parent_schedule_id uuid REFERENCES schedules(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedules' AND column_name = 'notes') THEN
    ALTER TABLE schedules ADD COLUMN notes text;
  END IF;
END $$;

-- Ajouter les contraintes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedules_driver_copilot_different') THEN
    ALTER TABLE schedules ADD CONSTRAINT schedules_driver_copilot_different CHECK (driver_id IS DISTINCT FROM copilot_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedules_arrival_after_departure') THEN
    ALTER TABLE schedules ADD CONSTRAINT schedules_arrival_after_departure CHECK (arrival_datetime > departure_datetime);
  END IF;
END $$;

-- Créer les index
CREATE INDEX IF NOT EXISTS idx_schedules_copilot_id ON schedules(copilot_id);
CREATE INDEX IF NOT EXISTS idx_schedules_bus_datetime ON schedules(bus_id, departure_datetime, arrival_datetime);
CREATE INDEX IF NOT EXISTS idx_schedules_driver_datetime ON schedules(driver_id, departure_datetime, arrival_datetime);
CREATE INDEX IF NOT EXISTS idx_schedules_copilot_datetime ON schedules(copilot_id, departure_datetime, arrival_datetime);
CREATE INDEX IF NOT EXISTS idx_schedules_route_id ON schedules(route_id);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedules_parent_id ON schedules(parent_schedule_id);

-- Fonction pour vérifier la disponibilité d'un bus
CREATE OR REPLACE FUNCTION check_bus_availability(
  p_bus_id uuid,
  p_departure_datetime timestamptz,
  p_arrival_datetime timestamptz,
  p_schedule_id uuid DEFAULT NULL
)
RETURNS TABLE (
  is_available boolean,
  conflict_schedule_id uuid,
  conflict_message text
) AS $$
DECLARE
  v_bus_status text;
  v_conflict_id uuid;
BEGIN
  SELECT status INTO v_bus_status FROM buses WHERE id = p_bus_id;

  IF v_bus_status IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Bus introuvable'::text;
    RETURN;
  END IF;

  IF v_bus_status != 'active' THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Bus non disponible (statut: ' || v_bus_status || ')'::text;
    RETURN;
  END IF;

  SELECT id INTO v_conflict_id
  FROM schedules
  WHERE bus_id = p_bus_id
    AND (p_schedule_id IS NULL OR id != p_schedule_id)
    AND ((departure_datetime, arrival_datetime) OVERLAPS (p_departure_datetime, p_arrival_datetime))
  LIMIT 1;

  IF v_conflict_id IS NOT NULL THEN
    RETURN QUERY SELECT false, v_conflict_id, 'Bus déjà affecté sur ce créneau'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::uuid, NULL::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier la disponibilité d'un chauffeur
CREATE OR REPLACE FUNCTION check_driver_availability(
  p_driver_id uuid,
  p_departure_datetime timestamptz,
  p_arrival_datetime timestamptz,
  p_schedule_id uuid DEFAULT NULL
)
RETURNS TABLE (
  is_available boolean,
  conflict_schedule_id uuid,
  conflict_message text,
  hours_today numeric,
  hours_week numeric,
  hours_remaining_today numeric
) AS $$
DECLARE
  v_driver_active boolean;
  v_conflict_id uuid;
  v_hours_today numeric;
  v_hours_week numeric;
  v_trip_hours numeric;
  v_max_daily_hours numeric := 9;
  v_max_weekly_hours numeric := 48;
BEGIN
  SELECT is_active INTO v_driver_active FROM users WHERE id = p_driver_id AND role = 'chauffeur';

  IF v_driver_active IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Chauffeur introuvable'::text, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  IF v_driver_active = false THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Chauffeur inactif'::text, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  SELECT id INTO v_conflict_id
  FROM schedules
  WHERE (driver_id = p_driver_id OR copilot_id = p_driver_id)
    AND (p_schedule_id IS NULL OR id != p_schedule_id)
    AND ((departure_datetime, arrival_datetime) OVERLAPS (p_departure_datetime, p_arrival_datetime))
  LIMIT 1;

  IF v_conflict_id IS NOT NULL THEN
    RETURN QUERY SELECT false, v_conflict_id, 'Chauffeur déjà affecté sur ce créneau'::text, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (arrival_datetime - departure_datetime)) / 3600), 0)
  INTO v_hours_today
  FROM schedules
  WHERE (driver_id = p_driver_id OR copilot_id = p_driver_id)
    AND DATE(departure_datetime) = DATE(p_departure_datetime)
    AND (p_schedule_id IS NULL OR id != p_schedule_id);

  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (arrival_datetime - departure_datetime)) / 3600), 0)
  INTO v_hours_week
  FROM schedules
  WHERE (driver_id = p_driver_id OR copilot_id = p_driver_id)
    AND DATE_TRUNC('week', departure_datetime) = DATE_TRUNC('week', p_departure_datetime)
    AND (p_schedule_id IS NULL OR id != p_schedule_id);

  v_trip_hours := EXTRACT(EPOCH FROM (p_arrival_datetime - p_departure_datetime)) / 3600;

  IF (v_hours_today + v_trip_hours) > v_max_daily_hours THEN
    RETURN QUERY SELECT 
      false, NULL::uuid, 
      'Dépassement limite quotidienne (' || ROUND(v_hours_today + v_trip_hours, 2) || 'h / ' || v_max_daily_hours || 'h)'::text,
      v_hours_today, v_hours_week, v_max_daily_hours - v_hours_today;
    RETURN;
  END IF;

  IF (v_hours_week + v_trip_hours) > v_max_weekly_hours THEN
    RETURN QUERY SELECT 
      false, NULL::uuid, 
      'Dépassement limite hebdomadaire (' || ROUND(v_hours_week + v_trip_hours, 2) || 'h / ' || v_max_weekly_hours || 'h)'::text,
      v_hours_today, v_hours_week, v_max_daily_hours - v_hours_today;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::uuid, NULL::text, v_hours_today, v_hours_week, v_max_daily_hours - v_hours_today;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour auto-calculer le fill_rate
CREATE OR REPLACE FUNCTION auto_calculate_fill_rate()
RETURNS TRIGGER AS $$
DECLARE
  v_bus_capacity integer;
  v_seats_reserved integer;
BEGIN
  SELECT capacity INTO v_bus_capacity FROM buses WHERE id = NEW.bus_id;

  IF v_bus_capacity IS NULL OR v_bus_capacity = 0 THEN
    NEW.fill_rate := 0;
    NEW.seats_available := 0;
    NEW.seats_reserved := 0;
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_seats_reserved
  FROM reservations
  WHERE schedule_id = NEW.id AND status IN ('confirmed', 'boarded');

  NEW.fill_rate := ROUND((v_seats_reserved::numeric / v_bus_capacity::numeric) * 100, 2);
  NEW.seats_reserved := v_seats_reserved;
  NEW.seats_available := v_bus_capacity - v_seats_reserved;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour auto-extraire le route_name
CREATE OR REPLACE FUNCTION auto_extract_route_info()
RETURNS TRIGGER AS $$
DECLARE
  v_route_name text;
  v_duration_minutes integer;
BEGIN
  IF NEW.route_id IS NOT NULL THEN
    SELECT r.name, r.estimated_duration_minutes
    INTO v_route_name, v_duration_minutes
    FROM routes r
    WHERE r.id = NEW.route_id;

    IF v_route_name IS NOT NULL THEN
      NEW.route_name := v_route_name;
      
      IF NEW.estimated_duration_minutes IS NULL AND v_duration_minutes IS NOT NULL THEN
        NEW.estimated_duration_minutes := v_duration_minutes;
      END IF;
    END IF;
  END IF;

  IF NEW.estimated_duration_minutes IS NULL THEN
    NEW.estimated_duration_minutes := ROUND(EXTRACT(EPOCH FROM (NEW.arrival_datetime - NEW.departure_datetime)) / 60);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour valider les conflits
CREATE OR REPLACE FUNCTION validate_schedule_conflicts()
RETURNS TRIGGER AS $$
DECLARE
  v_bus_check RECORD;
  v_driver_check RECORD;
  v_copilot_check RECORD;
BEGIN
  SELECT * INTO v_bus_check FROM check_bus_availability(NEW.bus_id, NEW.departure_datetime, NEW.arrival_datetime, NEW.id);

  IF NOT v_bus_check.is_available THEN
    RAISE EXCEPTION 'Bus non disponible: %', v_bus_check.conflict_message;
  END IF;

  SELECT * INTO v_driver_check FROM check_driver_availability(NEW.driver_id, NEW.departure_datetime, NEW.arrival_datetime, NEW.id);

  IF NOT v_driver_check.is_available THEN
    RAISE EXCEPTION 'Chauffeur non disponible: %', v_driver_check.conflict_message;
  END IF;

  IF NEW.copilot_id IS NOT NULL THEN
    SELECT * INTO v_copilot_check FROM check_driver_availability(NEW.copilot_id, NEW.departure_datetime, NEW.arrival_datetime, NEW.id);

    IF NOT v_copilot_check.is_available THEN
      RAISE EXCEPTION 'Copilote non disponible: %', v_copilot_check.conflict_message;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer les triggers
DROP TRIGGER IF EXISTS trigger_auto_extract_route_info ON schedules;
CREATE TRIGGER trigger_auto_extract_route_info
  BEFORE INSERT OR UPDATE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION auto_extract_route_info();

DROP TRIGGER IF EXISTS trigger_validate_schedule_conflicts ON schedules;
CREATE TRIGGER trigger_validate_schedule_conflicts
  BEFORE INSERT OR UPDATE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION validate_schedule_conflicts();

DROP TRIGGER IF EXISTS trigger_auto_calculate_fill_rate ON schedules;
CREATE TRIGGER trigger_auto_calculate_fill_rate
  BEFORE INSERT OR UPDATE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_fill_rate();

-- Mettre à jour les données existantes
UPDATE schedules s
SET 
  route_name = r.name,
  estimated_duration_minutes = COALESCE(
    r.estimated_duration_minutes,
    ROUND(EXTRACT(EPOCH FROM (s.arrival_datetime - s.departure_datetime)) / 60)
  )
FROM routes r
WHERE s.route_id = r.id AND (s.route_name IS NULL OR s.estimated_duration_minutes IS NULL);

-- Politiques RLS pour copilotes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Copilot can update own schedules' AND tablename = 'schedules'
  ) THEN
    CREATE POLICY "Copilot can update own schedules"
      ON schedules FOR UPDATE
      TO authenticated
      USING (copilot_id = auth.uid())
      WITH CHECK (copilot_id = auth.uid());
  END IF;
END $$;
