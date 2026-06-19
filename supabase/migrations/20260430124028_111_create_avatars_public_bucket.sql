/*
  # Bucket public pour les avatars employés

  Crée un bucket public `employee-avatars` pour stocker les photos de profil.
  Les avatars doivent être lisibles sans authentification (affichage dans l'UI).

  - Bucket public : lecture libre
  - Écriture restreinte aux utilisateurs authentifiés
  - Taille max : 5 Mo
  - Types acceptés : image/jpeg, image/png, image/webp
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-avatars',
  'employee-avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Lecture publique
CREATE POLICY "Public avatar read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'employee-avatars');

-- Upload réservé aux authentifiés
CREATE POLICY "Authenticated avatar upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'employee-avatars');

-- Mise à jour réservée aux authentifiés
CREATE POLICY "Authenticated avatar update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'employee-avatars');
