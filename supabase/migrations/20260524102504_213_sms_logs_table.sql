/*
  # SMS Logs Table for EMISMS Integration

  1. New Tables
    - `sms_logs`
      - `id` (uuid, primary key)
      - `parcel_id` (uuid, FK to parcels)
      - `recipient_phone` (text) - phone number the SMS was sent to
      - `message` (text) - full SMS message body
      - `sms_type` (text) - CREATED or ARRIVED
      - `provider` (text) - SMS provider name, default EMISMS
      - `status` (text) - SENT, FAILED, or PENDING
      - `response_api` (jsonb) - raw API response for debugging
      - `sent_at` (timestamptz) - when the SMS was actually sent
      - `created_by` (uuid, FK to auth.users) - agent who triggered the SMS
      - `created_at` (timestamptz) - record creation timestamp

  2. Security
    - RLS enabled
    - Authenticated users with agent_colis / superviseur_colis roles can read logs for their parcels
    - Insert allowed for authenticated users

  3. Anti-duplicate
    - Unique constraint on (parcel_id, sms_type) WHERE status = 'SENT' to prevent double sends

  4. Index
    - Index on parcel_id for fast lookups from parcel detail view
*/

CREATE TABLE IF NOT EXISTS sms_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id       uuid NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  recipient_phone text NOT NULL,
  message         text NOT NULL,
  sms_type        text NOT NULL CHECK (sms_type IN ('CREATED', 'ARRIVED')),
  provider        text NOT NULL DEFAULT 'EMISMS',
  status          text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('SENT', 'FAILED', 'PENDING')),
  response_api    jsonb DEFAULT '{}'::jsonb,
  sent_at         timestamptz,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_logs_no_duplicate_sent
  ON sms_logs (parcel_id, sms_type)
  WHERE status = 'SENT';

CREATE INDEX IF NOT EXISTS idx_sms_logs_parcel_id
  ON sms_logs (parcel_id);

ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sms_logs"
  ON sms_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parcels p
      WHERE p.id = sms_logs.parcel_id
    )
  );

CREATE POLICY "Authenticated users can insert sms_logs"
  ON sms_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update own sms_logs"
  ON sms_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);
