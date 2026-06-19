ALTER TABLE pay_slips ADD COLUMN IF NOT EXISTS employee_hire_date date;
NOTIFY pgrst, 'reload schema';