/*
  # Fix seats remaining calculation for shared buses

  1. Problem
    - When the same bus is assigned to multiple schedules at the same departure time
      (e.g., sold from different counters/stations), each schedule independently
      calculates seats_remaining = capacity - its_own_reservations.
    - This causes the Chef de Gare dashboard to show inflated seat counts
      (e.g., 82 instead of 32 for a 45-seat bus).

  2. Solution
    - Replace per-schedule reservation aggregation with a bus-level aggregation
      that sums ALL reservations from ALL schedules sharing the same bus AND
      same departure_datetime.
    - seats_remaining = bus capacity - total seats sold across all concurrent schedules for that bus.

  3. Impact
    - View `schedule_receipt_summary` is recreated with corrected logic.
    - All counters sharing the same bus will see the true remaining seats.
*/

CREATE OR REPLACE VIEW schedule_receipt_summary AS
SELECT
  sch.id                                        AS schedule_id,
  sch.departure_datetime,
  sch.arrival_datetime,
  sch.status,
  ds.counter_id,
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
  COALESCE(bus.capacity, bus.total_seats, 0) - COALESCE(bus_res_agg.bus_total_seats_sold, 0) AS seats_remaining,
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
-- Per-schedule reservation aggregation (for tickets sold from THIS schedule only)
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
-- Bus-level reservation aggregation: total seats sold across ALL schedules sharing the same bus + departure time
LEFT JOIN (
  SELECT
    s.bus_id,
    s.departure_datetime,
    SUM(r.total_seats) AS bus_total_seats_sold
  FROM reservations r
  JOIN schedules s ON s.id = r.schedule_id
  WHERE r.status = ANY(ARRAY['confirmee','confirme','embarque','termine'])
  GROUP BY s.bus_id, s.departure_datetime
) bus_res_agg ON bus_res_agg.bus_id = sch.bus_id
            AND bus_res_agg.departure_datetime = sch.departure_datetime
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
