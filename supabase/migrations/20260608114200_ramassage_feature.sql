/*
  Ramassage (pickup) feature:
  1. Add is_ramassage flag to schedules
  2. Create ramassage_collections table for recording collected amounts
  3. RLS policies
  4. Update schedule_receipt_summary view to include ramassage
  5. Update schedule_company_revenue to include ramassage
*/

-- 1. Add is_ramassage column to schedules
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS is_ramassage boolean NOT NULL DEFAULT false;

-- 2. Create ramassage_collections table
CREATE TABLE IF NOT EXISTS ramassage_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  station_id uuid NOT NULL REFERENCES stations(id),
  collected_by uuid REFERENCES auth.users(id),
  observation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ramassage_collections_schedule_station_unique UNIQUE (schedule_id, station_id)
);

ALTER TABLE ramassage_collections ENABLE ROW LEVEL SECURITY;

-- RLS: any authenticated can read
CREATE POLICY "select_ramassage_collections"
  ON ramassage_collections FOR SELECT
  TO authenticated USING (true);

-- RLS: chef_gare can insert for their station
CREATE POLICY "insert_ramassage_collections"
  ON ramassage_collections FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM stations st
      WHERE st.id = ramassage_collections.station_id
        AND st.station_manager_id = auth.uid()
    )
  );

-- RLS: chef_gare can update for their station
CREATE POLICY "update_ramassage_collections"
  ON ramassage_collections FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM stations st
      WHERE st.id = ramassage_collections.station_id
        AND st.station_manager_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM stations st
      WHERE st.id = ramassage_collections.station_id
        AND st.station_manager_id = auth.uid()
    )
  );

-- RLS: chef_gare can delete for their station
CREATE POLICY "delete_ramassage_collections"
  ON ramassage_collections FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM stations st
      WHERE st.id = ramassage_collections.station_id
        AND st.station_manager_id = auth.uid()
    )
  );

-- 3. Recreate schedule_receipt_summary with ramassage support
DROP VIEW IF EXISTS daily_counter_report;
DROP VIEW IF EXISTS schedule_receipt_summary;
DROP VIEW IF EXISTS breakdown_revenue_distributions;

CREATE VIEW schedule_receipt_summary AS
SELECT
  sch.id                                        AS schedule_id,
  sch.departure_datetime,
  sch.arrival_datetime,
  sch.status,
  sch.is_ramassage,
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
  COALESCE(ram_agg.ramassage_amount, 0)::numeric AS ramassage_amount,

  CASE WHEN sch.status = 'convoi'
    THEN COALESCE(cv.amount, 0) + COALESCE(ram_agg.ramassage_amount, 0)
         - COALESCE(cc_agg.total_charges, 0)
    ELSE COALESCE(res_agg.total_ticket_amount, 0) + COALESCE(ram_agg.ramassage_amount, 0)
      - COALESCE(cc_agg.total_charges, 0)
  END
  - CASE
      WHEN sb.status = 'cloture'
       AND sb.beneficiary_company_id IS NOT NULL
       AND sb.beneficiary_company_id <> sb.original_company_id
      THEN COALESCE(sb.amount_replacement_company, 0)
      ELSE 0
    END                                         AS solde_ticket,

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

  CASE
    WHEN sb.status = 'cloture'
     AND sb.beneficiary_company_id IS NOT NULL
     AND sb.beneficiary_company_id <> sb.original_company_id
     AND COALESCE(sb.charges_total_beneficiary, 0) > 0
    THEN true ELSE false
  END                                           AS has_charge_distribution,
  COALESCE(sb.charges_ration_original, 0)       AS charge_dist_ration_original,
  COALESCE(sb.charges_ration_beneficiary, 0)    AS charge_dist_ration_beneficiary,
  COALESCE(sb.charges_carburant_original, 0)    AS charge_dist_carburant_original,
  COALESCE(sb.charges_carburant_beneficiary, 0) AS charge_dist_carburant_beneficiary,
  COALESCE(sb.charges_peage_original, 0)        AS charge_dist_peage_original,
  COALESCE(sb.charges_peage_beneficiary, 0)     AS charge_dist_peage_beneficiary,
  COALESCE(sb.charges_autres_original, 0)       AS charge_dist_autres_original,
  COALESCE(sb.charges_autres_beneficiary, 0)    AS charge_dist_autres_beneficiary,
  COALESCE(sb.charges_total_original, 0)        AS charge_dist_total_original,
  COALESCE(sb.charges_total_beneficiary, 0)     AS charge_dist_total_beneficiary,

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
  SELECT schedule_id,
    SUM(total_seats)  AS seats_sold,
    SUM(total_price)  AS total_ticket_amount,
    SUM(baggage_fee)  AS total_baggage
  FROM reservations
  WHERE status = ANY (ARRAY['confirmee','confirme','embarque','termine'])
  GROUP BY schedule_id
) res_agg ON res_agg.schedule_id = sch.id

LEFT JOIN (
  SELECT r.schedule_id,
    array_agg(DISTINCT s_num ORDER BY s_num)
      FILTER (WHERE s_num IS NOT NULL)  AS sold_seat_numbers
  FROM reservations r
  LEFT JOIN LATERAL unnest(r.seat_numbers) s_num ON true
  WHERE r.status = ANY (ARRAY['confirmee','confirme','embarque','termine'])
  GROUP BY r.schedule_id
) seat_agg ON seat_agg.schedule_id = sch.id

LEFT JOIN (
  SELECT schedule_id,
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

LEFT JOIN (
  SELECT schedule_id,
    SUM(amount) AS ramassage_amount
  FROM ramassage_collections
  GROUP BY schedule_id
) ram_agg ON ram_agg.schedule_id = sch.id

LEFT JOIN LATERAL (
  SELECT id, status, beneficiary_company_id, original_company_id,
         amount_replacement_company, split_reason, replacement_at, replaced_by,
         charges_ration_original, charges_ration_beneficiary,
         charges_carburant_original, charges_carburant_beneficiary,
         charges_peage_original, charges_peage_beneficiary,
         charges_autres_original, charges_autres_beneficiary,
         charges_total_original, charges_total_beneficiary
  FROM schedule_breakdowns
  WHERE schedule_id = sch.id
  ORDER BY breakdown_at DESC
  LIMIT 1
) sb ON true;

-- Recreate daily_counter_report
CREATE VIEW daily_counter_report AS
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
  COALESCE(SUM(srs.ramassage_amount),   0)                AS total_ramassage,
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
      'ramassage_amount',    srs.ramassage_amount,
      'is_ramassage',        srs.is_ramassage,
      'breakdown_transfer',  srs.breakdown_transfer,
      'breakdown_beneficiary_id', srs.breakdown_beneficiary_id,
      'has_charge_distribution', srs.has_charge_distribution,
      'charge_dist_total_original', srs.charge_dist_total_original,
      'charge_dist_total_beneficiary', srs.charge_dist_total_beneficiary,
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

-- Recreate breakdown_revenue_distributions
CREATE VIEW breakdown_revenue_distributions AS
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
  CASE WHEN COALESCE(sb.charges_total_beneficiary, 0) > 0 THEN true ELSE false END
                                       AS has_charge_distribution,
  COALESCE(sb.charges_ration_original, 0)    AS charges_ration_original,
  COALESCE(sb.charges_ration_beneficiary, 0) AS charges_ration_beneficiary,
  COALESCE(sb.charges_carburant_original, 0) AS charges_carburant_original,
  COALESCE(sb.charges_carburant_beneficiary, 0) AS charges_carburant_beneficiary,
  COALESCE(sb.charges_peage_original, 0)     AS charges_peage_original,
  COALESCE(sb.charges_peage_beneficiary, 0)  AS charges_peage_beneficiary,
  COALESCE(sb.charges_autres_original, 0)    AS charges_autres_original,
  COALESCE(sb.charges_autres_beneficiary, 0) AS charges_autres_beneficiary,
  COALESCE(sb.charges_total_original, 0)     AS charges_total_original,
  COALESCE(sb.charges_total_beneficiary, 0)  AS charges_total_beneficiary,
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

-- 4. Update schedule_company_revenue to include ramassage in gross revenue
CREATE OR REPLACE FUNCTION public.schedule_company_revenue(
  p_from date, p_to date
)
RETURNS TABLE (
  schedule_id        uuid,
  schedule_date      date,
  bus_id             uuid,
  driver_id          uuid,
  route_id           uuid,
  station_id         uuid,
  company_id         uuid,
  revenue            numeric,
  gross_revenue      numeric,
  transferred_amount numeric,
  is_beneficiary     boolean,
  breakdown_id       uuid,
  breakdown_status   text,
  split_reason       text,
  replacement_at     timestamptz
)
LANGUAGE sql STABLE
SET search_path = public
AS $fn$
WITH gross AS (
  SELECT
    s.id                          AS sid,
    s.departure_datetime::date    AS sdate,
    s.bus_id                      AS g_bus_id,
    s.driver_id                   AS g_driver_id,
    s.route_id                    AS g_route_id,
    s.departure_station_id        AS g_station_id,
    CASE WHEN s.status = 'convoi'
         THEN COALESCE(cv.amount, 0)
         ELSE COALESCE(SUM(r.total_price), 0)
    END
    + COALESCE(ram.ramassage_total, 0)  AS gross_rev
  FROM schedules s
  LEFT JOIN reservations r
    ON r.schedule_id = s.id
   AND r.status IN ('confirmee','utilisee')
  LEFT JOIN convoys cv
    ON cv.schedule_id = s.id
  LEFT JOIN (
    SELECT schedule_id, SUM(amount) AS ramassage_total
    FROM ramassage_collections
    GROUP BY schedule_id
  ) ram ON ram.schedule_id = s.id
  WHERE s.departure_datetime::date BETWEEN p_from AND p_to
  GROUP BY s.id, s.departure_datetime, s.bus_id, s.driver_id,
           s.route_id, s.departure_station_id, s.status, cv.amount, ram.ramassage_total
),
br AS (
  SELECT DISTINCT ON (sb.schedule_id)
    sb.schedule_id,
    sb.id                                  AS bid,
    sb.status                              AS b_status,
    sb.original_company_id,
    sb.beneficiary_company_id,
    sb.original_bus_id,
    sb.replacement_bus_id,
    sb.original_driver_id,
    sb.replacement_driver_id,
    sb.station_id                          AS b_station_id,
    sb.route_id                            AS b_route_id,
    COALESCE(sb.amount_replacement_company, 0) AS amt_benef,
    COALESCE(sb.amount_original_company, 0)    AS amt_orig,
    sb.split_reason,
    sb.replacement_at
  FROM schedule_breakdowns sb
  ORDER BY sb.schedule_id, sb.breakdown_at DESC
)
-- Origin row
SELECT
  g.sid,
  g.sdate,
  COALESCE(br.original_bus_id,    g.g_bus_id)     AS bus_id,
  COALESCE(br.original_driver_id, g.g_driver_id)  AS driver_id,
  COALESCE(br.b_route_id,         g.g_route_id)   AS route_id,
  COALESCE(br.b_station_id,       g.g_station_id) AS station_id,
  COALESCE(br.original_company_id, b.company_id)  AS company_id,
  CASE
    WHEN br.b_status = 'cloture'
     AND br.beneficiary_company_id IS NOT NULL
     AND br.beneficiary_company_id <> br.original_company_id
     AND br.amt_benef > 0
    THEN g.gross_rev - br.amt_benef
    ELSE g.gross_rev
  END                                             AS revenue,
  g.gross_rev                                     AS gross_revenue,
  CASE
    WHEN br.b_status = 'cloture'
     AND br.beneficiary_company_id IS NOT NULL
     AND br.beneficiary_company_id <> br.original_company_id
     AND br.amt_benef > 0
    THEN br.amt_benef
    ELSE 0
  END                                             AS transferred_amount,
  false                                           AS is_beneficiary,
  br.bid                                          AS breakdown_id,
  br.b_status                                     AS breakdown_status,
  br.split_reason                                 AS split_reason,
  br.replacement_at                               AS replacement_at
FROM gross g
LEFT JOIN buses b ON b.id = g.g_bus_id
LEFT JOIN br    ON br.schedule_id = g.sid

UNION ALL

-- Beneficiary row (only for inter-company splits)
SELECT
  g.sid,
  g.sdate,
  COALESCE(br.replacement_bus_id, g.g_bus_id)      AS bus_id,
  COALESCE(br.replacement_driver_id, g.g_driver_id) AS driver_id,
  COALESCE(br.b_route_id, g.g_route_id)            AS route_id,
  COALESCE(br.b_station_id, g.g_station_id)        AS station_id,
  br.beneficiary_company_id                         AS company_id,
  br.amt_benef                                      AS revenue,
  g.gross_rev                                       AS gross_revenue,
  br.amt_benef                                      AS transferred_amount,
  true                                              AS is_beneficiary,
  br.bid                                            AS breakdown_id,
  br.b_status                                       AS breakdown_status,
  br.split_reason                                   AS split_reason,
  br.replacement_at                                 AS replacement_at
FROM gross g
JOIN br ON br.schedule_id = g.sid
WHERE br.b_status = 'cloture'
  AND br.beneficiary_company_id IS NOT NULL
  AND br.beneficiary_company_id <> br.original_company_id
  AND br.amt_benef > 0;
$fn$;

NOTIFY pgrst, 'reload schema';
