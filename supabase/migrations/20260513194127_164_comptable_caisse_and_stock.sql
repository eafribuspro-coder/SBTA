/*
  # Module Comptable — Caisse et Stock

  1. Nouvelles tables
    - `comptable_caisse_entries` : gestion de la caisse (entrées et dépenses)
      - company_id : société du comptable
      - entry_type : 'entree' | 'depense'
      - amount : montant en FCFA
      - label : libellé
      - entry_date : date de l'opération
      - week_start : début de semaine (calculé)
      - created_by : utilisateur

    - `comptable_stock_items` : articles en stock
      - company_id : société du comptable
      - designation : nom de l'article
      - code_article : code optionnel
      - stock_min : seuil d'alerte
      - stock_initial : stock de départ
      - prix_unitaire : prix unitaire en FCFA

    - `comptable_stock_movements` : mouvements de stock (entrées/sorties)
      - company_id
      - stock_item_id : référence article
      - bus_id : bus concerné (optionnel)
      - registration_number : plaque saisie manuellement
      - movement_type : 'entree' | 'sortie'
      - quantity
      - movement_date
      - notes

  2. Sécurité
    - RLS activé sur toutes les tables
    - Comptable : accès uniquement à sa société
    - Admin : accès total
*/

-- ─── CAISSE ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comptable_caisse_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entry_type   text NOT NULL CHECK (entry_type IN ('entree', 'depense')),
  amount       numeric(12,0) NOT NULL CHECK (amount > 0),
  label        text NOT NULL DEFAULT '',
  entry_date   date NOT NULL DEFAULT CURRENT_DATE,
  week_start   date NOT NULL,
  notes        text,
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE comptable_caisse_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comptable reads own company caisse"
  ON comptable_caisse_entries FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
      UNION
      SELECT company_id FROM employees WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Comptable inserts own company caisse"
  ON comptable_caisse_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
      UNION
      SELECT company_id FROM employees WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Comptable updates own company caisse"
  ON comptable_caisse_entries FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
      UNION
      SELECT company_id FROM employees WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
      UNION
      SELECT company_id FROM employees WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Comptable deletes own company caisse"
  ON comptable_caisse_entries FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
      UNION
      SELECT company_id FROM employees WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── STOCK ITEMS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comptable_stock_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  designation     text NOT NULL,
  code_article    text,
  stock_min       numeric(10,2) NOT NULL DEFAULT 0,
  stock_initial   numeric(10,2) NOT NULL DEFAULT 0,
  prix_unitaire   numeric(12,0) NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE comptable_stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comptable reads own company stock items"
  ON comptable_stock_items FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
      UNION
      SELECT company_id FROM employees WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Comptable inserts own company stock items"
  ON comptable_stock_items FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
      UNION
      SELECT company_id FROM employees WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Comptable updates own company stock items"
  ON comptable_stock_items FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
      UNION
      SELECT company_id FROM employees WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
      UNION
      SELECT company_id FROM employees WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Comptable deletes own company stock items"
  ON comptable_stock_items FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
      UNION
      SELECT company_id FROM employees WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── STOCK MOVEMENTS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comptable_stock_movements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stock_item_id       uuid NOT NULL REFERENCES comptable_stock_items(id) ON DELETE CASCADE,
  registration_number text,
  movement_type       text NOT NULL CHECK (movement_type IN ('entree', 'sortie')),
  quantity            numeric(10,2) NOT NULL CHECK (quantity > 0),
  movement_date       date NOT NULL DEFAULT CURRENT_DATE,
  notes               text,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE comptable_stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comptable reads own company stock movements"
  ON comptable_stock_movements FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
      UNION
      SELECT company_id FROM employees WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Comptable inserts own company stock movements"
  ON comptable_stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
      UNION
      SELECT company_id FROM employees WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Comptable deletes own company stock movements"
  ON comptable_stock_movements FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
      UNION
      SELECT company_id FROM employees WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Notify PostgREST
NOTIFY pgrst, 'reload schema';
