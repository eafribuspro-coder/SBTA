/*
  # Chef de gare : assignation des départs aux guichets

  ## Objectif
  Permettre au chef de gare d'assigner, modifier ou retirer l'assignation d'un départ
  à un guichet de sa propre gare.

  ## Changements

  ### Nouvelles policies RLS sur departure_sequence
  - Chef de gare peut SELECT les départs de sa gare
  - Chef de gare peut INSERT une assignation pour un guichet de sa gare
  - Chef de gare peut DELETE une assignation pour un guichet de sa gare

  ### Nouvelle fonction RPC
  - `chef_gare_assign_departure(p_schedule_id, p_counter_id)` :
    - Vérifie que le guichet appartient bien à la gare du chef de gare appelant
    - Supprime l'éventuelle assignation existante pour ce schedule
    - Réassigne avec un nouveau numéro de départ
    - Retourne le nouveau numéro

  - `chef_gare_unassign_departure(p_schedule_id)` :
    - Vérifie que l'assignation existante concerne un guichet de sa gare
    - Supprime la ligne dans departure_sequence
*/

-- ─── 1. Policies RLS pour chef_gare ───────────────────────────────────────────

-- SELECT : chef_gare lit les departure_sequence dont le guichet est dans sa gare
CREATE POLICY "chef_gare_select_departure_seq"
  ON departure_sequence FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'chef_gare'
    AND counter_id IN (
      SELECT id FROM counters WHERE station_id = get_my_station_id()
    )
  );

-- INSERT : chef_gare peut créer une assignation pour un guichet de sa gare
CREATE POLICY "chef_gare_insert_departure_seq"
  ON departure_sequence FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() = 'chef_gare'
    AND counter_id IN (
      SELECT id FROM counters WHERE station_id = get_my_station_id()
    )
  );

-- DELETE : chef_gare peut supprimer une assignation pour un guichet de sa gare
CREATE POLICY "chef_gare_delete_departure_seq"
  ON departure_sequence FOR DELETE
  TO authenticated
  USING (
    get_my_role() = 'chef_gare'
    AND counter_id IN (
      SELECT id FROM counters WHERE station_id = get_my_station_id()
    )
  );

-- ─── 2. Fonction RPC : assigner ou réassigner un départ ───────────────────────

CREATE OR REPLACE FUNCTION chef_gare_assign_departure(
  p_schedule_id  uuid,
  p_counter_id   uuid
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_station  uuid;
  v_counter_station uuid;
  v_next_num        int;
  v_dep_date        date;
BEGIN
  -- Récupérer la gare du chef de gare appelant
  SELECT station_id INTO v_caller_station
  FROM stations WHERE station_manager_id = auth.uid();

  IF v_caller_station IS NULL THEN
    RAISE EXCEPTION 'Vous n''êtes pas chef de gare d''une gare assignée';
  END IF;

  -- Vérifier que le guichet cible appartient à sa gare
  SELECT station_id INTO v_counter_station
  FROM counters WHERE id = p_counter_id;

  IF v_counter_station IS DISTINCT FROM v_caller_station THEN
    RAISE EXCEPTION 'Ce guichet n''appartient pas à votre gare';
  END IF;

  -- Récupérer la date du départ
  SELECT departure_datetime::date INTO v_dep_date
  FROM schedules WHERE id = p_schedule_id;

  -- Supprimer l'ancienne assignation si elle existe (réassignation)
  DELETE FROM departure_sequence WHERE schedule_id = p_schedule_id;

  -- Calculer le prochain numéro séquentiel pour ce guichet/date
  SELECT COALESCE(MAX(departure_number), 0) + 1 INTO v_next_num
  FROM departure_sequence
  WHERE counter_id    = p_counter_id
    AND departure_date = v_dep_date;

  -- Insérer la nouvelle assignation
  INSERT INTO departure_sequence (counter_id, schedule_id, departure_date, departure_number)
  VALUES (p_counter_id, p_schedule_id, v_dep_date, v_next_num);

  RETURN v_next_num;
END;
$$;

GRANT EXECUTE ON FUNCTION chef_gare_assign_departure(uuid, uuid) TO authenticated;

-- ─── 3. Fonction RPC : retirer l'assignation d'un départ ──────────────────────

CREATE OR REPLACE FUNCTION chef_gare_unassign_departure(
  p_schedule_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_station  uuid;
  v_counter_station uuid;
  v_counter_id      uuid;
BEGIN
  -- Récupérer la gare du chef de gare appelant
  SELECT station_id INTO v_caller_station
  FROM stations WHERE station_manager_id = auth.uid();

  IF v_caller_station IS NULL THEN
    RAISE EXCEPTION 'Vous n''êtes pas chef de gare d''une gare assignée';
  END IF;

  -- Récupérer le guichet actuellement assigné à ce départ
  SELECT counter_id INTO v_counter_id
  FROM departure_sequence WHERE schedule_id = p_schedule_id;

  IF v_counter_id IS NULL THEN
    RETURN; -- Pas d'assignation, rien à faire
  END IF;

  -- Vérifier que ce guichet appartient à sa gare
  SELECT station_id INTO v_counter_station
  FROM counters WHERE id = v_counter_id;

  IF v_counter_station IS DISTINCT FROM v_caller_station THEN
    RAISE EXCEPTION 'Ce guichet n''appartient pas à votre gare';
  END IF;

  -- Supprimer l'assignation
  DELETE FROM departure_sequence WHERE schedule_id = p_schedule_id;
END;
$$;

GRANT EXECUTE ON FUNCTION chef_gare_unassign_departure(uuid) TO authenticated;
