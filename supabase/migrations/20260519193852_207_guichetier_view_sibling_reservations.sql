/*
  # Allow guichetier to view all reservations on sibling schedules

  1. Problem
    - Guichetier RLS policy only allows viewing reservations where `booked_by = auth.uid()`
    - This prevents guichetier at Yopougon from seeing seats sold by Adjamé on the same bus
    - Seat map appears empty/available when it should show occupied (red) seats

  2. Solution
    - Replace the restrictive "own reservations only" SELECT policy
    - New policy allows guichetier to see ALL reservations on schedules that share
      the same bus_id and departure_datetime as any schedule departing from their station
    - This ensures the seat map correctly shows ALL sold seats across all guichets

  3. Security
    - Still restricted to authenticated guichetier role only
    - Only shows reservations for buses that depart from their assigned station
    - Does not expose reservations on unrelated routes/buses
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Guichetier can view own counter reservations" ON reservations;

-- Create a helper function to get the guichetier's station_id from their counter
CREATE OR REPLACE FUNCTION get_guichetier_station_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.station_id 
  FROM counters c 
  WHERE c.assigned_user_id = auth.uid() 
  LIMIT 1;
$$;

-- New policy: guichetier can view reservations on any schedule that shares
-- the same bus AND departure time as a schedule from their station
CREATE POLICY "Guichetier can view reservations on shared bus schedules"
  ON reservations
  FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'guichetier'
    AND (
      -- Own reservations (always visible)
      booked_by = auth.uid()
      OR
      -- Reservations on sibling schedules (same bus, same departure time)
      EXISTS (
        SELECT 1
        FROM schedules s_res
        JOIN schedules s_mine 
          ON s_mine.bus_id = s_res.bus_id
          AND s_mine.departure_datetime = s_res.departure_datetime
          AND s_mine.departure_station_id = get_guichetier_station_id()
        WHERE s_res.id = reservations.schedule_id
      )
    )
  );
