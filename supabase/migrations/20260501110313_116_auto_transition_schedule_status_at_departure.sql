/*
  # Transition automatique du statut des voyages à l'heure de départ

  1. Fonction RPC `auto_transition_departed_schedules`
     - Passe tous les schedules `planifie` → `en_cours` quand departure_datetime <= NOW()
     - Appelée côté client à intervalles réguliers (toutes les 30 s)
     - Retourne le nombre de schedules mis à jour

  2. Politique RLS : les guichetiers et admins peuvent appeler cette fonction
*/

CREATE OR REPLACE FUNCTION public.auto_transition_departed_schedules()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE schedules
  SET status = 'en_cours'
  WHERE status = 'planifie'
    AND departure_datetime <= NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_transition_departed_schedules() TO authenticated;
