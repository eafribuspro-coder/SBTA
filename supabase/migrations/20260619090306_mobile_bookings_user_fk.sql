DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'mobile_bookings_user_id_fkey'
      AND table_name = 'mobile_bookings'
  ) THEN
    ALTER TABLE mobile_bookings
      ADD CONSTRAINT mobile_bookings_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';