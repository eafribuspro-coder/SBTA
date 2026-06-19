/*
  # MODULE COLIS — PARTIE 1.4 : Fonctions SQL et triggers

  ## Fonctions
  1. generate_parcel_code()         : Génère un code court unique à 6 chiffres
  2. generate_parcel_reference()    : Génère la référence complète format MM/JJ-HHmm-XXXX
  3. get_daily_sequence()           : Numéro séquentiel journalier par gare
  4. auto_fill_parcel_codes()       : Trigger BEFORE INSERT — remplit codes + séquence + URL
  5. log_parcel_status_change()     : Trigger AFTER UPDATE — crée un événement tracking à chaque changement de statut

  ## Triggers
  - trg_auto_fill_parcel_codes  : BEFORE INSERT ON parcels
  - trg_log_parcel_tracking     : AFTER UPDATE ON parcels
*/

-- 1. Générateur de code colis court (6 chiffres, unique)
CREATE OR REPLACE FUNCTION generate_parcel_code()
RETURNS varchar(20)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_code          varchar(20);
  v_exists        boolean;
BEGIN
  LOOP
    v_code := LPAD(floor(random() * 900000 + 100000)::text, 6, '0');
    SELECT EXISTS(SELECT 1 FROM parcels WHERE parcel_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

-- 2. Générateur de référence complète (ex: 05/20-18-4922)
CREATE OR REPLACE FUNCTION generate_parcel_reference(p_code varchar)
RETURNS varchar(50)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  now_ts timestamptz := now();
BEGIN
  RETURN
    TO_CHAR(now_ts, 'MM') || '/' ||
    TO_CHAR(now_ts, 'DD') || '-' ||
    TO_CHAR(now_ts, 'HH24') || TO_CHAR(now_ts, 'MI') || '-' ||
    RIGHT(p_code, 4);
END;
$$;

-- 3. Numéro séquentiel journalier par gare
CREATE OR REPLACE FUNCTION get_daily_sequence(p_station_id uuid)
RETURNS int
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_seq int;
BEGIN
  SELECT COALESCE(MAX(daily_sequence), 0) + 1 INTO v_seq
  FROM parcels
  WHERE origin_station_id = p_station_id
    AND DATE(registered_at) = CURRENT_DATE;
  RETURN v_seq;
END;
$$;

-- 4. Trigger BEFORE INSERT : auto-remplissage codes + séquence + tracking URL
CREATE OR REPLACE FUNCTION auto_fill_parcel_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_code varchar(20);
BEGIN
  v_code              := generate_parcel_code();
  NEW.parcel_code     := v_code;
  NEW.reference       := generate_parcel_reference(v_code);
  NEW.daily_sequence  := get_daily_sequence(NEW.origin_station_id);
  NEW.tracking_url    := 'http://track.sbta.ci/' || v_code;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_fill_parcel_codes ON parcels;
CREATE TRIGGER trg_auto_fill_parcel_codes
  BEFORE INSERT ON parcels
  FOR EACH ROW EXECUTE FUNCTION auto_fill_parcel_codes();

-- 5. Trigger AFTER UPDATE : log chaque changement de statut dans parcel_tracking_events
CREATE OR REPLACE FUNCTION log_parcel_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO parcel_tracking_events (
      parcel_id,
      event_type,
      description,
      station_id,
      performed_by,
      event_at
    ) VALUES (
      NEW.id,
      NEW.status,
      CASE NEW.status
        WHEN 'enregistre'    THEN 'Colis enregistré'
        WHEN 'mis_en_paquet' THEN 'Colis mis en paquet'
        WHEN 'expedie'       THEN 'Colis expédié'
        WHEN 'arrive'        THEN 'Colis arrivé à destination'
        WHEN 'livre'         THEN 'Colis remis au destinataire'
        WHEN 'retourne'      THEN 'Colis retourné à l''expéditeur'
        WHEN 'perdu'         THEN 'Colis déclaré perdu'
        ELSE NEW.status
      END,
      CASE NEW.status
        WHEN 'enregistre'    THEN NEW.origin_station_id
        WHEN 'mis_en_paquet' THEN NEW.origin_station_id
        WHEN 'expedie'       THEN NEW.origin_station_id
        ELSE NEW.destination_station_id
      END,
      auth.uid(),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_parcel_tracking ON parcels;
CREATE TRIGGER trg_log_parcel_tracking
  AFTER UPDATE ON parcels
  FOR EACH ROW EXECUTE FUNCTION log_parcel_status_change();
