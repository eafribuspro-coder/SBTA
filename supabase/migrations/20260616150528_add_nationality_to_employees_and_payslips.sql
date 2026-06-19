ALTER TABLE employees ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE pay_slips ADD COLUMN IF NOT EXISTS employee_nationality text;
NOTIFY pgrst, 'reload schema';