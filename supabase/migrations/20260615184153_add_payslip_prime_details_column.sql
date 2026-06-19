ALTER TABLE pay_slips ADD COLUMN IF NOT EXISTS prime_details jsonb NOT NULL DEFAULT '[]'::jsonb;
NOTIFY pgrst, 'reload schema';