/*
  # Update views to use departure_order as canonical departure number

  ## Changes
  1. Recreate `schedule_receipt_summary` to expose `departure_order` (station-unique
     per day) instead of the old per-counter `departure_number`.
     - The column is still named `departure_number` in the view so all existing
       callers continue to work without code changes.
  2. Recreate `daily_counter_report` to sort and display by `departure_order`.

  ## Important
  `departure_order` is the station-wide sequential number assigned by the chef
  de gare. It replaces the old per-counter `departure_number` as the number
  displayed on tickets, bordereaux, and dashboards.
*/

-- 1. Recreate schedule_receipt_summary using departure_order as departure_number
CREATE OR REPLACE VIEW schedule_receipt_summary AS
SELECT
  sch.id                                        AS schedule_id,
  sch.departure_datetime,
  sch.arrival_datetime,
  sch.status,
  ds.counter_id,
  -- Use station-scoped departure_order; fall back to old departure_number for legacy rows
  COALESCE(ds.departure_order, ds.departure_number) AS departure_number,
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
  COALESCE(bus.capacity, bus.total_seats, 0) - COALESCE(res_agg.seats_sold, 0) AS seats_remaining,
  COALESCE(res_agg.total_ticket_amount, 0)      AS total_ticket_amount,
  COALESCE(res_agg.total_baggage,       0)      AS total_baggage,
  COALESCE(cc_agg.total_charges,        0)      AS total_charges,
  COALESCE(cc_agg.total_rations,        0)      AS total_rations,
  COALESCE(cc_agg.total_carburant,      0)      AS total_carburant,
  COALESCE(cc_agg.total_peages,         0)      AS total_peages,
  COALESCE(res_agg.total_ticket_amount, 0) - COALESCE(cc_agg.total_charges, 0) AS solde_ticket,
  seat_agg.sold_seat_numbers
FROM schedules sch
LEFT JOIN departure_sequence ds         ON ds.schedule_id = sch.id
LEFT JOIN counters cnt                  ON cnt.id = ds.counter_id
LEFT JOIN stations st_dep               ON st_dep.id = sch.departure_station_id
LEFT JOIN routes rte                    ON rte.id = sch.route_id
LEFT JOIN cities city_orig              ON city_orig.id = rte.origin_city_id
LEFT JOIN cities city_dest              ON city_dest.id = rte.destination_city_id
LEFT JOIN buses bus                     ON bus.id = sch.bus_id
LEFT JOIN users drv                     ON drv.id = sch.driver_id
LEFT JOIN (
  SELECT
    schedule_id,
    SUM(total_seats)   AS seats_sold,
    SUM(total_price)   AS total_ticket_amount,
    SUM(baggage_fee)   AS total_baggage
  FROM reservations
  WHERE status = ANY(ARRAY['confirmee','confirme','embarque','termine'])
  GROUP BY schedule_id
) res_agg ON res_agg.schedule_id = sch.id
LEFT JOIN (
  SELECT
    r.schedule_id,
    array_agg(DISTINCT s_num.s_num ORDER BY s_num.s_num)
      FILTER (WHERE s_num.s_num IS NOT NULL) AS sold_seat_numbers
  FROM reservations r
  LEFT JOIN LATERAL unnest(r.seat_numbers) s_num(s_num) ON true
  WHERE r.status = ANY(ARRAY['confirmee','confirme','embarque','termine'])
  GROUP BY r.schedule_id
) seat_agg ON seat_agg.schedule_id = sch.id
LEFT JOIN (
  SELECT
    schedule_id,
    SUM(amount)                                              AS total_charges,
    SUM(amount) FILTER (WHERE charge_type = 'ration')       AS total_rations,
    SUM(amount) FILTER (WHERE charge_type = 'carburant_complement') AS total_carburant,
    SUM(amount) FILTER (WHERE charge_type = 'peage')        AS total_peages
  FROM counter_charges
  WHERE status <> 'rejete'
  GROUP BY schedule_id
) cc_agg ON cc_agg.schedule_id = sch.id;

-- 2. Recreate daily_counter_report using departure_order
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
      'solde_ticket',        srs.solde_ticket
    )
    ORDER BY COALESCE(ds.departure_order, ds.departure_number)
  ) AS departures_detail
FROM departure_sequence ds
JOIN schedule_receipt_summary srs ON srs.schedule_id = ds.schedule_id
JOIN counters cnt                  ON cnt.id = ds.counter_id
JOIN stations st                   ON st.id = srs.station_id
JOIN routes rte                    ON rte.id = srs.route_id
GROUP BY ds.counter_id, ds.departure_date, cnt.counter_number, st.name, rte.name;
