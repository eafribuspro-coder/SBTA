/*
  # Création des comptes utilisateurs colis

  - superviseur_colis : supervision globale toutes agences (SBTA Holding)
  - agent_colis       : agent opérationnel à la Gare SBTA Adjamé
*/

DO $$
DECLARE
  v_sup_id uuid := 'c0115001-0000-4000-8000-000000000001';
  v_agt_id uuid := 'c0115002-0000-4000-8000-000000000002';
BEGIN

  -- auth.users
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at, confirmation_sent_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, recovery_sent_at
  ) VALUES
  (
    v_sup_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'superviseur.colis@sbta.ci',
    '$2b$10$5RqmBNMkRGDp4BtJwhFc7OavvkJnWX6vn7ZbPHEjHVHAMJBEaYQXa',
    now(), now(), now(), now(),
    '{"provider":"email","providers":["email"],"role":"superviseur_colis"}',
    '{"full_name":"KOUAME Jean-Baptiste","role":"superviseur_colis"}',
    false, null
  ),
  (
    v_agt_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'agent.colis@sbta.ci',
    '$2b$10$5RqmBNMkRGDp4BtJwhFc7OavvkJnWX6vn7ZbPHEjHVHAMJBEaYQXa',
    now(), now(), now(), now(),
    '{"provider":"email","providers":["email"],"role":"agent_colis"}',
    '{"full_name":"DIALLO Aminata","role":"agent_colis"}',
    false, null
  )
  ON CONFLICT (id) DO NOTHING;

  -- auth.identities
  INSERT INTO auth.identities (
    id, user_id, provider_id, provider,
    identity_data, created_at, updated_at, last_sign_in_at
  ) VALUES
  (
    v_sup_id,
    v_sup_id,
    'superviseur.colis@sbta.ci', 'email',
    jsonb_build_object('sub', v_sup_id::text, 'email', 'superviseur.colis@sbta.ci'),
    now(), now(), now()
  ),
  (
    v_agt_id,
    v_agt_id,
    'agent.colis@sbta.ci', 'email',
    jsonb_build_object('sub', v_agt_id::text, 'email', 'agent.colis@sbta.ci'),
    now(), now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- public.users
  INSERT INTO users (
    id, email, full_name, first_name, last_name,
    role, is_active, status, company_id, station_id,
    created_at, updated_at
  ) VALUES
  (
    v_sup_id,
    'superviseur.colis@sbta.ci',
    'KOUAME Jean-Baptiste',
    'Jean-Baptiste', 'KOUAME',
    'superviseur_colis', true, 'active',
    '11111111-1111-1111-1111-111111111111',
    null,
    now(), now()
  ),
  (
    v_agt_id,
    'agent.colis@sbta.ci',
    'DIALLO Aminata',
    'Aminata', 'DIALLO',
    'agent_colis', true, 'active',
    '11111111-1111-1111-1111-111111111111',
    '51000001-0000-0000-0000-000000000001',
    now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

END $$;
