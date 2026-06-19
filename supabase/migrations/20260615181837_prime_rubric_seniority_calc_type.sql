-- Ajoute le mode de calcul automatique 'seniority' (prime d'ancienneté) :
-- le taux est determine selon l'anciennete de l'employe (date d'entree) puis
-- applique sur le salaire de base. La rubrique 'anciennete' passe en calcul auto.

ALTER TABLE prime_rubrics DROP CONSTRAINT IF EXISTS prime_rubrics_calc_type_check;
ALTER TABLE prime_rubrics ADD CONSTRAINT prime_rubrics_calc_type_check
  CHECK (calc_type IN ('fixed', 'percent_base', 'seniority'));

UPDATE prime_rubrics SET calc_type = 'seniority', updated_at = now()
WHERE code = 'anciennete';

NOTIFY pgrst, 'reload schema';
