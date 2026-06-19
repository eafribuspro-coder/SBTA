/*
  # Add "Autres" charge type to counter_charges

  1. Modified Tables
    - `counter_charges`
      - Extend `charge_type` CHECK constraint to include 'autres'

  2. Modified Views
    - `schedule_receipt_summary` (dropped and recreated)
      - Add `total_autres` column: SUM of charges where charge_type = 'autres'

  3. Notes
    - "Autres" allows guichetiers to record miscellaneous charges
    - Description is strongly encouraged for "autres" charges
    - The total_charges aggregate already includes all types automatically
*/

-- 1. Drop and recreate the CHECK constraint on charge_type to include 'autres'
ALTER TABLE counter_charges
  DROP CONSTRAINT IF EXISTS counter_charges_charge_type_check;

ALTER TABLE counter_charges
  ADD CONSTRAINT counter_charges_charge_type_check
  CHECK (charge_type IN ('ration', 'carburant_complement', 'peage', 'autres'));

-- 2. Drop existing view and recreate with total_autres column
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

  COALESCE(res_agg.seats_sold,          0)      AS seats_sold,
  COALESCE(bus.capacity, bus.total_seats, 0)
    - COALESCE(res_agg.seats_sold,      0)      AS seats_remaining,
  COALESCE(res_agg.total_ticket_amount, 0)      AS total_ticket_amount,
  COALESCE(res_agg.total_baggage,       0)      AS total_baggage,

  COALESCE(cc_agg.total_charges,        0)      AS total_charges,
  COALESCE(cc_agg.total_rations,        0)      AS total_rations,
  COALESCE(cc_agg.total_carburant,      0)      AS total_carburant,
  COALESCE(cc_agg.total_peages,         0)      AS total_peages,
  COALESCE(cc_agg.total_autres,         0)      AS total_autres,

  COALESCE(res_agg.total_ticket_amount, 0)
    - COALESCE(cc_agg.total_charges,    0)      AS solde_ticket,

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
) cc_agg ON cc_agg.schedule_id = sch.id;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';