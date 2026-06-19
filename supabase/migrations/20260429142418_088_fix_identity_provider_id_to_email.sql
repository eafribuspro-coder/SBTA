/*
  # Fix auth.identities provider_id

  ## Problème
  GoTrue (le moteur d'auth de Supabase) vérifie lors du login email/password
  que auth.identities.provider_id == email de l'utilisateur.
  Tous les comptes ont provider_id = UUID au lieu de provider_id = email.
  C'est pourquoi "Invalid login credentials" est renvoyé malgré un hash valide.

  ## Solution
  Mettre à jour provider_id avec l'email pour tous les comptes
  dont le provider est "email".
*/

UPDATE auth.identities ai
SET 
  provider_id = au.email,
  updated_at  = now()
FROM auth.users au
WHERE ai.user_id = au.id
  AND ai.provider = 'email'
  AND ai.provider_id != au.email;
