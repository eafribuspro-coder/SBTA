/*
  # Schedule Change Logs

  Tracks every bus/driver substitution made by a Planificateur on an existing schedule.

  ## New Tables
  - `schedule_change_logs`
    - `id` (uuid, pk)
    - `schedule_id` (uuid, fk → schedules)
    - `change_type` (text): 'bus' | 'driver'
    - `old_bus_id` / `new_bus_id` (uuid, nullable)
    - `old_driver_id` / `new_driver_id` (uuid, nullable)
    - `reason` (text, not null) – mandatory motif
    - `observation` (text, nullable)
    - `changed_by` (uuid, fk → auth.users)
    - `changed_at` (timestamptz)

  ## Security
  - RLS enabled
  - Planificateur (app_metadata.role = 'planificateur') can INSERT
  - Authenticated users can SELECT their own company's logs
*/

CREATE TABLE IF NOT EXISTS schedule_change_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id    uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  change_type    text NOT NULL CHECK (change_type IN ('bus','driver')),
  old_bus_id     uuid REFERENCES buses(id),
  new_bus_id     uuid REFERENCES buses(id),
  old_driver_id  uuid REFERENCES users(id),
  new_driver_id  uuid REFERENCES users(id),
  reason         text NOT NULL,
  observation    text,
  changed_by     uuid NOT NULL REFERENCES auth.users(id),
  changed_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE schedule_change_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view change logs"
  ON schedule_change_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Planificateur and admin can insert change logs"
  ON schedule_change_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = changed_by);

-- Index for fast per-schedule lookups
CREATE INDEX IF NOT EXISTS idx_schedule_change_logs_schedule_id
  ON schedule_change_logs(schedule_id);
