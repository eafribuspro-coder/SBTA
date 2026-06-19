/*
  # Fix chef_gare_assign_departure and chef_gare_unassign_departure RPCs

  The functions were selecting `station_id` from the `stations` table, but the
  primary key column on that table is `id`. This caused "column station_id does
  not exist" when a chef de gare tried to confirm an assignment.

  Changes:
  - Replace `SELECT station_id ... FROM stations` with `SELECT id ... FROM stations`
    in both chef_gare_assign_departure and chef_gare_unassign_departure.
*/

CREATE OR REPLACE FUNCTION public.chef_gare_assign_departure(
  p_schedule_id uuid,
  p_counter_id  uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_station  uuid;
  v_counter_station uuid;
  v_next_num        int;
  v_dep_date        date;
BEGIN
  -- Récupérer la gare du chef de gare appelant
  SELECT id INTO v_caller_station
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

CREATE OR REPLACE FUNCTION public.chef_gare_unassign_departure(
  p_schedule_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_station uuid;
  v_counter_station uuid;
  v_counter_id uuid;
BEGIN
  -- Récupérer la gare du chef de gare appelant
  SELECT id INTO v_caller_station
  FROM stations WHERE station_manager_id = auth.uid();

  IF v_caller_station IS NULL THEN
    RAISE EXCEPTION 'Vous n''êtes pas chef de gare d''une gare assignée';
  END IF;

  -- Récupérer le guichet actuellement assigné
  SELECT counter_id INTO v_counter_id
  FROM departure_sequence WHERE schedule_id = p_schedule_id;

  IF v_counter_id IS NULL THEN
    RETURN; -- Rien à supprimer
  END IF;

  -- Vérifier que le guichet appartient à sa gare
  SELECT station_id INTO v_counter_station
  FROM counters WHERE id = v_counter_id;

  IF v_counter_station IS DISTINCT FROM v_caller_station THEN
    RAISE EXCEPTION 'Ce guichet n''appartient pas à votre gare';
  END IF;

  DELETE FROM departure_sequence WHERE schedule_id = p_schedule_id;
END;
$$;
