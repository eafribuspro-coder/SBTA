
-- ============================================================
-- RH & PAIE MODULE
-- Tables: pay_slips, pay_slip_lines, employee_loans, 
--         salary_deductions, employee_suspensions,
--         explanation_requests
-- ============================================================

-- 1. PAY SLIPS (Bulletins de paie)
CREATE TABLE IF NOT EXISTS pay_slips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  employee_source text NOT NULL DEFAULT 'employees' CHECK (employee_source IN ('employees', 'users')),
  company_id uuid REFERENCES companies(id),
  
  period_year int NOT NULL,
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  
  employee_name text NOT NULL,
  employee_matricule text,
  employee_role text,
  employee_cnps text,
  employee_marital_status text,
  employee_children_count int DEFAULT 0,
  contract_type text CHECK (contract_type IN ('titulaire', 'contractuel')),
  
  base_salary decimal(12,2) NOT NULL DEFAULT 0,
  sursalaire decimal(12,2) NOT NULL DEFAULT 0,
  primes decimal(12,2) NOT NULL DEFAULT 0,
  indemnites decimal(12,2) NOT NULL DEFAULT 0,
  avantages decimal(12,2) NOT NULL DEFAULT 0,
  
  gross_salary decimal(12,2) NOT NULL DEFAULT 0,
  
  retenues decimal(12,2) NOT NULL DEFAULT 0,
  cnps_employee decimal(12,2) NOT NULL DEFAULT 0,
  cnps_employer decimal(12,2) NOT NULL DEFAULT 0,
  its decimal(12,2) NOT NULL DEFAULT 0,
  
  net_salary decimal(12,2) NOT NULL DEFAULT 0,
  
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'paid')),
  validated_by uuid,
  validated_at timestamptz,
  paid_at timestamptz,
  
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(employee_id, employee_source, period_year, period_month)
);

ALTER TABLE pay_slips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_pay_slips" ON pay_slips FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_pay_slips" ON pay_slips FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  );
CREATE POLICY "update_pay_slips" ON pay_slips FOR UPDATE
  TO authenticated USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  ) WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  );
CREATE POLICY "delete_pay_slips" ON pay_slips FOR DELETE
  TO authenticated USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin')
  );

-- 2. PAY SLIP LINES (Detailed lines for each bulletin)
CREATE TABLE IF NOT EXISTS pay_slip_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_slip_id uuid NOT NULL REFERENCES pay_slips(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('gain', 'deduction')),
  line_type text NOT NULL,
  label text NOT NULL,
  base decimal(12,2),
  rate decimal(8,4),
  amount decimal(12,2) NOT NULL DEFAULT 0,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pay_slip_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_pay_slip_lines" ON pay_slip_lines FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_pay_slip_lines" ON pay_slip_lines FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  );
CREATE POLICY "update_pay_slip_lines" ON pay_slip_lines FOR UPDATE
  TO authenticated USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  ) WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  );
CREATE POLICY "delete_pay_slip_lines" ON pay_slip_lines FOR DELETE
  TO authenticated USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin')
  );

-- 3. EMPLOYEE LOANS (Emprunts sociaux / Avances / Acomptes)
CREATE TABLE IF NOT EXISTS employee_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  employee_source text NOT NULL DEFAULT 'employees' CHECK (employee_source IN ('employees', 'users')),
  company_id uuid REFERENCES companies(id),
  
  loan_type text NOT NULL CHECK (loan_type IN ('emprunt', 'avance', 'acompte')),
  employee_name text NOT NULL,
  
  amount_granted decimal(12,2) NOT NULL,
  request_date date NOT NULL,
  validation_date date,
  
  installment_count int NOT NULL DEFAULT 1,
  installment_amount decimal(12,2) NOT NULL DEFAULT 0,
  
  repayment_start date,
  repayment_end date,
  
  remaining_balance decimal(12,2) NOT NULL DEFAULT 0,
  
  status text NOT NULL DEFAULT 'en_cours' CHECK (status IN ('en_cours', 'solde', 'annule')),
  
  notes text,
  approved_by uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employee_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_employee_loans" ON employee_loans FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_employee_loans" ON employee_loans FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  );
CREATE POLICY "update_employee_loans" ON employee_loans FOR UPDATE
  TO authenticated USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  ) WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  );
CREATE POLICY "delete_employee_loans" ON employee_loans FOR DELETE
  TO authenticated USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin')
  );

-- 4. LOAN REPAYMENTS
CREATE TABLE IF NOT EXISTS loan_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES employee_loans(id) ON DELETE CASCADE,
  pay_slip_id uuid REFERENCES pay_slips(id),
  period_year int NOT NULL,
  period_month int NOT NULL,
  amount decimal(12,2) NOT NULL,
  repayment_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE loan_repayments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_loan_repayments" ON loan_repayments FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_loan_repayments" ON loan_repayments FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  );
CREATE POLICY "update_loan_repayments" ON loan_repayments FOR UPDATE
  TO authenticated USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  ) WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  );
CREATE POLICY "delete_loan_repayments" ON loan_repayments FOR DELETE
  TO authenticated USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin')
  );

-- 5. SALARY DEDUCTIONS (Retenues sur salaire)
CREATE TABLE IF NOT EXISTS salary_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  employee_source text NOT NULL DEFAULT 'employees' CHECK (employee_source IN ('employees', 'users')),
  company_id uuid REFERENCES companies(id),
  
  employee_name text NOT NULL,
  
  deduction_type text NOT NULL CHECK (deduction_type IN (
    'contravention', 'emprunt', 'avance', 'acompte',
    'absence_non_justifiee', 'sanction_financiere', 'autre'
  )),
  
  period_year int NOT NULL,
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  
  amount decimal(12,2) NOT NULL,
  motif text,
  
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'applied', 'cancelled')),
  
  pay_slip_id uuid REFERENCES pay_slips(id),
  loan_id uuid REFERENCES employee_loans(id),
  
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE salary_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_salary_deductions" ON salary_deductions FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_salary_deductions" ON salary_deductions FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  );
CREATE POLICY "update_salary_deductions" ON salary_deductions FOR UPDATE
  TO authenticated USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  ) WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  );
CREATE POLICY "delete_salary_deductions" ON salary_deductions FOR DELETE
  TO authenticated USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin')
  );

-- 6. EMPLOYEE SUSPENSIONS
CREATE TABLE IF NOT EXISTS employee_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  employee_source text NOT NULL DEFAULT 'employees' CHECK (employee_source IN ('employees', 'users')),
  company_id uuid REFERENCES companies(id),
  
  employee_name text NOT NULL,
  
  suspension_type text NOT NULL CHECK (suspension_type IN (
    'absence_prolongee', 'suspension_disciplinaire',
    'depart', 'contrat_expire', 'autre'
  )),
  
  start_date date NOT NULL,
  end_date date,
  
  motif text,
  is_salary_suspended boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  
  decided_by uuid,
  lifted_by uuid,
  lifted_at timestamptz,
  
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employee_suspensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_employee_suspensions" ON employee_suspensions FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_employee_suspensions" ON employee_suspensions FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  );
CREATE POLICY "update_employee_suspensions" ON employee_suspensions FOR UPDATE
  TO authenticated USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  ) WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  );
CREATE POLICY "delete_employee_suspensions" ON employee_suspensions FOR DELETE
  TO authenticated USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin')
  );

-- 7. EXPLANATION REQUESTS (Demandes d'explication)
CREATE TABLE IF NOT EXISTS explanation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  employee_source text NOT NULL DEFAULT 'employees' CHECK (employee_source IN ('employees', 'users')),
  company_id uuid REFERENCES companies(id),
  
  employee_name text NOT NULL,
  
  request_date date NOT NULL DEFAULT CURRENT_DATE,
  motif text NOT NULL,
  description text,
  
  proposed_sanction text,
  applied_sanction text,
  
  responsible_id uuid,
  responsible_name text,
  
  status text NOT NULL DEFAULT 'en_attente' CHECK (status IN (
    'en_attente', 'repondu', 'sanction_appliquee', 'classe'
  )),
  
  employee_response text,
  response_date date,
  
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE explanation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_explanation_requests" ON explanation_requests FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_explanation_requests" ON explanation_requests FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  );
CREATE POLICY "update_explanation_requests" ON explanation_requests FOR UPDATE
  TO authenticated USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  ) WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin', 'daf')
  );
CREATE POLICY "delete_explanation_requests" ON explanation_requests FOR DELETE
  TO authenticated USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('rh', 'admin')
  );

-- INDEXES
CREATE INDEX idx_pay_slips_employee ON pay_slips(employee_id, employee_source);
CREATE INDEX idx_pay_slips_company ON pay_slips(company_id);
CREATE INDEX idx_pay_slips_period ON pay_slips(period_year, period_month);
CREATE INDEX idx_pay_slip_lines_slip ON pay_slip_lines(pay_slip_id);
CREATE INDEX idx_employee_loans_employee ON employee_loans(employee_id, employee_source);
CREATE INDEX idx_employee_loans_company ON employee_loans(company_id);
CREATE INDEX idx_salary_deductions_employee ON salary_deductions(employee_id, employee_source);
CREATE INDEX idx_salary_deductions_period ON salary_deductions(period_year, period_month);
CREATE INDEX idx_employee_suspensions_employee ON employee_suspensions(employee_id, employee_source);
CREATE INDEX idx_explanation_requests_employee ON explanation_requests(employee_id, employee_source);
CREATE INDEX idx_explanation_requests_company ON explanation_requests(company_id);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
