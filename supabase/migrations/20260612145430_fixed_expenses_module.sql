
-- ============================================================
-- Fixed Expenses Module for Chargé Achat
-- Tables: fixed_expense_types, fixed_expenses
-- ============================================================

-- 1. Fixed expense types (configurable categories)
CREATE TABLE IF NOT EXISTS fixed_expense_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  icon        text DEFAULT '📋',
  color       text DEFAULT '#6B7280',
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE fixed_expense_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_fixed_expense_types" ON fixed_expense_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_fixed_expense_types" ON fixed_expense_types
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('charge_achat','admin','daf')
  );
CREATE POLICY "update_fixed_expense_types" ON fixed_expense_types
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('charge_achat','admin','daf')
  )
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('charge_achat','admin','daf')
  );
CREATE POLICY "delete_fixed_expense_types" ON fixed_expense_types
  FOR DELETE TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('charge_achat','admin','daf')
  );

-- Seed default types
INSERT INTO fixed_expense_types (name, icon, color, sort_order) VALUES
  ('Électricité (CIE)',         '⚡', '#F59E0B', 1),
  ('Eau (SODECI)',              '💧', '#3B82F6', 2),
  ('Loyer',                     '🏠', '#8B5CF6', 3),
  ('Internet',                  '🌐', '#06B6D4', 4),
  ('Téléphone',                 '📞', '#10B981', 5),
  ('Canal+',                    '📺', '#EF4444', 6),
  ('Sécurité',                  '🛡️', '#6366F1', 7),
  ('Entretien des locaux',      '🧹', '#D97706', 8),
  ('Taxes et redevances',       '📄', '#64748B', 9),
  ('Fournitures administratives','📎', '#0EA5E9', 10),
  ('Autres charges fixes',      '📦', '#9CA3AF', 11)
ON CONFLICT (name) DO NOTHING;


-- 2. Fixed expenses table
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_type_id   uuid NOT NULL REFERENCES fixed_expense_types(id),
  garage_id         uuid REFERENCES garages(id),
  zone              text,
  expense_date      date NOT NULL,
  amount            numeric(12,0) NOT NULL CHECK (amount >= 0),
  supplier          text,
  invoice_reference text,
  observation       text,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_fixed_expenses_type ON fixed_expenses(expense_type_id);
CREATE INDEX idx_fixed_expenses_garage ON fixed_expenses(garage_id);
CREATE INDEX idx_fixed_expenses_date ON fixed_expenses(expense_date);
CREATE INDEX idx_fixed_expenses_zone ON fixed_expenses(zone);
CREATE INDEX idx_fixed_expenses_created_by ON fixed_expenses(created_by);

ALTER TABLE fixed_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_fixed_expenses" ON fixed_expenses
  FOR SELECT TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('charge_achat','admin','daf','comptable','gestionnaire')
  );
CREATE POLICY "insert_fixed_expenses" ON fixed_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('charge_achat','admin','daf')
  );
CREATE POLICY "update_fixed_expenses" ON fixed_expenses
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('charge_achat','admin','daf')
  )
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('charge_achat','admin','daf')
  );
CREATE POLICY "delete_fixed_expenses" ON fixed_expenses
  FOR DELETE TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('charge_achat','admin','daf')
  );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
