-- Allow responsable_logistique (and admin) to update the bus registration plate
-- so plate changes made in the logistics module propagate to the global buses list.
DROP POLICY IF EXISTS "logistique can update bus plate" ON public.buses;
CREATE POLICY "logistique can update bus plate"
  ON public.buses FOR UPDATE
  TO authenticated
  USING (get_my_role_logistique() = ANY (ARRAY['responsable_logistique','admin']))
  WITH CHECK (get_my_role_logistique() = ANY (ARRAY['responsable_logistique','admin']));

NOTIFY pgrst, 'reload schema';
