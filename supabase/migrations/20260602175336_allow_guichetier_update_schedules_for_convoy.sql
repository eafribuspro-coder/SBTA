/*
  # Allow guichetier to update schedules for convoy registration

  1. Security Changes
    - Add UPDATE policy on `schedules` for guichetier role
    - Only allows updating schedules that are assigned to the guichetier's counter
      via the departure_sequence table
    - This enables the guichetier to change a schedule's status to 'convoi'
      and update seat counts when registering a convoy departure
*/

CREATE POLICY "Guichetier can update schedules assigned to their counter"
  ON public.schedules
  FOR UPDATE
  TO authenticated
  USING (
    get_my_role() = 'guichetier'
    AND EXISTS (
      SELECT 1 FROM departure_sequence ds
      JOIN counters c ON c.id = ds.counter_id
      WHERE ds.schedule_id = schedules.id
        AND c.assigned_user_id = auth.uid()
    )
  )
  WITH CHECK (
    get_my_role() = 'guichetier'
    AND EXISTS (
      SELECT 1 FROM departure_sequence ds
      JOIN counters c ON c.id = ds.counter_id
      WHERE ds.schedule_id = schedules.id
        AND c.assigned_user_id = auth.uid()
    )
  );
