/*
  # Fix infinite recursion in garage_staff RLS
  
  La politique "staff_read_own_garage_team" fait une sous-requête sur garage_staff
  depuis une politique de garage_staff → récursion infinie.
  
  Solution : créer une fonction SECURITY DEFINER qui court-circuite RLS pour
  récupérer le garage_id de l'utilisateur courant, puis l'utiliser dans la politique.
*/

-- Fonction SECURITY DEFINER — pas soumise à RLS
CREATE OR REPLACE FUNCTION get_my_garage_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT garage_id
  FROM garage_staff
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- Supprimer la politique récursive
DROP POLICY IF EXISTS "staff_read_own_garage_team" ON garage_staff;

-- Recréer sans récursion
CREATE POLICY "staff_read_own_garage_team"
  ON garage_staff
  FOR SELECT
  TO authenticated
  USING (garage_id = get_my_garage_id());

-- Permettre aussi aux chef_garage et mecanicien d'insérer/modifier dans leur garage
DROP POLICY IF EXISTS "chef_garage_staff_insert" ON garage_staff;
DROP POLICY IF EXISTS "chef_garage_staff_update" ON garage_staff;

CREATE POLICY "chef_garage_staff_insert"
  ON garage_staff
  FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin', 'chef_garage')
    AND garage_id = get_my_garage_id()
  );

CREATE POLICY "chef_garage_staff_update"
  ON garage_staff
  FOR UPDATE
  TO authenticated
  USING (
    get_my_role() IN ('admin', 'chef_garage')
    AND garage_id = get_my_garage_id()
  )
  WITH CHECK (
    get_my_role() IN ('admin', 'chef_garage')
    AND garage_id = get_my_garage_id()
  );
