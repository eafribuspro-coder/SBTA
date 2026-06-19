/*
  # PARTIE 1 — Charges guichet, numéros de départ, frais bagages

  ## Nouvelles tables
  - `counter_charges` : charges saisies au guichet par départ (rations, carburant, péages)
  - `departure_sequence` : numérotation séquentielle des départs par guichet/journée

  ## Modifications
  - `reservations` : ajout colonne `baggage_fee`

  ## Nouvelles vues
  - `schedule_receipt_summary` : données complètes pour le bordereau de départ
  - `daily_counter_report` : rapport journalier pour le bordereau des recettes

  ## Sécurité
  - RLS activée sur counter_charges et departure_sequence
  - Policies séparées par rôle (guichetier, comptable, admin/daf/gestionnaire)
*/

-- ─── 1.1 Table counter_charges ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS counter_charges (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  schedule_id       uuid REFERENCES schedules(id) NOT NULL,
  counter_id        uuid REFERENCES counters(id) NOT NULL,
  station_id        uuid REFERENCES stations(id) NOT NULL,
  bus_id            uuid REFERENCES buses(id) NOT NULL,
  charge_date       date NOT NULL DEFAULT CURRENT_DATE,

  charge_type       text CHECK (charge_type IN (
                      'ration',
                      'carburant_complement',
                      'peage'
                    )) NOT NULL,

  description       text,
  amount            decimal(15,2) NOT NULL,

  created_by        uuid REFERENCES users(id) NOT NULL,

  validated_by      uuid REFERENCES users(id),
  validated_at      timestamptz,
  status            text CHECK (status IN ('en_attente','valide','rejete')) DEFAULT 'en_attente',
  rejection_reason  text,
  receipt_url       text,

  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_counter_charges_schedule ON counter_charges(schedule_id);
CREATE INDEX IF NOT EXISTS idx_counter_charges_counter  ON counter_charges(counter_id);
CREATE INDEX IF NOT EXISTS idx_counter_charges_date     ON counter_charges(charge_date);
CREATE INDEX IF NOT EXISTS idx_counter_charges_bus      ON counter_charges(bus_id);

-- ─── 1.2 Table departure_sequence ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS departure_sequence (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counter_id        uuid REFERENCES counters(id) NOT NULL,
  schedule_id       uuid REFERENCES schedules(id) NOT NULL UNIQUE,
  departure_date    date NOT NULL,
  departure_number  int NOT NULL,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (counter_id, departure_date, departure_number)
);

-- Fonction : assigner un numéro de départ à un schedule pour un guichet donné
CREATE OR REPLACE FUNCTION assign_departure_to_counter(
  p_schedule_id  uuid,
  p_counter_id   uuid
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_num  int;
  v_dep_date  date;
BEGIN
  SELECT departure_datetime::date INTO v_dep_date
  FROM schedules WHERE id = p_schedule_id;

  SELECT COALESCE(MAX(departure_number), 0) + 1 INTO v_next_num
  FROM departure_sequence
  WHERE counter_id   = p_counter_id
    AND departure_date = v_dep_date;

  INSERT INTO departure_sequence (counter_id, schedule_id, departure_date, departure_number)
  VALUES (p_counter_id, p_schedule_id, v_dep_date, v_next_num)
  ON CONFLICT (schedule_id) DO NOTHING;

  RETURN v_next_num;
END;
$$;

GRANT EXECUTE ON FUNCTION assign_departure_to_counter(uuid, uuid) TO authenticated;

-- ─── 1.3 Colonne baggage_fee sur reservations ──────────────────────────────────

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS baggage_fee decimal(10,2) DEFAULT 0;

-- ─── 1.4 Vue schedule_receipt_summary ─────────────────────────────────────────

CREATE OR REPLACE VIEW schedule_receipt_summary AS
SELECT
  sch.id                                                          AS schedule_id,
  sch.departure_datetime,
  sch.arrival_datetime,
  sch.status,

  -- Guichet
  ds.counter_id,
  ds.departure_number,
  ds.departure_date,
  cnt.counter_number,

  -- Gare de départ
  st_dep.id                                                       AS station_id,
  st_dep.name                                                     AS station_name,

  -- Itinéraire
  rte.id                                                          AS route_id,
  rte.name                                                        AS route_name,
  rte.base_price,

  -- Villes
  city_orig.name                                                  AS origin_city,
  city_dest.name                                                  AS destination_city,

  -- Bus
  bus.id                                                          AS bus_id,
  bus.registration_number,
  COALESCE(bus.capacity, bus.total_seats, 0)                     AS capacity,

  -- Chauffeur
  COALESCE(drv.first_name || ' ' || drv.last_name, '—')          AS driver_name,

  -- Ventes
  COUNT(res.id) FILTER (WHERE res.status IN ('confirme','embarque','termine'))
                                                                  AS seats_sold,
  COALESCE(bus.capacity, bus.total_seats, 0)
    - COUNT(res.id) FILTER (WHERE res.status IN ('confirme','embarque','termine'))
                                                                  AS seats_remaining,
  COALESCE(SUM(res.total_price) FILTER (WHERE res.status IN ('confirme','embarque','termine')), 0)
                                                                  AS total_ticket_amount,
  COALESCE(SUM(res.baggage_fee) FILTER (WHERE res.status IN ('confirme','embarque','termine')), 0)
                                                                  AS total_baggage,

  -- Charges guichet (non rejetées)
  COALESCE(SUM(cc.amount), 0)                                     AS total_charges,
  COALESCE(SUM(cc.amount) FILTER (WHERE cc.charge_type = 'ration'), 0)
                                                                  AS total_rations,
  COALESCE(SUM(cc.amount) FILTER (WHERE cc.charge_type = 'carburant_complement'), 0)
                                                                  AS total_carburant,
  COALESCE(SUM(cc.amount) FILTER (WHERE cc.charge_type = 'peage'), 0)
                                                                  AS total_peages,

  -- Solde = recettes - charges
  COALESCE(SUM(res.total_price) FILTER (WHERE res.status IN ('confirme','embarque','termine')), 0)
    - COALESCE(SUM(cc.amount), 0)                                 AS solde_ticket,

  -- Sièges vendus (tableau)
  array_agg(DISTINCT unnested_seat ORDER BY unnested_seat)
    FILTER (WHERE res.status IN ('confirme','embarque','termine') AND unnested_seat IS NOT NULL)
                                                                  AS sold_seat_numbers

FROM schedules sch
LEFT JOIN departure_sequence ds  ON ds.schedule_id = sch.id
LEFT JOIN counters cnt            ON cnt.id = ds.counter_id
LEFT JOIN stations st_dep         ON st_dep.id = sch.departure_station_id
LEFT JOIN routes rte              ON rte.id = sch.route_id
LEFT JOIN cities city_orig        ON city_orig.id = rte.origin_city_id
LEFT JOIN cities city_dest        ON city_dest.id = rte.destination_city_id
LEFT JOIN buses bus               ON bus.id = sch.bus_id
LEFT JOIN users drv               ON drv.id = sch.driver_id
LEFT JOIN reservations res        ON res.schedule_id = sch.id
LEFT JOIN LATERAL unnest(res.seat_numbers) AS unnested_seat ON true
LEFT JOIN counter_charges cc      ON cc.schedule_id = sch.id AND cc.status != 'rejete'
GROUP BY
  sch.id, sch.departure_datetime, sch.arrival_datetime, sch.status,
  ds.counter_id, ds.departure_number, ds.departure_date,
  cnt.counter_number,
  st_dep.id, st_dep.name,
  rte.id, rte.name, rte.base_price,
  city_orig.name, city_dest.name,
  bus.id, bus.registration_number, bus.capacity, bus.total_seats,
  drv.first_name, drv.last_name;

-- ─── 1.5 Vue daily_counter_report ─────────────────────────────────────────────

CREATE OR REPLACE VIEW daily_counter_report AS
SELECT
  ds.counter_id,
  ds.departure_date,
  cnt.counter_number,
  st.name                                                         AS station_name,
  rte.name                                                        AS route_name,
  COUNT(DISTINCT ds.schedule_id)                                  AS total_departures,
  COALESCE(SUM(srs.seats_sold), 0)                               AS total_seats_sold,
  COALESCE(SUM(srs.total_ticket_amount), 0)                      AS total_ticket_amount,
  COALESCE(SUM(srs.total_baggage), 0)                            AS total_baggage,
  COALESCE(SUM(srs.total_charges), 0)                            AS total_charges,
  COALESCE(SUM(srs.solde_ticket), 0)                             AS total_solde,
  jsonb_agg(
    jsonb_build_object(
      'schedule_id',       ds.schedule_id,
      'departure_number',  ds.departure_number,
      'registration_number', srs.registration_number,
      'driver_name',       srs.driver_name,
      'seats_sold',        srs.seats_sold,
      'total_ticket',      srs.total_ticket_amount,
      'total_baggage',     srs.total_baggage,
      'total_charges',     srs.total_charges,
      'solde_ticket',      srs.solde_ticket
    )
    ORDER BY ds.departure_number
  )                                                               AS departures_detail
FROM departure_sequence ds
JOIN schedule_receipt_summary srs ON srs.schedule_id = ds.schedule_id
JOIN counters cnt                  ON cnt.id = ds.counter_id
JOIN stations st                   ON st.id = srs.station_id
JOIN routes rte                    ON rte.id = srs.route_id
GROUP BY ds.counter_id, ds.departure_date, cnt.counter_number, st.name, rte.name;

-- ─── 1.6 RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE counter_charges    ENABLE ROW LEVEL SECURITY;
ALTER TABLE departure_sequence ENABLE ROW LEVEL SECURITY;

-- counter_charges : guichetier lit/crée les charges de son guichet
CREATE POLICY "guichetier_select_ses_charges"
  ON counter_charges FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR counter_id IN (SELECT id FROM counters WHERE assigned_user_id = auth.uid())
  );

CREATE POLICY "guichetier_insert_charges"
  ON counter_charges FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND counter_id IN (SELECT id FROM counters WHERE assigned_user_id = auth.uid())
  );

CREATE POLICY "guichetier_update_ses_charges"
  ON counter_charges FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() AND status = 'en_attente')
  WITH CHECK (created_by = auth.uid());

-- Comptable valide les charges
CREATE POLICY "comptable_valide_charges_guichet"
  ON counter_charges FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('comptable','admin'));

-- Admin/DAF/Gestionnaire lisent toutes les charges
CREATE POLICY "manager_lit_charges"
  ON counter_charges FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('admin','daf','comptable','gestionnaire'));

-- departure_sequence : guichetier et managers
CREATE POLICY "guichetier_select_departure_seq"
  ON departure_sequence FOR SELECT
  TO authenticated
  USING (
    counter_id IN (SELECT id FROM counters WHERE assigned_user_id = auth.uid())
    OR get_my_role() IN ('admin','daf','gestionnaire','planificateur','comptable')
  );

CREATE POLICY "guichetier_insert_departure_seq"
  ON departure_sequence FOR INSERT
  TO authenticated
  WITH CHECK (
    counter_id IN (SELECT id FROM counters WHERE assigned_user_id = auth.uid())
    OR get_my_role() IN ('admin','planificateur')
  );
