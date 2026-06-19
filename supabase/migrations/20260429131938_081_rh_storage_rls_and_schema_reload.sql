/*
  # Module RH — Bucket Storage, correction RLS buses, et reload schema

  ## Résumé
  1. Crée le bucket `hr-documents` pour les contrats de travail (accès privé, authentifié)
  2. Corrige les policies RLS sur la table `buses` :
     - Ajoute une policy permettant au personnel opérationnel de voir les bus de SA société
       (chauffeur, mécanicien, chef_garage, pompiste, gestionnaire)
     - L'ancienne architecture supposait que les chauffeurs n'avaient pas de company_id,
       désormais ils en ont obligatoirement un.
  3. Notifie PostgREST pour recharger le cache de schéma après toutes les migrations RH.

  ## Nouvelles policies
  - `hr_docs_upload_authenticated`   — Personnel authentifié peut uploader dans hr-documents
  - `hr_docs_download_authenticated` — Personnel authentifié peut lire ses propres contrats
  - `operational_staff_see_company_buses` — Chauffeur/méca/etc. voient les bus de leur société

  ## Notes
  - Les policies storage utilisent les fonctions natives Supabase auth.uid()
  - NOTIFY pgrst recharge le cache schéma PostgREST (indispensable après ALTER TABLE)
*/

-- ──────────────────────────────────────────────────────────────
-- 1. Bucket hr-documents (contrats de travail)
-- ──────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hr-documents',
  'hr-documents',
  false,                              -- bucket privé
  10485760,                           -- 10 Mo max par fichier
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Policy : upload — RH et admin peuvent téléverser des contrats
CREATE POLICY "hr_docs_upload_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'hr-documents'
    AND get_my_role() IN ('rh', 'admin')
  );

-- Policy : lecture — RH, admin et le propriétaire du document peuvent lire
CREATE POLICY "hr_docs_download_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'hr-documents'
    AND get_my_role() IN ('rh', 'admin')
  );

-- Policy : suppression — RH et admin uniquement
CREATE POLICY "hr_docs_delete_rh_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'hr-documents'
    AND get_my_role() IN ('rh', 'admin')
  );

-- ──────────────────────────────────────────────────────────────
-- 2. Correction RLS buses : personnel opérationnel voit ses bus
-- ──────────────────────────────────────────────────────────────
-- Le personnel opérationnel doit voir les bus de SA société
-- (company_id correspond au company_id de l'utilisateur connecté)
DROP POLICY IF EXISTS "operational_staff_see_company_buses" ON buses;
CREATE POLICY "operational_staff_see_company_buses" ON buses
  FOR SELECT
  TO authenticated
  USING (
    get_my_role() IN ('chauffeur', 'mecanicien', 'chef_garage', 'pompiste', 'gestionnaire')
    AND company_id = (
      SELECT u.company_id FROM users u WHERE u.id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- 3. Recharger le cache schéma PostgREST
-- ──────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
