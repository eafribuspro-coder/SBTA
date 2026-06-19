-- OTP verification for the SBTA mobile app (/sbtamobile).
-- Codes are stored hashed and are NEVER readable by clients.
-- All reads/writes happen exclusively through edge functions using the
-- service role (which bypasses RLS). RLS is enabled with NO client policies
-- so authenticated/anon users cannot read or guess OTP codes.

CREATE TABLE IF NOT EXISTS mobile_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  blocked_until timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_otp_codes_phone ON mobile_otp_codes (phone, created_at DESC);

ALTER TABLE mobile_otp_codes ENABLE ROW LEVEL SECURITY;

-- Audit log of OTP events (sent / verify success / verify failure / expired / blocked).
CREATE TABLE IF NOT EXISTS mobile_otp_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  user_id uuid,
  event text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_otp_attempts_phone ON mobile_otp_attempts (phone, created_at DESC);

ALTER TABLE mobile_otp_attempts ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
