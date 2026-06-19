/*
  # Fix RLS stations — lecture pour tous les authentifiés

  La policy existante "Anyone can view active stations" ne cible pas
  les utilisateurs authentifiés explicitement, ce qui bloque les jointures
  imbriquées Supabase PostgREST pour les rôles comme rh, comptable, etc.

  Cette migration ajoute une policy SELECT explicite pour tous les
  utilisateurs authentifiés sur la table stations.
*/

CREATE POLICY "Authenticated users can view stations"
  ON stations FOR SELECT
  TO authenticated
  USING (true);
