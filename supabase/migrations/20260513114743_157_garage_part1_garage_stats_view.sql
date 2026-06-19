/*
  # PARTIE 1 — Migration 1.7
  Vue garage_stats : statistiques par garage, multi-société.

  ## Description
  Vue agrégée par garage incluant :
  - Infos de base (nom, code, type, ville, statut)
  - Chef de garage
  - Gare associée
  - Effectif actif (garage_staff)
  - Bus actuellement en garage (toutes sociétés)
  - Nombre de sociétés distinctes servies
  - Devis en attente de validation comptable
  - OT en cours
  - Coûts du mois et total

  ## Adaptation au schéma existant
  - maintenance_work_orders : status in ('pending','in_progress','completed')
    (pas 'approuve_chef','en_cours_reparation','termine')
  - maintenance_work_orders.actual_cost (pas actual_total_cost)
  - maintenance_work_orders.completed_at (pas end_date)
  - buses.status : valeurs existantes
*/

CREATE OR REPLACE VIEW garage_stats AS
SELECT
  g.id,
  g.name,
  g.code,
  g.garage_type,
  g.city,
  g.region,
  g.status,
  g.max_vehicles,
  g.phone,
  g.email,
  g.station_id,
  g.chef_garage_id,
  g.parent_garage_id,

  -- Responsable
  u.first_name || ' ' || u.last_name       AS chef_name,

  -- Gare associée
  s.name                                   AS station_name,

  -- Équipe active
  COUNT(DISTINCT gs.user_id)
    FILTER (WHERE gs.is_active = true)     AS staff_count,

  -- Bus actuellement au garage (toutes sociétés)
  COUNT(DISTINCT b.id)
    FILTER (
      WHERE b.current_garage_id = g.id
      AND b.status IN (
        'panne_route','reception_garage',
        'diagnostic','attente_ot',
        'maintenance','controle_qualite'
      )
    )                                      AS buses_in_garage,

  -- Sociétés distinctes dont des bus sont au garage
  COUNT(DISTINCT b.company_id)
    FILTER (
      WHERE b.current_garage_id = g.id
      AND b.status NOT IN ('disponible','en_service','hors_service')
    )                                      AS companies_served,

  -- Devis en attente de validation comptable
  COUNT(DISTINCT mq.id)
    FILTER (WHERE mq.status = 'soumis_comptable') AS quotes_pending,

  -- OT en cours
  COUNT(DISTINCT mwo.id)
    FILTER (WHERE mwo.status IN ('pending','in_progress'))
                                           AS ots_in_progress,

  -- Coûts ce mois-ci (OT terminés)
  COALESCE(SUM(mwo.actual_cost)
    FILTER (
      WHERE mwo.status = 'completed'
      AND date_trunc('month', mwo.completed_at) = date_trunc('month', now())
    ), 0)                                  AS cost_this_month,

  -- Coûts totaux (OT terminés)
  COALESCE(SUM(mwo.actual_cost)
    FILTER (WHERE mwo.status = 'completed'), 0)
                                           AS cost_total

FROM garages g
LEFT JOIN users u        ON u.id = g.chef_garage_id
LEFT JOIN stations s     ON s.id = g.station_id
LEFT JOIN garage_staff gs ON gs.garage_id = g.id
LEFT JOIN buses b        ON b.current_garage_id = g.id
LEFT JOIN maintenance_quotes mq      ON mq.garage_id = g.id
LEFT JOIN maintenance_work_orders mwo ON mwo.garage_id = g.id

WHERE g.status != 'archive'

GROUP BY
  g.id, g.name, g.code, g.garage_type, g.city, g.region,
  g.status, g.max_vehicles, g.phone, g.email,
  g.station_id, g.chef_garage_id, g.parent_garage_id,
  u.first_name, u.last_name, s.name;
