/*
  # Module RH — Partie 1.1 : Modification de la table users

  ## Résumé
  Migration fondamentale qui étend la table `users` pour supporter le module
  Ressources Humaines. Ajoute le rôle `rh` dans la contrainte de rôle et
  introduit toutes les colonnes nécessaires à la gestion du personnel.

  ## Changements

  ### Contrainte rôle
  - Supprime et recrée `users_role_check` en ajoutant la valeur `'rh'`

  ### Nouvelles colonnes
  - `gender` : Sexe de l'employé (M / F)
  - `cnps_number` : Numéro CNPS (optionnel)
  - `children_count` : Nombre d'enfants à charge (défaut 0)
  - `marital_status` : Situation matrimoniale (celibataire / marie / divorce / veuf)
  - `hire_date` : Date d'entrée dans la société
  - `salary` : Salaire mensuel en FCFA
  - `contract_type` : Type de contrat (titulaire / contractuel)
  - `contract_url` : URL du contrat dans Supabase Storage
  - `bus_id` : Bus affecté (chauffeurs uniquement) — FK vers buses
  - `station_id` : Gare d'affectation — FK vers stations
  - `deactivated_at` : Horodatage de désactivation du compte
  - `deactivated_by` : UUID de l'utilisateur ayant désactivé le compte
  - `deactivation_reason` : Motif de désactivation

  ### Index créés
  - `idx_users_company_id`, `idx_users_role`, `idx_users_station_id`
  - `idx_users_contract_type`, `idx_users_hire_date`

  ## Notes
  - Toutes les colonnes sont ajoutées avec IF NOT EXISTS (safe to replay)
  - Les FK vers buses et stations sont optionnelles (nullable)
  - company_id reste nullable (NULL = personnel holding)
*/

-- 1. Mettre à jour la contrainte rôle pour inclure 'rh'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'admin','daf','comptable','rh','gestionnaire',
    'chauffeur','guichetier','chef_garage','mecanicien',
    'planificateur','pompiste','chef_gare','client'
  ));

-- 2. Ajouter les colonnes RH (toutes nullable, safe à rejouer)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='gender') THEN
    ALTER TABLE users ADD COLUMN gender text CHECK (gender IN ('M','F')) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='cnps_number') THEN
    ALTER TABLE users ADD COLUMN cnps_number varchar(50) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='children_count') THEN
    ALTER TABLE users ADD COLUMN children_count int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='marital_status') THEN
    ALTER TABLE users ADD COLUMN marital_status text CHECK (marital_status IN ('celibataire','marie','divorce','veuf')) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='hire_date') THEN
    ALTER TABLE users ADD COLUMN hire_date date DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='salary') THEN
    ALTER TABLE users ADD COLUMN salary decimal(15,2) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='contract_type') THEN
    ALTER TABLE users ADD COLUMN contract_type text CHECK (contract_type IN ('titulaire','contractuel')) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='contract_url') THEN
    ALTER TABLE users ADD COLUMN contract_url text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='bus_id') THEN
    ALTER TABLE users ADD COLUMN bus_id uuid REFERENCES buses(id) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='station_id') THEN
    ALTER TABLE users ADD COLUMN station_id uuid REFERENCES stations(id) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='deactivated_at') THEN
    ALTER TABLE users ADD COLUMN deactivated_at timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='deactivated_by') THEN
    ALTER TABLE users ADD COLUMN deactivated_by uuid REFERENCES users(id) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='deactivation_reason') THEN
    ALTER TABLE users ADD COLUMN deactivation_reason text DEFAULT NULL;
  END IF;
END $$;

-- 3. Index pour les requêtes RH fréquentes
CREATE INDEX IF NOT EXISTS idx_users_company_id    ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_role           ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_station_id     ON users(station_id);
CREATE INDEX IF NOT EXISTS idx_users_contract_type  ON users(contract_type);
CREATE INDEX IF NOT EXISTS idx_users_hire_date      ON users(hire_date);
