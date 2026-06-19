/*
  # Accès breakdown_reports pour le chef de gare

  ## Contexte
  Le chef de gare doit pouvoir voir les pannes signalées par les chauffeurs
  depuis sa gare et les marquer comme "reçues" (recu_garage).

  ## Modifications des policies existantes

  1. **SELECT** — ajout de 'chef_gare' aux rôles autorisés à lire les signalements
  2. **UPDATE** — ajout de 'chef_gare' aux rôles autorisés à mettre à jour un signalement
     (pour marquer la réception ou changer le statut)

  ## Sécurité
  - Les policies DROP/CREATE utilisent IF EXISTS pour éviter les erreurs
  - RLS reste activé sur la table
*/

DROP POLICY IF EXISTS "Staff can view breakdown reports" ON breakdown_reports;
CREATE POLICY "Staff can view breakdown reports"
  ON breakdown_reports FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'chauffeur', 'chef_garage', 'chef_gare', 'mecanicien', 'planificateur'));

DROP POLICY IF EXISTS "Chef garage can update breakdown reports" ON breakdown_reports;
CREATE POLICY "Chef garage can update breakdown reports"
  ON breakdown_reports FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'chef_garage', 'chef_gare'))
  WITH CHECK (public.get_user_role() IN ('admin', 'chef_garage', 'chef_gare'));
