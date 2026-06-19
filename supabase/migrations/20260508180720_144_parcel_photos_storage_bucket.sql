/*
  # Parcel Photos Storage Bucket

  ## What this does
  Creates the Storage bucket and RLS policies for parcel photos.

  ## Details
  - Creates a public bucket `parcel-photos`
  - Authenticated users (agent_colis) can upload photos
  - Photos are publicly readable (for display in detail view)
  - Only uploading user / admins can delete
*/

-- Create the bucket (public so photos can be displayed without signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'parcel-photos',
  'parcel-photos',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

-- Public SELECT: anyone can view photos (needed for img src)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Parcel photos are publicly viewable'
  ) THEN
    CREATE POLICY "Parcel photos are publicly viewable"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'parcel-photos');
  END IF;
END $$;

-- INSERT: only authenticated users can upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload parcel photos'
  ) THEN
    CREATE POLICY "Authenticated users can upload parcel photos"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'parcel-photos');
  END IF;
END $$;

-- DELETE: only owner can delete their uploads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete own parcel photos'
  ) THEN
    CREATE POLICY "Users can delete own parcel photos"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'parcel-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
