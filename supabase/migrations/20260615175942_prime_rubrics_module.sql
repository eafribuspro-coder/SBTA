-- Module de gestion des rubriques de primes rattachées aux employés.
-- prime_rubrics : catalogue des types de primes (sursalaire, ancienneté, ...).
-- employee_primes : rattachement d'une rubrique à un employé avec montant/mode.
-- Ajout colonne primes_non_imposables sur pay_slips pour stocker les primes
-- non imposables (ajoutées après le net pour obtenir le net à payer).

ALTER TABLE pay_slips ADD COLUMN IF NOT EXISTS primes_non_imposables numeric(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS prime_rubrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  is_taxable boolean NOT NULL DEFAULT true,
  periodicity text NOT NULL DEFAULT 'mensuelle' CHECK (periodicity IN ('mensuelle', 'ponctuelle', 'annuelle')),
  calc_type text NOT NULL DEFAULT 'fixed' CHECK (calc_type IN ('fixed', 'percent_base')),
  default_amount numeric(12,2) NOT NULL DEFAULT 0,
  percent_rate numeric(6,2) NOT NULL DEFAULT 0,
  target_bucket text NOT NULL DEFAULT 'primes' CHECK (target_bucket IN ('sursalaire', 'transport', 'primes', 'indemnites', 'avantages')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE prime_rubrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_prime_rubrics" ON prime_rubrics FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_prime_rubrics" ON prime_rubrics FOR INSERT
  TO authenticated WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf'));
CREATE POLICY "update_prime_rubrics" ON prime_rubrics FOR UPDATE
  TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf'))
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf'));
CREATE POLICY "delete_prime_rubrics" ON prime_rubrics FOR DELETE
  TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin'));

CREATE TABLE IF NOT EXISTS employee_primes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  employee_source text NOT NULL DEFAULT 'employees' CHECK (employee_source IN ('employees', 'users')),
  company_id uuid REFERENCES companies(id),
  employee_name text NOT NULL,
  rubric_id uuid NOT NULL REFERENCES prime_rubrics(id) ON DELETE CASCADE,
  amount numeric(12,2),
  period_year int,
  period_month int CHECK (period_month IS NULL OR period_month BETWEEN 1 AND 12),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employee_primes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_employee_primes" ON employee_primes FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_employee_primes" ON employee_primes FOR INSERT
  TO authenticated WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf'));
CREATE POLICY "update_employee_primes" ON employee_primes FOR UPDATE
  TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf'))
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf'));
CREATE POLICY "delete_employee_primes" ON employee_primes FOR DELETE
  TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin'));

CREATE INDEX idx_employee_primes_employee ON employee_primes(employee_id, employee_source);
CREATE INDEX idx_employee_primes_rubric ON employee_primes(rubric_id);
CREATE INDEX idx_employee_primes_period ON employee_primes(period_year, period_month);

INSERT INTO prime_rubrics (code, label, is_taxable, periodicity, calc_type, default_amount, percent_rate, target_bucket, sort_order) VALUES
  ('sursalaire',   'Sursalaire',          true, 'mensuelle', 'fixed',        0, 0,  'sursalaire', 1),
  ('anciennete',   'Prime d''ancienneté', true, 'mensuelle', 'percent_base', 0, 0,  'primes',     2),
  ('logement',     'Prime de logement',   true, 'mensuelle', 'fixed',        0, 0,  'primes',     3),
  ('bilan',        'Prime de bilan',      true, 'annuelle',  'fixed',        0, 0,  'primes',     4),
  ('gratification','Gratification',       true, 'annuelle',  'fixed',        0, 0,  'primes',     5),
  ('transport',    'Prime de transport',  true, 'mensuelle', 'fixed',        0, 0,  'transport',  6),
  ('conges_payes', 'Congés payés',        true, 'ponctuelle','fixed',        0, 0,  'primes',     7)
ON CONFLICT (code) DO NOTHING;

NOTIFY pgrst, 'reload schema';
