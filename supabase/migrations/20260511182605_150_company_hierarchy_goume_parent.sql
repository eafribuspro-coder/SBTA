/*
  # Hiérarchie des sociétés — G-OUMÉ et ses sous-sociétés

  ## Objectif
  Ajouter le support d'une hiérarchie société → sous-sociétés sans toucher
  aux RLS ou fonctionnalités existantes. Chaque sous-société reste entièrement
  autonome (ses propres bus, dépenses, personnel, etc.).

  ## Modifications
  1. `companies` : ajout de `parent_id` (nullable) — référence vers la société mère
  2. `companies` : ajout de `is_group` booléen — vrai si la société est un groupe consolidateur
  3. Liaison : G-OUMÉ devient le parent des 9 SBTA-* sous-sociétés
  4. Vue `company_hierarchy` : affiche chaque société avec son nom de parent
  5. Fonction `get_subsidiary_ids(parent_id)` : retourne les UUIDs de toutes les
     sous-sociétés d'un groupe (utile pour les agrégations)
  6. Vue `group_company_stats` : agrégats par sous-société pour les dashboards de groupe

  ## Règles absolues
  - Les RLS existantes NE sont PAS modifiées
  - Toutes les données existantes restent intactes
  - parent_id nullable → compatibilité totale avec sociétés indépendantes
*/

-- ─── 1. Ajouter les colonnes de hiérarchie ────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE companies ADD COLUMN parent_id uuid REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'is_group'
  ) THEN
    ALTER TABLE companies ADD COLUMN is_group boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Index pour les jointures parent→enfant
CREATE INDEX IF NOT EXISTS idx_companies_parent_id ON companies(parent_id);

-- ─── 2. Marquer G-OUMÉ comme groupe ───────────────────────────────────────────
UPDATE companies
SET is_group = true
WHERE id = '6fb999ff-af36-4b90-acf8-78aeede6c531';

-- ─── 3. Rattacher les sous-sociétés à G-OUMÉ ─────────────────────────────────
UPDATE companies
SET parent_id = '6fb999ff-af36-4b90-acf8-78aeede6c531'
WHERE code IN ('SBTA- BAR', 'SBTA-BAB', 'SBTA-BAZ', 'SBTA-BFA',
               'SBTA-BIS', 'SBTA-BLO', 'SBTA-BNO', 'SBTA-BSA', 'SBTA-BSO');

-- ─── 4. Vue company_hierarchy ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW company_hierarchy AS
SELECT
  c.id,
  c.name,
  c.code,
  c.is_active,
  c.is_group,
  c.parent_id,
  p.name  AS parent_name,
  p.code  AS parent_code,
  (
    SELECT COUNT(*)
    FROM companies sub
    WHERE sub.parent_id = c.id
  ) AS subsidiary_count
FROM companies c
LEFT JOIN companies p ON p.id = c.parent_id;

-- ─── 5. Fonction utilitaire : récupère les IDs de toutes les sous-sociétés ────
CREATE OR REPLACE FUNCTION get_subsidiary_ids(p_parent_id uuid)
RETURNS TABLE(company_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE subs AS (
    SELECT id FROM companies WHERE parent_id = p_parent_id
    UNION ALL
    SELECT c.id FROM companies c
    INNER JOIN subs s ON c.parent_id = s.id
  )
  SELECT id FROM subs;
$$;

-- ─── 6. Vue agrégée pour les dashboards de groupe ────────────────────────────
CREATE OR REPLACE VIEW group_company_stats AS
SELECT
  p.id            AS group_id,
  p.name          AS group_name,
  p.code          AS group_code,
  c.id            AS subsidiary_id,
  c.name          AS subsidiary_name,
  c.code          AS subsidiary_code,
  c.is_active     AS subsidiary_is_active,
  (SELECT COUNT(*) FROM buses b WHERE b.company_id = c.id)   AS bus_count,
  (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id)   AS staff_count
FROM companies p
JOIN companies c ON c.parent_id = p.id
WHERE p.is_group = true
  AND p.is_active = true;

-- Grant read access to authenticated users
GRANT SELECT ON company_hierarchy    TO authenticated;
GRANT SELECT ON group_company_stats  TO authenticated;
GRANT EXECUTE ON FUNCTION get_subsidiary_ids(uuid) TO authenticated;
