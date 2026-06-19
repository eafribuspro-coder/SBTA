/*
  # PARTIE 1 — Migration 1.6
  Trigger : création automatique d'un OT après validation d'un devis.

  ## Comportement
  Quand maintenance_quotes.status passe à 'valide' :
  1. Un OT est inséré dans maintenance_work_orders
  2. Le devis est mis à jour : status = 'converti_en_ot', work_order_id = nouvel OT
  3. Le bus est mis en statut 'maintenance' et affecté au garage

  ## Adaptation au schéma existant de maintenance_work_orders
  Colonnes disponibles : id, work_order_number, bus_id, diagnostic_id,
  assigned_to, work_description, estimated_cost, actual_cost,
  estimated_hours, actual_hours, spare_parts_used, status, priority,
  validated_by, created_by, started_at, completed_at, created_at,
  garage_id (ajouté en 1.3), quote_number (ajouté en 1.3)

  Note : buses.status valeurs existantes : maintenance (pas en_maintenance)
*/

CREATE OR REPLACE FUNCTION create_ot_from_quote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ot_id        uuid;
  v_chef_id      uuid;
  v_wo_number    text;
  v_year         int := EXTRACT(YEAR FROM now())::int;
  v_seq          int;
BEGIN
  -- Déclencher uniquement lors du passage à 'valide'
  IF NEW.status = 'valide' AND (OLD.status IS NULL OR OLD.status != 'valide') THEN

    SELECT chef_garage_id INTO v_chef_id FROM garages WHERE id = NEW.garage_id;

    -- Générer un numéro d'OT unique
    SELECT COALESCE(MAX(
      CASE WHEN work_order_number ~ '^OT-[0-9]{4}-[0-9]+$'
      THEN CAST(SPLIT_PART(work_order_number, '-', 3) AS int)
      ELSE 0 END
    ), 0) + 1
    INTO v_seq
    FROM maintenance_work_orders
    WHERE EXTRACT(YEAR FROM created_at) = v_year;

    v_wo_number := 'OT-' || v_year || '-' || LPAD(v_seq::text, 4, '0');

    INSERT INTO maintenance_work_orders (
      work_order_number,
      bus_id,
      diagnostic_id,
      garage_id,
      quote_number,
      assigned_to,
      work_description,
      estimated_cost,
      estimated_hours,
      spare_parts_used,
      status,
      priority,
      validated_by,
      created_by,
      created_at
    ) VALUES (
      v_wo_number,
      NEW.bus_id,
      NEW.diagnostic_id,
      NEW.garage_id,
      NEW.quote_number,
      v_chef_id,
      COALESCE(NEW.proposed_solution, NEW.problem_description),
      NEW.total_estimated_cost,
      NEW.labor_hours,
      NEW.parts_items,
      'pending',
      CASE NEW.urgency_level
        WHEN 'critique' THEN 'urgent'
        WHEN 'elevee'   THEN 'high'
        WHEN 'normale'  THEN 'medium'
        ELSE 'low'
      END,
      NEW.validated_by,
      NEW.created_by,
      now()
    ) RETURNING id INTO v_ot_id;

    -- Mettre à jour le devis : converti en OT
    UPDATE maintenance_quotes SET
      status        = 'converti_en_ot',
      work_order_id = v_ot_id,
      updated_at    = now()
    WHERE id = NEW.id;

    -- Le bus passe en maintenance et est affecté au garage
    UPDATE buses SET
      status            = 'maintenance',
      current_garage_id = NEW.garage_id,
      updated_at        = now()
    WHERE id = NEW.bus_id;

  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_ot_from_quote ON maintenance_quotes;

CREATE TRIGGER trg_create_ot_from_quote
AFTER UPDATE ON maintenance_quotes
FOR EACH ROW EXECUTE FUNCTION create_ot_from_quote();
