-- Champs réglementaires ivoiriens additionnels sur les bulletins de paie
ALTER TABLE pay_slips ADD COLUMN IF NOT EXISTS cn numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE pay_slips ADD COLUMN IF NOT EXISTS igr numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE pay_slips ADD COLUMN IF NOT EXISTS cmu_employee numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE pay_slips ADD COLUMN IF NOT EXISTS cmu_employer numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE pay_slips ADD COLUMN IF NOT EXISTS transport_allowance numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE pay_slips ADD COLUMN IF NOT EXISTS taxable_gross numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE pay_slips ADD COLUMN IF NOT EXISTS parts numeric(4,1) NOT NULL DEFAULT 1;
