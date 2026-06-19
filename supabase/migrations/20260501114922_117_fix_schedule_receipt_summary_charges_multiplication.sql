/*
  # Fix schedule_receipt_summary: charges multiplication bug

  ## Problem
  The view joins counter_charges at the same level as the LATERAL unnest(seat_numbers),
  which causes each charge to be counted once per seat row, multiplying the totals.

  ## Fix
  Pre-aggregate counter_charges in a subquery (grouped by schedule_id) before joining,
  so the aggregated amounts are computed independently of the reservations/seat rows.
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

  -- Tickets (réservations confirmées/embarquées/terminées)
  COUNT(res.id) FILTER (
    WHERE res.status = ANY (ARRAY['confirme','embarque','termine'])
  )                                             AS seats_sold,

  COALESCE(bus.capacity, bus.total_seats, 0)
  - COUNT(res.id) FILTER (
    WHERE res.status = ANY (ARRAY['confirme','embarque','termine'])
  )                                             AS seats_remaining,

  COALESCE(SUM(res.total_price) FILTER (
    WHERE res.status = ANY (ARRAY['confirme','embarque','termine'])
  ), 0)                                         AS total_ticket_amount,

  COALESCE(SUM(res.baggage_fee) FILTER (
    WHERE res.status = ANY (ARRAY['confirme','embarque','termine'])
  ), 0)                                         AS total_baggage,

  -- Charges pré-agrégées (indépendantes du JOIN réservations)
  COALESCE(cc_agg.total_charges,    0)          AS total_charges,
  COALESCE(cc_agg.total_rations,    0)          AS total_rations,
  COALESCE(cc_agg.total_carburant,  0)          AS total_carburant,
  COALESCE(cc_agg.total_peages,     0)          AS total_peages,

  COALESCE(SUM(res.total_price) FILTER (
    WHERE res.status = ANY (ARRAY['confirme','embarque','termine'])
  ), 0) - COALESCE(cc_agg.total_charges, 0)     AS solde_ticket,

  -- Numéros de sièges vendus
  array_agg(DISTINCT unnested_seat.unnested_seat ORDER BY unnested_seat.unnested_seat)
    FILTER (
      WHERE res.status = ANY (ARRAY['confirme','embarque','termine'])
        AND unnested_seat.unnested_seat IS NOT NULL
    )                                           AS sold_seat_numbers

FROM schedules sch
LEFT JOIN departure_sequence  ds        ON ds.schedule_id   = sch.id
LEFT JOIN counters             cnt       ON cnt.id           = ds.counter_id
LEFT JOIN stations             st_dep   ON st_dep.id        = sch.departure_station_id
LEFT JOIN routes               rte      ON rte.id           = sch.route_id
LEFT JOIN cities               city_orig ON city_orig.id    = rte.origin_city_id
LEFT JOIN cities               city_dest ON city_dest.id    = rte.destination_city_id
LEFT JOIN buses                bus      ON bus.id           = sch.bus_id
LEFT JOIN users                drv      ON drv.id           = sch.driver_id
LEFT JOIN reservations         res      ON res.schedule_id  = sch.id
LEFT JOIN LATERAL unnest(res.seat_numbers) unnested_seat(unnested_seat) ON true

-- Charges pré-agrégées par schedule, statut != rejete
LEFT JOIN (
  SELECT
    schedule_id,
    SUM(amount)                                           AS total_charges,
    SUM(amount) FILTER (WHERE charge_type = 'ration')               AS total_rations,
    SUM(amount) FILTER (WHERE charge_type = 'carburant_complement')  AS total_carburant,
    SUM(amount) FILTER (WHERE charge_type = 'peage')                AS total_peages
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
  cc_agg.total_charges, cc_agg.total_rations, cc_agg.total_carburant, cc_agg.total_peages;
