-- ============================================================
-- Module Agent Réservation : accès aux données mobiles + contenu
-- ============================================================

-- 1. mobile_bookings : l'agent réservation (et admin) gèrent tous les billets
DROP POLICY IF EXISTS "agent_resa_select_all_bookings" ON public.mobile_bookings;
CREATE POLICY "agent_resa_select_all_bookings" ON public.mobile_bookings
  FOR SELECT TO authenticated
  USING (get_my_role() = ANY (ARRAY['agent_reservation','admin']));

DROP POLICY IF EXISTS "agent_resa_update_all_bookings" ON public.mobile_bookings;
CREATE POLICY "agent_resa_update_all_bookings" ON public.mobile_bookings
  FOR UPDATE TO authenticated
  USING (get_my_role() = ANY (ARRAY['agent_reservation','admin']))
  WITH CHECK (get_my_role() = ANY (ARRAY['agent_reservation','admin']));

-- 2. users : l'agent réservation peut lister les clients mobiles et modifier leur statut
DROP POLICY IF EXISTS "agent_resa_select_clients" ON public.users;
CREATE POLICY "agent_resa_select_clients" ON public.users
  FOR SELECT TO authenticated
  USING (get_my_role() = ANY (ARRAY['agent_reservation','admin']) AND role = 'client');

DROP POLICY IF EXISTS "agent_resa_update_clients" ON public.users;
CREATE POLICY "agent_resa_update_clients" ON public.users
  FOR UPDATE TO authenticated
  USING (get_my_role() = ANY (ARRAY['agent_reservation','admin']) AND role = 'client')
  WITH CHECK (get_my_role() = ANY (ARRAY['agent_reservation','admin']) AND role = 'client');

-- 3. mobile_app_settings : modification des frais de service
DROP POLICY IF EXISTS "agent_resa_update_settings" ON public.mobile_app_settings;
CREATE POLICY "agent_resa_update_settings" ON public.mobile_app_settings
  FOR UPDATE TO authenticated
  USING (get_my_role() = ANY (ARRAY['agent_reservation','admin']))
  WITH CHECK (get_my_role() = ANY (ARRAY['agent_reservation','admin']));

DROP POLICY IF EXISTS "agent_resa_insert_settings" ON public.mobile_app_settings;
CREATE POLICY "agent_resa_insert_settings" ON public.mobile_app_settings
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = ANY (ARRAY['agent_reservation','admin']));

-- garantir une ligne de réglages
INSERT INTO public.mobile_app_settings (id, service_fee)
VALUES (1, 300)
ON CONFLICT (id) DO NOTHING;

-- 4. FAQ affichée dans l'application mobile
CREATE TABLE IF NOT EXISTS public.reservation_faqs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question      text NOT NULL,
  answer        text NOT NULL,
  category      text DEFAULT 'general',
  display_order integer DEFAULT 0,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.reservation_faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "faqs_public_read_active" ON public.reservation_faqs;
CREATE POLICY "faqs_public_read_active" ON public.reservation_faqs
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "faqs_agent_select" ON public.reservation_faqs;
CREATE POLICY "faqs_agent_select" ON public.reservation_faqs
  FOR SELECT TO authenticated
  USING (get_my_role() = ANY (ARRAY['agent_reservation','admin']));

DROP POLICY IF EXISTS "faqs_agent_insert" ON public.reservation_faqs;
CREATE POLICY "faqs_agent_insert" ON public.reservation_faqs
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = ANY (ARRAY['agent_reservation','admin']));

DROP POLICY IF EXISTS "faqs_agent_update" ON public.reservation_faqs;
CREATE POLICY "faqs_agent_update" ON public.reservation_faqs
  FOR UPDATE TO authenticated
  USING (get_my_role() = ANY (ARRAY['agent_reservation','admin']))
  WITH CHECK (get_my_role() = ANY (ARRAY['agent_reservation','admin']));

DROP POLICY IF EXISTS "faqs_agent_delete" ON public.reservation_faqs;
CREATE POLICY "faqs_agent_delete" ON public.reservation_faqs
  FOR DELETE TO authenticated
  USING (get_my_role() = ANY (ARRAY['agent_reservation','admin']));

-- 5. Politiques d'annulation appliquées aux remboursements
CREATE TABLE IF NOT EXISTS public.cancellation_policies (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  text NOT NULL,
  description            text DEFAULT '',
  hours_before_departure integer NOT NULL DEFAULT 0,
  refund_rate            integer NOT NULL DEFAULT 0,
  is_active              boolean DEFAULT true,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

ALTER TABLE public.cancellation_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cancel_public_read_active" ON public.cancellation_policies;
CREATE POLICY "cancel_public_read_active" ON public.cancellation_policies
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "cancel_agent_select" ON public.cancellation_policies;
CREATE POLICY "cancel_agent_select" ON public.cancellation_policies
  FOR SELECT TO authenticated
  USING (get_my_role() = ANY (ARRAY['agent_reservation','admin']));

DROP POLICY IF EXISTS "cancel_agent_insert" ON public.cancellation_policies;
CREATE POLICY "cancel_agent_insert" ON public.cancellation_policies
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = ANY (ARRAY['agent_reservation','admin']));

DROP POLICY IF EXISTS "cancel_agent_update" ON public.cancellation_policies;
CREATE POLICY "cancel_agent_update" ON public.cancellation_policies
  FOR UPDATE TO authenticated
  USING (get_my_role() = ANY (ARRAY['agent_reservation','admin']))
  WITH CHECK (get_my_role() = ANY (ARRAY['agent_reservation','admin']));

DROP POLICY IF EXISTS "cancel_agent_delete" ON public.cancellation_policies;
CREATE POLICY "cancel_agent_delete" ON public.cancellation_policies
  FOR DELETE TO authenticated
  USING (get_my_role() = ANY (ARRAY['agent_reservation','admin']));

-- 6. Temps réel pour la synchronisation avec /sbtamobile
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mobile_bookings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_bookings;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='reservation_faqs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservation_faqs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='cancellation_policies') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cancellation_policies;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
