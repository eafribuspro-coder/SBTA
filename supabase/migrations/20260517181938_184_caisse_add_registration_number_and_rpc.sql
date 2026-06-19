/*
  # Caisse comptable — correction schéma et RPC de synthèse

  ## Changements

  ### 1. Colonne registration_number manquante
  La table comptable_caisse_entries n'avait pas la colonne registration_number
  utilisée par le frontend. On l'ajoute en nullable.

  ### 2. RPC get_comptable_caisse_summary
  Nouvelle fonction qui agrège les vraies données de la période :
  - Entrées manuelles (comptable_caisse_entries type='entree')
  - Recettes guichet (reservations confirmees/utilisees)
  - Dépenses manuelles (comptable_caisse_entries type='depense')
  - Charges guichet (counter_charges validées)
  - Dépenses véhicules (vehicle_expenses)

  Retourne une liste unifiée de mouvements avec :
  source, entry_type, entry_date, label, amount, registration_number

  ### 3. RPC get_comptable_caisse_kpis
  Retourne les totaux agrégés pour la période.
*/

-- ── 1. Ajouter colonne manquante ──────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comptable_caisse_entries' AND column_name = 'registration_number'
  ) THEN
    ALTER TABLE comptable_caisse_entries ADD COLUMN registration_number text;
  END IF;
END $$;


-- ── 2. RPC flux unifiés de caisse ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_comptable_caisse_flux(
  p_company_id uuid,
  p_date_from  date,
  p_date_to    date
)
RETURNS TABLE(
  id                  uuid,
  source              text,
  entry_type          text,
  entry_date          date,
  label               text,
  amount              numeric,
  registration_number text,
  notes               text,
  deletable           boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY

  -- Entrées/dépenses manuelles comptable
  SELECT
    ce.id,
    'manuel'::text         AS source,
    ce.entry_type,
    ce.entry_date,
    ce.label,
    ce.amount,
    ce.registration_number,
    ce.notes,
    true                   AS deletable
  FROM comptable_caisse_entries ce
  WHERE ce.company_id = p_company_id
    AND ce.entry_date BETWEEN p_date_from AND p_date_to

  UNION ALL

  -- Recettes guichet (reservations confirmées/utilisées)
  SELECT
    r.id,
    'guichet'::text        AS source,
    'entree'::text         AS entry_type,
    s.departure_datetime::date AS entry_date,
    'Recette guichet — ' || COALESCE(rt.name, 'Ligne') AS label,
    r.total_price          AS amount,
    b.registration_number,
    NULL::text             AS notes,
    false                  AS deletable
  FROM reservations r
  JOIN schedules s  ON s.id  = r.schedule_id
  JOIN buses b      ON b.id  = s.bus_id AND b.company_id = p_company_id
  LEFT JOIN routes rt ON rt.id = s.route_id
  WHERE r.status IN ('confirmee', 'utilisee')
    AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to

  UNION ALL

  -- Charges guichet (counter_charges)
  SELECT
    cc.id,
    'guichet'::text        AS source,
    'depense'::text        AS entry_type,
    cc.charge_date         AS entry_date,
    CASE cc.charge_type
      WHEN 'carburant_complement' THEN 'Complément carburant'
      WHEN 'ration'               THEN 'Ration chauffeur'
      WHEN 'peage'                THEN 'Péage'
      ELSE COALESCE(cc.description, cc.charge_type)
    END                    AS label,
    cc.amount,
    b.registration_number,
    cc.description         AS notes,
    false                  AS deletable
  FROM counter_charges cc
  JOIN buses b ON b.id = cc.bus_id AND b.company_id = p_company_id
  WHERE cc.charge_date BETWEEN p_date_from AND p_date_to

  UNION ALL

  -- Dépenses véhicules (vehicle_expenses, source comptable ou charge_achat)
  SELECT
    ve.id,
    'depense_vehicule'::text AS source,
    'depense'::text          AS entry_type,
    ve.expense_date          AS entry_date,
    COALESCE(ve.description, 'Dépense véhicule') AS label,
    ve.amount,
    ve.registration_number,
    ve.notes,
    false                    AS deletable
  FROM vehicle_expenses ve
  WHERE ve.company_id = p_company_id
    AND ve.expense_date BETWEEN p_date_from AND p_date_to

  ORDER BY entry_date DESC, entry_type;
END;
$function$;


-- ── 3. RPC KPIs caisse ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_comptable_caisse_kpis(
  p_company_id uuid,
  p_date_from  date,
  p_date_to    date
)
RETURNS TABLE(
  total_entrees  numeric,
  total_depenses numeric,
  solde          numeric,
  nb_entrees     bigint,
  nb_depenses    bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH flux AS (
    SELECT f.entry_type, f.amount
    FROM get_comptable_caisse_flux(p_company_id, p_date_from, p_date_to) f
  )
  SELECT
    COALESCE(SUM(CASE WHEN entry_type = 'entree'  THEN amount ELSE 0 END), 0) AS total_entrees,
    COALESCE(SUM(CASE WHEN entry_type = 'depense' THEN amount ELSE 0 END), 0) AS total_depenses,
    COALESCE(SUM(CASE WHEN entry_type = 'entree'  THEN amount ELSE -amount END), 0) AS solde,
    COUNT(CASE WHEN entry_type = 'entree'  THEN 1 END)                       AS nb_entrees,
    COUNT(CASE WHEN entry_type = 'depense' THEN 1 END)                       AS nb_depenses
  FROM flux;
END;
$function$;
