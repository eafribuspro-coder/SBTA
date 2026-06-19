/*
  # Module RH — Partie 1.4 : Politiques RLS pour le module RH

  ## Résumé
  Ajoute les politiques Row Level Security spécifiques au rôle `rh` et
  met à jour les accès du `gestionnaire` pour respecter la nouvelle
  architecture organisationnelle (personnel rattaché aux sociétés).

  ## Nouvelles politiques

  ### Table users
  - `rh_select_all_personnel`  — Le RH voit tout le personnel (hors clients)
  - `rh_insert_personnel`      — Le RH peut créer des employés (hors admin/daf/client)
  - `rh_update_personnel`      — Le RH peut modifier les employés
  - `gestionnaire_select_company_staff` — Gestionnaire voit le personnel de SA société

  ## Notes
  - Les politiques existantes (admin, own) restent inchangées
  - get_my_role() est la fonction SECURITY DEFINER existante
  - Les nouvelles politiques sont complémentaires aux politiques existantes
  - Les UPDATE avec WITH CHECK utilisent NEW implicitement via la syntaxe RLS standard
*/

-- RH peut lire tout le personnel (hors clients)
DROP POLICY IF EXISTS "rh_select_all_personnel" ON users;
CREATE POLICY "rh_select_all_personnel" ON users
  FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'rh'
    AND role != 'client'
  );

-- RH peut créer des employés (hors admin, daf, client)
DROP POLICY IF EXISTS "rh_insert_personnel" ON users;
CREATE POLICY "rh_insert_personnel" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() IN ('rh', 'admin')
    AND role NOT IN ('admin', 'daf', 'client')
  );

-- RH peut modifier les employés (hors admin et daf)
DROP POLICY IF EXISTS "rh_update_personnel" ON users;
CREATE POLICY "rh_update_personnel" ON users
  FOR UPDATE
  TO authenticated
  USING (
    get_my_role() = 'rh'
    AND role NOT IN ('admin', 'daf', 'client')
  )
  WITH CHECK (
    get_my_role() = 'rh'
    AND role NOT IN ('admin', 'daf', 'client')
  );

-- Gestionnaire voit uniquement les employés de SA société
DROP POLICY IF EXISTS "gestionnaire_select_company_staff" ON users;
CREATE POLICY "gestionnaire_select_company_staff" ON users
  FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'gestionnaire'
    AND role != 'client'
    AND company_id = (
      SELECT u.company_id FROM users u WHERE u.id = auth.uid()
    )
  );
