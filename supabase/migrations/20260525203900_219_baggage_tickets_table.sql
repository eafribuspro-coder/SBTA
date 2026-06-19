/*
  # Baggage Tickets Module

  1. New Tables
    - `baggage_tickets`
      - `id` (uuid, primary key)
      - `baggage_number` (text, unique) - Auto-generated, format: YYYYMMDD_HHMMSS + random suffix
      - `schedule_id` (uuid, nullable, FK to schedules) - The departure this baggage is on
      - `reservation_id` (uuid, nullable, FK to reservations) - Linked passenger ticket if any
      - `destination` (text, not null) - Destination city name
      - `price` (integer, not null, default 0) - Baggage fee in FCFA
      - `seat_number` (text, nullable) - Seat of associated passenger
      - `departure_number` (integer, nullable) - N° depart
      - `bus_registration` (text, nullable) - Car / immatriculation
      - `description` (text, nullable) - Description of the baggage
      - `owner_name` (text, not null) - Nom et prenoms du proprietaire
      - `owner_phone` (text, not null) - Contact du proprietaire
      - `has_ticket` (boolean, default false) - Whether linked to a passenger ticket
      - `counter_id` (uuid, nullable, FK to counters) - Which counter sold it
      - `station_id` (uuid, nullable, FK to stations) - Which station
      - `sold_by` (uuid, not null, FK to auth.users) - Guichetier who sold
      - `created_at` (timestamptz, default now())

  2. Security
    - RLS enabled on baggage_tickets
    - Guichetier can insert and read own baggage tickets
    - Admin, chef_gare, comptable, gestionnaire, daf can read all
*/

CREATE TABLE IF NOT EXISTS baggage_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baggage_number text UNIQUE NOT NULL,
  schedule_id uuid REFERENCES schedules(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  destination text NOT NULL,
  price integer NOT NULL DEFAULT 0,
  seat_number text,
  departure_number integer,
  bus_registration text,
  description text,
  owner_name text NOT NULL,
  owner_phone text NOT NULL,
  has_ticket boolean NOT NULL DEFAULT false,
  counter_id uuid REFERENCES counters(id) ON DELETE SET NULL,
  station_id uuid REFERENCES stations(id) ON DELETE SET NULL,
  sold_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_baggage_tickets_sold_by ON baggage_tickets(sold_by);
CREATE INDEX IF NOT EXISTS idx_baggage_tickets_station ON baggage_tickets(station_id);
CREATE INDEX IF NOT EXISTS idx_baggage_tickets_schedule ON baggage_tickets(schedule_id);
CREATE INDEX IF NOT EXISTS idx_baggage_tickets_created_at ON baggage_tickets(created_at);

ALTER TABLE baggage_tickets ENABLE ROW LEVEL SECURITY;

-- Guichetier can read own baggage tickets
CREATE POLICY "Guichetier can read own baggage tickets"
  ON baggage_tickets FOR SELECT
  TO authenticated
  USING (
    sold_by = auth.uid()
    OR ((auth.jwt() -> 'app_metadata') ->> 'role') IN ('admin', 'chef_gare', 'comptable', 'gestionnaire', 'daf')
  );

-- Guichetier can insert baggage tickets
CREATE POLICY "Guichetier can insert baggage tickets"
  ON baggage_tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    sold_by = auth.uid()
    AND ((auth.jwt() -> 'app_metadata') ->> 'role') IN ('guichetier', 'admin', 'chef_gare')
  );

-- Guichetier can update own baggage tickets
CREATE POLICY "Guichetier can update own baggage tickets"
  ON baggage_tickets FOR UPDATE
  TO authenticated
  USING (sold_by = auth.uid())
  WITH CHECK (sold_by = auth.uid());

NOTIFY pgrst, 'reload schema';
