/*
  # Fix schedule_receipt_summary: ticket amount multiplication bug

  ## Problem
  The LATERAL unnest(seat_numbers) creates one row per seat per reservation.
  SUM(res.total_price) therefore multiplies each reservation's price by its
  number of seats (e.g., 6-seat reservation at 45 000 F shows as 270 000 F).

  ## Fix
  Pre-aggregate reservations in a subquery (grouped by schedule_id) so that
  ticket totals, seat counts and baggage are computed before the LATERAL join.
  The LATERAL unnest is only kept for building the sold_seat_numbers array,
  and uses DISTINCT to avoid duplicates.
*/

CREATE OR REPLACE VIEW schedule_receipt_summary AS
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

  COALESCE(res_agg.seats_sold,         0)       AS seats_sold,
  COALESCE(bus.capacity, bus.total_seats, 0)
    - COALESCE(res_agg.seats_sold,     0)       AS seats_remaining,
  COALESCE(res_agg.total_ticket_amount,0)       AS total_ticket_amount,
  COALESCE(res_agg.total_baggage,      0)       AS total_baggage,

  COALESCE(cc_agg.total_charges,       0)       AS total_charges,
  COALESCE(cc_agg.total_rations,       0)       AS total_rations,
  COALESCE(cc_agg.total_carburant,     0)       AS total_carburant,
  COALESCE(cc_agg.total_peages,        0)       AS total_peages,

  COALESCE(res_agg.total_ticket_amount,0)
    - COALESCE(cc_agg.total_charges,   0)       AS solde_ticket,

  res_agg.sold_seat_numbers

FROM schedules sch
LEFT JOIN departure_sequence  ds         ON ds.schedule_id    = sch.id
LEFT JOIN counters             cnt        ON cnt.id            = ds.counter_id
LEFT JOIN stations             st_dep    ON st_dep.id         = sch.departure_station_id
LEFT JOIN routes               rte       ON rte.id            = sch.route_id
LEFT JOIN cities               city_orig ON city_orig.id      = rte.origin_city_id
LEFT JOIN cities               city_dest ON city_dest.id      = rte.destination_city_id
LEFT JOIN buses                bus       ON bus.id            = sch.bus_id
LEFT JOIN users                drv       ON drv.id            = sch.driver_id

-- Tickets pré-agrégés par schedule
LEFT JOIN (
  SELECT
    r.schedule_id,
    COUNT(r.id)                                 AS seats_sold,
    SUM(r.total_price)                          AS total_ticket_amount,
    SUM(r.baggage_fee)                          AS total_baggage,
    array_agg(DISTINCT s_num ORDER BY s_num)
      FILTER (WHERE s_num IS NOT NULL)          AS sold_seat_numbers
  FROM reservations r
  LEFT JOIN LATERAL unnest(r.seat_numbers) s_num ON true
  WHERE r.status = ANY (ARRAY['confirmee','confirme','embarque','termine'])
  GROUP BY r.schedule_id
) res_agg ON res_agg.schedule_id = sch.id

-- Charges pré-agrégées par schedule
LEFT JOIN (
  SELECT
    schedule_id,
    SUM(amount)                                                      AS total_charges,
    SUM(amount) FILTER (WHERE charge_type = 'ration')                AS total_rations,
    SUM(amount) FILTER (WHERE charge_type = 'carburant_complement')  AS total_carburant,
    SUM(amount) FILTER (WHERE charge_type = 'peage')                 AS total_peages
  FROM counter_charges
  WHERE status <> 'rejete'
  GROUP BY schedule_id
) cc_agg ON cc_agg.schedule_id = sch.id

GROUP BY
  sch.id, sch.departure_datetime, sch.arrival_datetime, sch.status,
  ds.counter_id, ds.departure_number, ds.departure_date,
  cnt.counter_number,
  st_dep.id, st_dep.name,
  rte.id, rte.name, rte.base_price,
  city_orig.name, city_dest.name,
  bus.id, bus.registration_number, bus.capacity, bus.total_seats,
  drv.first_name, drv.last_name,
  res_agg.seats_sold, res_agg.total_ticket_amount, res_agg.total_baggage, res_agg.sold_seat_numbers,
  cc_agg.total_charges, cc_agg.total_rations, cc_agg.total_carburant, cc_agg.total_peages;
