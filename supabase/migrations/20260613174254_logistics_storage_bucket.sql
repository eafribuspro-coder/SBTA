-- Storage bucket for logistics documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logistics-documents',
  'logistics-documents',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/jpg','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "logistics_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'logistics-documents');
CREATE POLICY "logistics_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logistics-documents' AND get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));
CREATE POLICY "logistics_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'logistics-documents' AND get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));
CREATE POLICY "logistics_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'logistics-documents' AND get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));

NOTIFY pgrst, 'reload schema';
