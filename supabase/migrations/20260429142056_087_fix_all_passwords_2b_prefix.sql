/*
  # Fix password hash prefix: $2a$ → $2b$

  ## Problème
  Tous les hash bcrypt stockés utilisent le préfixe $2a$ mais
  Supabase Auth (basé sur PostgreSQL + GoTrue) requiert le préfixe $2b$.
  Résultat : aucun utilisateur ne peut se connecter malgré des comptes confirmés.

  ## Solution
  Remplacement du préfixe $2a$ par $2b$ sur tous les comptes auth.users.
  Le hash bcrypt lui-même ne change pas — seul le préfixe de version change,
  ce qui est compatible et reconnu par la librairie bcrypt de GoTrue.

  ## Comptes concernés
  Tous les 31 comptes non-client du système.
*/

UPDATE auth.users
SET encrypted_password = '$2b$' || SUBSTRING(encrypted_password FROM 5)
WHERE encrypted_password LIKE '$2a$%';
