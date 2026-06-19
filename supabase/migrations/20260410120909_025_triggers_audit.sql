/*
  # Migration 004 — Triggers & Audit

  ## Résumé
  Création des triggers d'automatisation et d'audit pour les tables users et organizations.

  ## Triggers créés
  1. set_users_updated_at — met à jour updated_at avant chaque UPDATE sur users
  2. set_orgs_updated_at — met à jour updated_at avant chaque UPDATE sur organizations
  3. log_user_role_change — enregistre dans activity_logs tout changement de rôle utilisateur
  4. log_user_suspension — enregistre dans activity_logs toute suspension de compte
  5. gen_loyalty_card — génère automatiquement un numéro de carte fidélité pour les nouveaux clients

  ## Séquence
  - loyalty_card_seq : séquence pour générer les numéros de carte fidélité (SBTA-F-XXXXX)

  ## Fonctions
  - trigger_set_updated_at() : met à jour le champ updated_at
  - log_role_change() : SECURITY DEFINER, logue les changements de rôle
  - log_suspension() : SECURITY DEFINER, logue les suspensions de compte
  - generate_loyalty_card() : génère le numéro de carte fidélité si absent

  ## Notes
  - Les triggers log_role_change et log_suspension utilisent SECURITY DEFINER
    pour pouvoir insérer dans activity_logs quel que soit l'utilisateur appelant
  - Les triggers sont créés avec DROP IF EXISTS pour éviter les doublons
*/

-- ============================================================
-- TRIGGER : mise à jour de updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_users_updated_at ON users;
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_orgs_updated_at ON organizations;
CREATE TRIGGER set_orgs_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TRIGGER : log de changement de rôle
-- ============================================================

CREATE OR REPLACE FUNCTION log_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    NEW.role_changed_at = now();
    INSERT INTO activity_logs (user_id, target_id, target_type, action, description, old_values, new_values)
    VALUES (
      auth.uid(),
      NEW.id,
      'user',
      'role_changed',
      'Rôle modifié de ' || OLD.role || ' à ' || NEW.role,
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_user_role_change ON users;
CREATE TRIGGER log_user_role_change
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION log_role_change();

-- ============================================================
-- TRIGGER : log de suspension
-- ============================================================

CREATE OR REPLACE FUNCTION log_suspension()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'suspended' THEN
    NEW.suspended_at = now();
    INSERT INTO activity_logs (user_id, target_id, target_type, action, description, old_values, new_values)
    VALUES (
      auth.uid(),
      NEW.id,
      'user',
      'account_suspended',
      'Compte suspendu',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status, 'reason', NEW.suspension_reason)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_user_suspension ON users;
CREATE TRIGGER log_user_suspension
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION log_suspension();

-- ============================================================
-- SÉQUENCE + TRIGGER : génération carte fidélité client
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS loyalty_card_seq START 1;

CREATE OR REPLACE FUNCTION generate_loyalty_card()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'client' AND NEW.loyalty_card_number IS NULL THEN
    NEW.loyalty_card_number = 'SBTA-F-' || LPAD(nextval('loyalty_card_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gen_loyalty_card ON users;
CREATE TRIGGER gen_loyalty_card
  BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION generate_loyalty_card();
