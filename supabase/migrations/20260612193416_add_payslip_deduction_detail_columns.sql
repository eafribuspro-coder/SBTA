-- Add detailed deduction tracking columns to pay_slips
ALTER TABLE pay_slips 
  ADD COLUMN IF NOT EXISTS loan_deductions numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction_details jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN pay_slips.loan_deductions IS 'Total loan/advance installment deductions for this period';
COMMENT ON COLUMN pay_slips.deduction_details IS 'JSON array of deduction line items: [{type, label, amount, ref_id}]';

NOTIFY pgrst, 'reload schema';