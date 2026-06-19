/*
  # RPC: get_schedules_transport_info

  Creates a SECURITY DEFINER function that returns bus registration number and
  driver full name for a given array of schedule IDs.

  This bypasses RLS on the users table, which does not grant SELECT to
  agent_colis / superviseur_colis roles. The function is intentionally narrow:
  it only exposes { schedule_id, bus_registration, driver_name } — no other
  user data is leaked.

  Used by: parcel bordereau courrier (agent-colis dashboard)
*/

CREATE OR REPLACE FUNCTION get_schedules_transport_info(p_schedule_ids uuid[])
RETURNS TABLE (
  schedule_id      uuid,
  bus_registration text,
  driver_name      text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    s.id                   AS schedule_id,
    b.registration_number  AS bus_registration,
    u.full_name            AS driver_name
  FROM schedules s
  LEFT JOIN buses b ON b.id = s.bus_id
  LEFT JOIN users u ON u.id = s.driver_id
  WHERE s.id = ANY(p_schedule_ids);
$$;

GRANT EXECUTE ON FUNCTION get_schedules_transport_info(uuid[]) TO authenticated;
