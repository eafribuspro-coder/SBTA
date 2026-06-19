/*
  # Cascade breakdown revenue split into all financial views

  This migration makes every breakdown revenue redistribution automatically
  visible in Guichet, gestionnaire dashboards, beneficiary company revenue,
  and DAF consolidation.

  1. Schema additions to `schedule_receipt_summary`
     - `breakdown_id`            : id of the closed breakdown (when any)
     - `breakdown_transfer`      : amount transferred to the beneficiary company
     - `breakdown_beneficiary_id`: beneficiary company id
     - `breakdown_split_reason`  : motive of the split
     - `breakdown_split_at`      : timestamp of the replacement decision
     - `breakdown_gestionnaire`  : user that applied the split
     - net revenue (`solde_ticket`) now reflects the split for the original
       voyage: the transferred amount is subtracted from the original company
       revenue when the split is inter-company.

  2. New view `breakdown_revenue_distributions`
     One row per closed inter-company breakdown with all data needed by the
     DAF dedicated screen and PDF/Excel/CSV exports. Joins schedules, routes,
     stations, buses, companies and the audit table for the gestionnaire.

  3. New view `breakdown_beneficiary_revenue`
     One row per beneficiary company credit, labelled
     "Recette issue d'une répartition de panne".

  4. Notes
     - Same-company replacements (or no beneficiary set) do not alter the
       original revenue, behaviour unchanged.
     - DAF consolidated total = original_net + beneficiary_credit and equals
       the original gross net before split.
*/

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

  -- Net revenue retained by the ORIGINAL voyage company, after breakdown split
  CASE WHEN sch.status = 'convoi'
    THEN COALESCE(cv.amount, 0) - COALESCE(cc_agg.total_charges, 0)
    ELSE COALESCE(res_agg.total_ticket_amount, 0)
      - COALESCE(cc_agg.total_charges, 0)
  END
  - CASE
      WHEN sb.status = 'cloture'
       AND sb.beneficiary_company_id IS NOT NULL
       AND sb.beneficiary_company_id <> sb.original_company_id
      THEN COALESCE(sb.amount_replacement_company, 0)
      ELSE 0
    END                                         AS solde_ticket,

  -- Breakdown attribution metadata
  sb.id                                         AS breakdown_id,
  CASE
    WHEN sb.status = 'cloture'
     AND sb.beneficiary_company_id IS NOT NULL
     AND sb.beneficiary_company_id <> sb.original_company_id
    THEN COALESCE(sb.amount_replacement_company, 0)
    ELSE 0
  END                                           AS breakdown_transfer,
  sb.beneficiary_company_id                     AS breakdown_beneficiary_id,
  sb.split_reason                               AS breakdown_split_reason,
  sb.replacement_at                             AS breakdown_split_at,
  sb.replaced_by                                AS breakdown_gestionnaire_id,

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

LEFT JOIN convoys cv ON cv.schedule_id = sch.id

LEFT JOIN LATERAL (
  SELECT id, status, beneficiary_company_id, original_company_id,
         amount_replacement_company, split_reason, replacement_at, replaced_by
  FROM schedule_breakdowns
  WHERE schedule_id = sch.id
  ORDER BY breakdown_at DESC
  LIMIT 1
) sb ON true;

-- Recreate daily_counter_report dependent on the view
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
      'breakdown_transfer',  srs.breakdown_transfer,
      'breakdown_beneficiary_id', srs.breakdown_beneficiary_id,
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

-- Dedicated DAF distribution view
CREATE OR REPLACE VIEW breakdown_revenue_distributions AS
SELECT
  sb.id                                AS breakdown_id,
  sb.schedule_id,
  sb.breakdown_at,
  sb.replacement_at,
  sb.status,
  sb.reason                            AS breakdown_reason,
  sb.observations,
  sb.split_reason,

  st.id                                AS station_id,
  st.name                              AS station_name,
  rte.id                               AS route_id,
  rte.name                             AS route_name,
  sch.departure_datetime,

  sb.original_bus_id,
  bus_orig.registration_number         AS original_bus_plate,
  sb.replacement_bus_id,
  bus_repl.registration_number         AS replacement_bus_plate,
  sb.original_driver_id,
  COALESCE(drv_orig.first_name || ' ' || drv_orig.last_name, '—') AS original_driver_name,
  sb.replacement_driver_id,
  COALESCE(drv_repl.first_name || ' ' || drv_repl.last_name, '—') AS replacement_driver_name,

  sb.original_company_id,
  co_orig.name                         AS original_company_name,
  sb.beneficiary_company_id,
  co_benef.name                        AS beneficiary_company_name,
  sb.replacement_company_id,
  co_repl.name                         AS replacement_company_name,

  sb.passengers_count,
  sb.fill_rate,
  sb.revenue_amount,
  COALESCE(sb.charges_amount, 0)       AS charges_amount,
  COALESCE(sb.net_balance, 0)          AS net_balance,
  COALESCE(sb.net_balance_adjusted, sb.net_balance, 0) AS net_balance_adjusted,
  COALESCE(sb.amount_replacement_company, 0) AS amount_to_beneficiary,
  COALESCE(sb.amount_original_company, 0)    AS amount_retained,

  sb.replaced_by                       AS gestionnaire_id,
  COALESCE(u_gest.first_name || ' ' || u_gest.last_name, '—') AS gestionnaire_name

FROM schedule_breakdowns sb
LEFT JOIN schedules  sch       ON sch.id      = sb.schedule_id
LEFT JOIN stations   st        ON st.id       = sb.station_id
LEFT JOIN routes     rte       ON rte.id      = sb.route_id
LEFT JOIN buses      bus_orig  ON bus_orig.id = sb.original_bus_id
LEFT JOIN buses      bus_repl  ON bus_repl.id = sb.replacement_bus_id
LEFT JOIN users      drv_orig  ON drv_orig.id = sb.original_driver_id
LEFT JOIN users      drv_repl  ON drv_repl.id = sb.replacement_driver_id
LEFT JOIN companies  co_orig   ON co_orig.id  = sb.original_company_id
LEFT JOIN companies  co_benef  ON co_benef.id = sb.beneficiary_company_id
LEFT JOIN companies  co_repl   ON co_repl.id  = sb.replacement_company_id
LEFT JOIN users      u_gest    ON u_gest.id   = sb.replaced_by;

-- Beneficiary company revenue attributions (one row per inter-company credit)
CREATE OR REPLACE VIEW breakdown_beneficiary_revenue AS
SELECT
  sb.id                                AS breakdown_id,
  sb.schedule_id,
  sch.departure_datetime,
  sb.station_id,
  sb.route_id,
  sb.original_bus_id,
  sb.replacement_bus_id,
  sb.original_company_id,
  sb.beneficiary_company_id            AS company_id,
  sb.beneficiary_company_id,
  sb.replacement_at                    AS credited_at,
  sb.replaced_by                       AS gestionnaire_id,
  COALESCE(sb.amount_replacement_company, 0) AS amount,
  sb.split_reason                      AS reason,
  'Recette issue d''une répartition de panne'::text AS label,
  sb.status
FROM schedule_breakdowns sb
LEFT JOIN schedules sch ON sch.id = sb.schedule_id
WHERE sb.status = 'cloture'
  AND sb.beneficiary_company_id IS NOT NULL
  AND sb.beneficiary_company_id <> sb.original_company_id
  AND COALESCE(sb.amount_replacement_company, 0) > 0;

NOTIFY pgrst, 'reload schema';
