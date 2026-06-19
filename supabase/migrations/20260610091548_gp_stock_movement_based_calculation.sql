
-- Expand item_type check to include UI types
ALTER TABLE gp_stock_articles DROP CONSTRAINT IF EXISTS gp_stock_articles_item_type_check;
ALTER TABLE gp_stock_articles ADD CONSTRAINT gp_stock_articles_item_type_check 
  CHECK (item_type IN ('piece', 'pneu', 'fourniture', 'lubrifiant', 'filtre', 'accessoire', 'autre'));

-- RPC: Get articles with computed stock from movements
CREATE OR REPLACE FUNCTION gp_get_articles_with_computed_stock()
RETURNS TABLE (
  id uuid,
  item_type text,
  designation text,
  brand text,
  reference text,
  category text,
  quantity_in_stock integer,
  computed_stock bigint,
  total_entries bigint,
  total_exits bigint,
  unit_price numeric,
  last_entry_price numeric,
  alert_threshold integer,
  supplier text,
  observation text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 
    a.id,
    a.item_type,
    a.designation,
    a.brand,
    a.reference,
    a.category,
    a.quantity_in_stock,
    COALESCE(en.total_in, 0) - COALESCE(ex.total_out, 0) AS computed_stock,
    COALESCE(en.total_in, 0) AS total_entries,
    COALESCE(ex.total_out, 0) AS total_exits,
    a.unit_price,
    COALESCE(en.last_price, a.unit_price) AS last_entry_price,
    a.alert_threshold,
    a.supplier,
    a.observation,
    a.is_active,
    a.created_at,
    a.updated_at
  FROM gp_stock_articles a
  LEFT JOIN LATERAL (
    SELECT 
      SUM(e.quantity)::bigint AS total_in,
      (SELECT e2.unit_price FROM gp_stock_entries e2 WHERE e2.article_id = a.id ORDER BY e2.entry_date DESC, e2.created_at DESC LIMIT 1) AS last_price
    FROM gp_stock_entries e WHERE e.article_id = a.id
  ) en ON true
  LEFT JOIN LATERAL (
    SELECT SUM(x.quantity)::bigint AS total_out
    FROM gp_stock_exits x WHERE x.article_id = a.id
  ) ex ON true
  WHERE a.is_active = true
  ORDER BY a.designation;
$$;

-- RPC: Dashboard KPIs from movements
CREATE OR REPLACE FUNCTION gp_stock_dashboard_kpis()
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result json;
  month_start date := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  SELECT json_build_object(
    'total_articles', (SELECT count(*) FROM gp_stock_articles WHERE is_active),
    'total_stock', COALESCE((
      SELECT SUM(COALESCE(en_total, 0) - COALESCE(ex_total, 0))
      FROM gp_stock_articles a
      LEFT JOIN LATERAL (SELECT SUM(quantity) AS en_total FROM gp_stock_entries WHERE article_id = a.id) e ON true
      LEFT JOIN LATERAL (SELECT SUM(quantity) AS ex_total FROM gp_stock_exits WHERE article_id = a.id) x ON true
      WHERE a.is_active
    ), 0),
    'stock_value', COALESCE((
      SELECT SUM((COALESCE(en_total, 0) - COALESCE(ex_total, 0)) * a.unit_price)
      FROM gp_stock_articles a
      LEFT JOIN LATERAL (SELECT SUM(quantity) AS en_total FROM gp_stock_entries WHERE article_id = a.id) e ON true
      LEFT JOIN LATERAL (SELECT SUM(quantity) AS ex_total FROM gp_stock_exits WHERE article_id = a.id) x ON true
      WHERE a.is_active
    ), 0),
    'entries_month_count', COALESCE((SELECT SUM(quantity) FROM gp_stock_entries WHERE entry_date >= month_start), 0),
    'entries_month_value', COALESCE((SELECT SUM(total_amount) FROM gp_stock_entries WHERE entry_date >= month_start), 0),
    'exits_month_count', COALESCE((SELECT SUM(quantity) FROM gp_stock_exits WHERE exit_date >= month_start), 0),
    'exits_month_value', COALESCE((SELECT SUM(total_amount) FROM gp_stock_exits WHERE exit_date >= month_start), 0),
    'low_stock_count', (
      SELECT count(*) FROM gp_stock_articles a
      LEFT JOIN LATERAL (SELECT COALESCE(SUM(quantity), 0) AS t FROM gp_stock_entries WHERE article_id = a.id) e ON true
      LEFT JOIN LATERAL (SELECT COALESCE(SUM(quantity), 0) AS t FROM gp_stock_exits WHERE article_id = a.id) x ON true
      WHERE a.is_active AND (e.t - x.t) <= a.alert_threshold
    ),
    'out_of_stock_count', (
      SELECT count(*) FROM gp_stock_articles a
      LEFT JOIN LATERAL (SELECT COALESCE(SUM(quantity), 0) AS t FROM gp_stock_entries WHERE article_id = a.id) e ON true
      LEFT JOIN LATERAL (SELECT COALESCE(SUM(quantity), 0) AS t FROM gp_stock_exits WHERE article_id = a.id) x ON true
      WHERE a.is_active AND (e.t - x.t) <= 0
    )
  ) INTO result;
  RETURN result;
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
