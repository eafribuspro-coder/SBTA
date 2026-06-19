/*
  # Module RH — Triggers ancienneté et journalisation rémunération contractuelle

  ## Résumé
  1. Trigger update_driver_seniority : recalcule automatiquement la date
     d'éligibilité au passage salarié et le statut seniority_status
     à chaque INSERT/UPDATE sur users pour les chauffeurs contractuels.

  2. Trigger log_contractual_driver_day : à chaque fois qu'un voyage
     (schedules) passe au statut 'termine', enregistre automatiquement
     un driver_daily_log pour les chauffeurs contractuels ayant un daily_rate,
     puis met à jour les cumuls du mois sur users.

  ## Comportements clés
  - Si contract_type passe de 'contractuel' → 'titulaire' : seniority_status = 'converti',
    daily_rate mis à NULL
  - Évite les doublons de logs (unicité driver_id + work_date + schedule_id)
  - SECURITY DEFINER sur log_contractual_driver_day pour contourner RLS en écriture

  ## Notes
  - set_work_year_month() est déjà créée dans la migration 083
*/

-- ──────────────────────────────────────────────────────────────────
-- 1.5 Trigger : mise à jour automatique de l'ancienneté
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_driver_seniority()
RETURNS TRIGGER AS $$
DECLARE
  threshold_months int;
  eligibility_date date;
BEGIN
  -- Passage contractuel → titulaire : marquer comme converti
  IF TG_OP = 'UPDATE'
     AND NEW.contract_type = 'titulaire'
     AND OLD.contract_type = 'contractuel' THEN
    NEW.seniority_status := 'converti';
    NEW.daily_rate := NULL;
    RETURN NEW;
  END IF;

  -- Recalcul ancienneté uniquement pour les chauffeurs contractuels avec hire_date
  IF NEW.role = 'chauffeur'
     AND NEW.contract_type = 'contractuel'
     AND NEW.hire_date IS NOT NULL THEN

    SELECT seniority_threshold_months INTO threshold_months
    FROM seniority_settings ORDER BY updated_at DESC LIMIT 1;

    -- Valeur par défaut si la table est vide
    IF threshold_months IS NULL THEN
      threshold_months := 6;
    END IF;

    eligibility_date := NEW.hire_date + (threshold_months || ' months')::interval;
    NEW.seniority_eligibility_date := eligibility_date;

    -- Ne pas écraser 'converti'
    IF COALESCE(NEW.seniority_status, 'non_eligible') != 'converti' THEN
      IF CURRENT_DATE >= eligibility_date THEN
        NEW.seniority_status := 'eligible';
      ELSE
        NEW.seniority_status := 'non_eligible';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_driver_seniority ON users;
CREATE TRIGGER trg_update_driver_seniority
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_driver_seniority();

-- ──────────────────────────────────────────────────────────────────
-- 1.6 Trigger : enregistrement automatique du jour travaillé
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_contractual_driver_day()
RETURNS TRIGGER AS $$
DECLARE
  v_driver_id     uuid;
  v_contract_type text;
  v_daily_rate    decimal(10,2);
  v_company_id    uuid;
  v_route_id      uuid;
  v_route_name    varchar(255);
  v_ticket_price  decimal(10,2);
  v_work_date     date;
  v_year_month    int;
BEGIN
  -- Uniquement quand le voyage passe à 'termine'
  IF NEW.status = 'termine' AND (OLD.status IS NULL OR OLD.status != 'termine') THEN

    -- Ignorer si pas de chauffeur assigné
    IF NEW.driver_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT u.contract_type, u.daily_rate, u.company_id
    INTO v_contract_type, v_daily_rate, v_company_id
    FROM users u WHERE u.id = NEW.driver_id;

    -- Uniquement pour les contractuels avec taux journalier défini
    IF v_contract_type = 'contractuel' AND v_daily_rate IS NOT NULL THEN

      v_driver_id  := NEW.driver_id;
      v_work_date  := (NEW.departure_datetime AT TIME ZONE 'UTC')::date;
      v_year_month := EXTRACT(YEAR FROM v_work_date)::int * 100
                    + EXTRACT(MONTH FROM v_work_date)::int;

      -- Infos de l'itinéraire (tolerant si route_id NULL)
      IF NEW.route_id IS NOT NULL THEN
        SELECT r.id, r.name, r.base_price
        INTO v_route_id, v_route_name, v_ticket_price
        FROM routes r WHERE r.id = NEW.route_id;
      END IF;

      -- Eviter les doublons pour ce voyage
      IF NOT EXISTS (
        SELECT 1 FROM driver_daily_logs
        WHERE driver_id   = v_driver_id
          AND schedule_id = NEW.id
      ) THEN
        INSERT INTO driver_daily_logs (
          driver_id, company_id, schedule_id, route_id,
          work_date, work_year_month,
          daily_rate, route_name, ticket_price
        ) VALUES (
          v_driver_id, v_company_id, NEW.id, v_route_id,
          v_work_date, v_year_month,
          v_daily_rate, v_route_name, v_ticket_price
        );

        -- Mettre à jour les cumuls du mois courant sur users
        UPDATE users SET
          days_worked_this_month = (
            SELECT COUNT(DISTINCT work_date)
            FROM driver_daily_logs
            WHERE driver_id     = v_driver_id
              AND work_year_month = (
                    EXTRACT(YEAR FROM CURRENT_DATE)::int * 100
                  + EXTRACT(MONTH FROM CURRENT_DATE)::int)
              AND payment_status != 'annule'
          ),
          current_month_earnings = (
            SELECT COALESCE(SUM(daily_rate), 0)
            FROM driver_daily_logs
            WHERE driver_id     = v_driver_id
              AND work_year_month = (
                    EXTRACT(YEAR FROM CURRENT_DATE)::int * 100
                  + EXTRACT(MONTH FROM CURRENT_DATE)::int)
              AND payment_status != 'annule'
          )
        WHERE id = v_driver_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_log_contractual_driver_day ON schedules;
CREATE TRIGGER trg_log_contractual_driver_day
  AFTER UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION log_contractual_driver_day();
