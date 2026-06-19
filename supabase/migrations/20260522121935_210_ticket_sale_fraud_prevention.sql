/*
  # Ticket Sale Fraud Prevention - Server-side Date Validation

  1. New Tables
    - `ticket_sale_audit_log`
      - `id` (uuid, primary key) - unique log entry
      - `user_id` (uuid) - the guichetier who attempted the sale
      - `counter_id` (uuid, nullable) - the counter used
      - `station_id` (uuid, nullable) - the station
      - `server_timestamp` (timestamptz) - actual server time at attempt
      - `client_timestamp` (timestamptz, nullable) - client-reported time
      - `time_drift_seconds` (integer, nullable) - difference between client and server time
      - `action` (text) - description of the attempted action
      - `schedule_id` (uuid, nullable) - the schedule targeted
      - `ip_address` (text, nullable) - client IP address
      - `status` (text) - 'blocked' or 'allowed'
      - `reason` (text, nullable) - reason for blocking
      - `metadata` (jsonb, nullable) - additional context

  2. Security
    - Enable RLS on `ticket_sale_audit_log`
    - Only admins and DAF can read audit logs
    - Insert via security definer function only

  3. Functions
    - `validate_ticket_sale_timestamp` - validates sale timing server-side
    - `log_ticket_sale_attempt` - logs every sale attempt for traceability

  4. Trigger
    - `enforce_server_timestamp_on_reservation` - forces created_at to now() on insert
*/

-- ─── Audit log table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_sale_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  counter_id uuid,
  station_id uuid,
  server_timestamp timestamptz NOT NULL DEFAULT now(),
  client_timestamp timestamptz,
  time_drift_seconds integer,
  action text NOT NULL,
  schedule_id uuid,
  ip_address text,
  status text NOT NULL DEFAULT 'allowed' CHECK (status IN ('blocked', 'allowed')),
  reason text,
  metadata jsonb
);

ALTER TABLE ticket_sale_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
  ON ticket_sale_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND (
        au.raw_app_meta_data->>'role' = 'admin'
        OR au.raw_app_meta_data->>'role' = 'daf'
      )
    )
  );

-- No direct insert policy - inserts go through security definer function

-- Index for querying by user and date
CREATE INDEX IF NOT EXISTS idx_ticket_sale_audit_user_ts
  ON ticket_sale_audit_log (user_id, server_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_sale_audit_status
  ON ticket_sale_audit_log (status, server_timestamp DESC);

-- ─── Security definer function to log sale attempts ────────
CREATE OR REPLACE FUNCTION log_ticket_sale_attempt(
  p_user_id uuid,
  p_counter_id uuid DEFAULT NULL,
  p_station_id uuid DEFAULT NULL,
  p_client_timestamp timestamptz DEFAULT NULL,
  p_action text DEFAULT 'ticket_sale',
  p_schedule_id uuid DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_status text DEFAULT 'allowed',
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_drift integer;
  v_id uuid;
BEGIN
  IF p_client_timestamp IS NOT NULL THEN
    v_drift := EXTRACT(EPOCH FROM (p_client_timestamp - now()))::integer;
  END IF;

  INSERT INTO ticket_sale_audit_log (
    user_id, counter_id, station_id, server_timestamp,
    client_timestamp, time_drift_seconds, action, schedule_id,
    ip_address, status, reason, metadata
  ) VALUES (
    p_user_id, p_counter_id, p_station_id, now(),
    p_client_timestamp, v_drift, p_action, p_schedule_id,
    p_ip_address, p_status, p_reason, p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ─── Validation function: checks schedule departure vs server time ──
CREATE OR REPLACE FUNCTION validate_ticket_sale_timestamp(
  p_schedule_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_counter_id uuid DEFAULT NULL,
  p_station_id uuid DEFAULT NULL,
  p_client_timestamp timestamptz DEFAULT NULL,
  p_ip_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_server_now timestamptz;
  v_departure timestamptz;
  v_drift integer;
  v_status text;
  v_reason text;
  v_allowed boolean;
BEGIN
  v_server_now := now();

  -- Get schedule departure time
  SELECT departure_datetime INTO v_departure
  FROM schedules
  WHERE id = p_schedule_id;

  IF v_departure IS NULL THEN
    v_status := 'blocked';
    v_reason := 'Planning introuvable';
    v_allowed := false;
  ELSIF v_departure <= v_server_now THEN
    v_status := 'blocked';
    v_reason := 'Vente impossible : l''heure de depart est passee (heure serveur)';
    v_allowed := false;
  ELSE
    v_status := 'allowed';
    v_reason := NULL;
    v_allowed := true;
  END IF;

  -- Calculate drift if client timestamp provided
  IF p_client_timestamp IS NOT NULL THEN
    v_drift := EXTRACT(EPOCH FROM (p_client_timestamp - v_server_now))::integer;
  END IF;

  -- Log the attempt
  PERFORM log_ticket_sale_attempt(
    COALESCE(p_user_id, auth.uid()),
    p_counter_id,
    p_station_id,
    p_client_timestamp,
    'ticket_sale_validation',
    p_schedule_id,
    p_ip_address,
    v_status,
    v_reason,
    jsonb_build_object(
      'departure_datetime', v_departure,
      'time_drift_seconds', v_drift
    )
  );

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'server_time', v_server_now,
    'departure_time', v_departure,
    'status', v_status,
    'reason', v_reason,
    'time_drift_seconds', v_drift
  );
END;
$$;

-- ─── Trigger: Force server timestamp on reservation insert ──
CREATE OR REPLACE FUNCTION enforce_server_timestamp_on_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Always override created_at with server time - never trust client
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_enforce_server_timestamp_reservation'
  ) THEN
    CREATE TRIGGER trg_enforce_server_timestamp_reservation
      BEFORE INSERT ON reservations
      FOR EACH ROW
      EXECUTE FUNCTION enforce_server_timestamp_on_reservation();
  END IF;
END $$;

-- ─── RPC to get server time (lightweight, for UI clock) ─────
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT now();
$$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
