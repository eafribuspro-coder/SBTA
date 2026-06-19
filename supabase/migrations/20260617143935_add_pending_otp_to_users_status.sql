ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE public.users ADD CONSTRAINT users_status_check
  CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text, 'repos_obligatoire'::text, 'pending_confirmation'::text, 'pending_otp'::text]));

NOTIFY pgrst, 'reload schema';