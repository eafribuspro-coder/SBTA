/*
  # Assigner les guichetiers sans counter à un guichet existant

  - toure.said0@gmail.com et guichet1@sbta.ci n'ont pas de counter assigné
  - On crée des counters pour eux sur la station Adjamé
  - Et on s'assure que la politique RLS permet au guichetier de voir son propre counter
*/

-- Créer un counter pour guichet1@sbta.ci (id: b941e417-7400-46b9-8e82-8e3d8200c57e)
INSERT INTO counters (id, station_id, counter_number, assigned_user_id, is_active)
VALUES (
  gen_random_uuid(),
  '51000001-0000-0000-0000-000000000001',
  'GUI-ADJ-002',
  'b941e417-7400-46b9-8e82-8e3d8200c57e',
  true
)
ON CONFLICT DO NOTHING;

-- Créer un counter pour toure.said0@gmail.com (id: 8c36748c-690c-4b75-848d-c6063846512c)
INSERT INTO counters (id, station_id, counter_number, assigned_user_id, is_active)
VALUES (
  gen_random_uuid(),
  '51000001-0000-0000-0000-000000000001',
  'GUI-ADJ-003',
  '8c36748c-690c-4b75-848d-c6063846512c',
  true
)
ON CONFLICT DO NOTHING;

-- S'assurer que la policy RLS permet aussi la lecture par assigned_user_id
-- (fallback si get_user_role() ne retourne pas 'guichetier' pour certains users)
DROP POLICY IF EXISTS "Guichetier can view own counter" ON counters;
CREATE POLICY "Guichetier can view own counter"
  ON counters FOR SELECT
  TO authenticated
  USING (assigned_user_id = auth.uid());
