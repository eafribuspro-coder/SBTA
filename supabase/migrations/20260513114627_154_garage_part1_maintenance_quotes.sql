/*
  # PARTIE 1 — Migration 1.4
  Table maintenance_quotes (devis de réparation)

  ## Description
  Un devis est créé par le chef d'un garage pour la réparation d'un bus.
  Le bus appartient à une société (bus_company_id déduit de buses.company_id).
  Le devis est soumis au comptable de cette société pour validation.
  Après validation, un OT est automatiquement créé (trigger 1.6).

  ## Workflow statuts
  brouillon → soumis_comptable → valide / rejete → converti_en_ot / annule

  ## Colonnes notables
  - quote_number : généré automatiquement (trigger 1.5)
  - bus_company_id : société propriétaire du bus (snapshot)
  - parts_items : JSONB [{part_name, qty, unit_price, total, from_stock, available}]
  - photos_urls : tableau de texte
*/

CREATE TABLE IF NOT EXISTS maintenance_quotes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number          varchar(50) UNIQUE,

  garage_id             uuid REFERENCES garages(id) NOT NULL,

  bus_id                uuid REFERENCES buses(id) NOT NULL,
  bus_registration      varchar(50),
  bus_company_id        uuid REFERENCES companies(id),

  breakdown_report_id   uuid REFERENCES breakdown_reports(id),
  diagnostic_id         uuid REFERENCES maintenance_diagnostics(id),

  created_by            uuid REFERENCES users(id) NOT NULL,

  maintenance_type      text NOT NULL DEFAULT 'corrective'
                        CHECK (maintenance_type IN ('preventive','corrective','urgence')),
  urgency_level         text DEFAULT 'normale'
                        CHECK (urgency_level IN ('faible','normale','elevee','critique')),

  title                 varchar(255) NOT NULL,
  problem_description   text NOT NULL,
  proposed_solution     text,

  labor_hours           decimal(5,2)  DEFAULT 0,
  labor_hourly_rate     decimal(10,2) DEFAULT 0,
  labor_cost            decimal(15,2) DEFAULT 0,
  parts_items           jsonb NOT NULL DEFAULT '[]',
  parts_cost            decimal(15,2) DEFAULT 0,
  total_estimated_cost  decimal(15,2) DEFAULT 0,

  observations          text,
  photos_urls           text[],
  mileage               int,

  status                text DEFAULT 'brouillon'
                        CHECK (status IN (
                          'brouillon',
                          'soumis_comptable',
                          'valide',
                          'rejete',
                          'converti_en_ot',
                          'annule'
                        )),

  submitted_at          timestamptz,
  submitted_to          uuid REFERENCES users(id),
  validated_by          uuid REFERENCES users(id),
  validated_at          timestamptz,
  rejection_reason      text,

  work_order_id         uuid REFERENCES maintenance_work_orders(id),

  planned_start_date    date,
  estimated_duration_days int,

  updated_by            uuid REFERENCES users(id),
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_garage      ON maintenance_quotes(garage_id);
CREATE INDEX IF NOT EXISTS idx_quotes_bus         ON maintenance_quotes(bus_id);
CREATE INDEX IF NOT EXISTS idx_quotes_bus_company ON maintenance_quotes(bus_company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status      ON maintenance_quotes(status);

ALTER TABLE maintenance_quotes ENABLE ROW LEVEL SECURITY;
