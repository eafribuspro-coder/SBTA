/*
  # Correction de la validation du statut des bus

  1. Modifications
    - Mise à jour de la fonction `check_bus_availability()` pour accepter le statut 'disponible' au lieu de 'active'
    
  2. Notes
    - Les bus dans la base de données utilisent le statut 'disponible' et non 'active'
    - Cette correction permet l'insertion de schedules avec les bus existants
*/

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

  IF v_bus_status NOT IN ('disponible', 'en_service') THEN
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
