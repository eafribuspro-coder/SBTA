/*
  # Convoy feature for Chef de Gare

  1. New Tables
    - `convoys`
      - `id` (uuid, primary key)
      - `schedule_id` (uuid, references schedules, unique)
      - `amount` (decimal) - the convoy price
      - `observation` (text, nullable) - optional notes
      - `created_by` (uuid, references users)
      - `created_at` (timestamptz)

  2. Modified Constraints
    - `schedules.status` CHECK: add 'convoi' as valid status
  
  3. Modified Views
    - `schedule_receipt_summary`: add convoy_amount column
    - `daily_counter_report`: recreated (depends on schedule_receipt_summary)

  4. Security
    - RLS enabled on `convoys`
    - Chef de gare can insert and select convoys
    - Authenticated users can read convoys

  5. Notes
    - When a convoy is registered, the schedule status becomes 'convoi'
    - seats_available is set to 0 and seats_reserved = bus capacity
    - The convoy amount is added to revenue in the receipt summary
*/

-- 1. Add 'convoi' to schedules status constraint
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_status_check;
ALTER TABLE schedules ADD CONSTRAINT schedules_status_check
  CHECK (status = ANY (ARRAY['planifie', 'en_cours', 'termine', 'annule', 'retard', 'convoi']));

-- 2. Create convoys table
CREATE TABLE IF NOT EXISTS convoys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id   uuid NOT NULL REFERENCES schedules(id) UNIQUE,
  amount        decimal(15,2) NOT NULL CHECK (amount > 0),
  observation   text,
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_convoys_schedule_id ON convoys(schedule_id);

ALTER TABLE convoys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read convoys"
  ON convoys FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Chef de gare and admin can insert convoys"
  ON convoys FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('chef_gare', 'admin')
    )
  );

-- 3. Recreate schedule_receipt_summary with convoy_amount
DROP VIEW IF EXISTS daily_counter_report;
DROP VIEW IF EXISTS schedule_receipt_summary;

CREATE VIEW schedule_receipt_summary AS
SELECT
  sch.id                                        AS schedule_id,
  sch.departure_datetime,
  sch.arrival_datetime,
  sch.status,
  ds.counter_id,
  ds.departure_number,
  ds.departure_date,
  cnt.counter_number,
  st_dep.id                                     AS station_id,
  st_dep.name                                   AS station_name,
  rte.id                                        AS route_id,
  rte.name                                      AS route_name,
  rte.base_price,
  city_orig.name                                AS origin_city,
  city_dest.name                                AS destination_city,
  bus.id                                        AS bus_id,
  bus.registration_number,
  COALESCE(bus.capacity, bus.total_seats, 0)    AS capacity,
  COALESCE(drv.first_name || ' ' || drv.last_name, '—') AS driver_name,

  CASE WHEN sch.status = 'convoi'
    THEN COALESCE(bus.capacity, bus.total_seats, 0)
    ELSE COALESCE(res_agg.seats_sold, 0)
  END                                           AS seats_sold,

  CASE WHEN sch.status = 'convoi'
    THEN 0
    ELSE COALESCE(bus.capacity, bus.total_seats, 0)
      - COALESCE(res_agg.seats_sold, 0)
  END                                           AS seats_remaining,

  CASE WHEN sch.status = 'convoi'
    THEN COALESCE(cv.amount, 0)
    ELSE COALESCE(res_agg.total_ticket_amount, 0)
  END                                           AS total_ticket_amount,

  COALESCE(res_agg.total_baggage, 0)           AS total_baggage,

  COALESCE(cc_agg.total_charges,        0)      AS total_charges,
  COALESCE(cc_agg.total_rations,        0)      AS total_rations,
  COALESCE(cc_agg.total_carburant,      0)      AS total_carburant,
  COALESCE(cc_agg.total_peages,         0)      AS total_peages,
  COALESCE(cc_agg.total_autres,         0)      AS total_autres,

  COALESCE(cv.amount, 0)::numeric              AS convoy_amount,

  CASE WHEN sch.status = 'convoi'
    THEN COALESCE(cv.amount, 0) - COALESCE(cc_agg.total_charges, 0)
    ELSE COALESCE(res_agg.total_ticket_amount, 0)
      - COALESCE(cc_agg.total_charges, 0)
  END                                           AS solde_ticket,

  seat_agg.sold_seat_numbers

FROM schedules sch
LEFT JOIN departure_sequence  ds         ON ds.schedule_id    = sch.id
LEFT JOIN counters             cnt        ON cnt.id            = ds.counter_id
LEFT JOIN stations             st_dep    ON st_dep.id         = sch.departure_station_id
LEFT JOIN routes               rte       ON rte.id            = sch.route_id
LEFT JOIN cities               city_orig ON city_orig.id      = rte.origin_city_id
LEFT JOIN cities               city_dest ON city_dest.id      = rte.destination_city_id
LEFT JOIN buses                bus       ON bus.id            = sch.bus_id
LEFT JOIN users                drv       ON drv.id            = sch.driver_id

LEFT JOIN (
  SELECT
    schedule_id,
    SUM(total_seats)  AS seats_sold,
    SUM(total_price)  AS total_ticket_amount,
    SUM(baggage_fee)  AS total_baggage
  FROM reservations
  WHERE status = ANY (ARRAY['confirmee','confirme','embarque','termine'])
  GROUP BY schedule_id
) res_agg ON res_agg.schedule_id = sch.id

LEFT JOIN (
  SELECT
    r.schedule_id,
    array_agg(DISTINCT s_num ORDER BY s_num)
      FILTER (WHERE s_num IS NOT NULL)  AS sold_seat_numbers
  FROM reservations r
  LEFT JOIN LATERAL unnest(r.seat_numbers) s_num ON true
  WHERE r.status = ANY (ARRAY['confirmee','confirme','embarque','termine'])
  GROUP BY r.schedule_id
) seat_agg ON seat_agg.schedule_id = sch.id

LEFT JOIN (
  SELECT
    schedule_id,
    SUM(amount)                                                      AS total_charges,
    SUM(amount) FILTER (WHERE charge_type = 'ration')                AS total_rations,
    SUM(amount) FILTER (WHERE charge_type = 'carburant_complement')  AS total_carburant,
    SUM(amount) FILTER (WHERE charge_type = 'peage')                 AS total_peages,
    SUM(amount) FILTER (WHERE charge_type = 'autres')                AS total_autres
  FROM counter_charges
  WHERE status <> 'rejete'
  GROUP BY schedule_id
) cc_agg ON cc_agg.schedule_id = sch.id

LEFT JOIN convoys cv ON cv.schedule_id = sch.id;

-- 4. Recreate daily_counter_report
CREATE OR REPLACE VIEW daily_counter_report AS
SELECT
  ds.counter_id,
  ds.departure_date,
  cnt.counter_number,
  st.name        AS station_name,
  rte.name       AS route_name,
  COUNT(DISTINCT ds.schedule_id)                          AS total_departures,
  COALESCE(SUM(srs.seats_sold),         0)                AS total_seats_sold,
  COALESCE(SUM(srs.total_ticket_amount),0)                AS total_ticket_amount,
  COALESCE(SUM(srs.total_baggage),      0)                AS total_baggage,
  COALESCE(SUM(srs.total_charges),      0)                AS total_charges,
  COALESCE(SUM(srs.solde_ticket),       0)                AS total_solde,
  jsonb_agg(
    jsonb_build_object(
      'schedule_id',         ds.schedule_id,
      'departure_number',    COALESCE(ds.departure_order, ds.departure_number),
      'registration_number', srs.registration_number,
      'driver_name',         srs.driver_name,
      'seats_sold',          srs.seats_sold,
      'total_ticket',        srs.total_ticket_amount,
      'total_baggage',       srs.total_baggage,
      'total_charges',       srs.total_charges,
      'solde_ticket',        srs.solde_ticket,
      'convoy_amount',       srs.convoy_amount,
      'status',              srs.status
    )
    ORDER BY COALESCE(ds.departure_order, ds.departure_number)
  ) AS departures_detail
FROM departure_sequence ds
JOIN schedule_receipt_summary srs ON srs.schedule_id = ds.schedule_id
JOIN counters cnt                  ON cnt.id = ds.counter_id
JOIN stations st                   ON st.id = srs.station_id
JOIN routes rte                    ON rte.id = srs.route_id
GROUP BY ds.counter_id, ds.departure_date, cnt.counter_number, st.name, rte.name;

NOTIFY pgrst, 'reload schema';