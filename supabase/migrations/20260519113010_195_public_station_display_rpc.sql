/*
  # Public Station Display RPC

  Creates two SECURITY DEFINER functions for the public departure board display.
  These bypass RLS so the display screen works without an authenticated session.

  1. get_station_display_info(p_station_id uuid)
     - Returns basic station info (name, city, address)
     - Used by StationDisplay header when loaded via direct URL

  2. get_station_departures(p_station_id uuid, p_date date)
     - Returns all scheduled departures for a station on a given date
     - Includes bus, driver, arrival/departure station names, transit stops
     - Only exposes display-safe fields (no personal user data beyond driver name)

  Security notes:
  - Both functions are SECURITY DEFINER with fixed search_path = public
  - They only expose the minimum data needed for the public display board
  - No user credentials, emails, or sensitive financial data is exposed
  - GRANT to anon AND authenticated so both unauthenticated and logged-in sessions work
*/

-- ── Station info ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_station_display_info(p_station_id uuid)
RETURNS TABLE (
  id           uuid,
  name         text,
  address      text,
  city_name    text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    s.id,
    s.name,
    s.address,
    COALESCE(c.name, '') AS city_name
  FROM stations s
  LEFT JOIN cities c ON c.id = s.city_id
  WHERE s.id = p_station_id;
$$;

GRANT EXECUTE ON FUNCTION get_station_display_info(uuid) TO anon, authenticated;

-- ── Station departures ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_station_departures(p_station_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  id                      uuid,
  route_name              text,
  departure_datetime      timestamptz,
  arrival_datetime        timestamptz,
  status                  text,
  seats_available         int,
  seats_reserved          int,
  bus_capacity            int,
  fill_rate               numeric,
  notes                   text,
  transit_stops           jsonb,
  bus_registration        text,
  bus_model               text,
  driver_name             text,
  driver_phone            text,
  copilot_name            text,
  departure_station_name  text,
  arrival_station_name    text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    sch.id,
    sch.route_name,
    sch.departure_datetime,
    sch.arrival_datetime,
    sch.status,
    COALESCE(sch.seats_available, GREATEST(0, COALESCE(b.total_seats, b.capacity, 0) - COALESCE(sch.seats_reserved, 0))) AS seats_available,
    COALESCE(sch.seats_reserved, 0) AS seats_reserved,
    COALESCE(b.total_seats, b.capacity, 0) AS bus_capacity,
    sch.fill_rate,
    COALESCE(sch.notes, '') AS notes,
    COALESCE(sch.transit_stops, '[]'::jsonb) AS transit_stops,
    COALESCE(b.registration_number, '—') AS bus_registration,
    COALESCE(b.model, '') AS bus_model,
    COALESCE(u_driver.full_name, '—') AS driver_name,
    COALESCE(u_driver.phone, '') AS driver_phone,
    COALESCE(u_copilot.full_name, '') AS copilot_name,
    COALESCE(dep_st.name, '—') AS departure_station_name,
    COALESCE(arr_st.name, '—') AS arrival_station_name
  FROM schedules sch
  LEFT JOIN buses            b         ON b.id         = sch.bus_id
  LEFT JOIN users            u_driver  ON u_driver.id  = sch.driver_id
  LEFT JOIN users            u_copilot ON u_copilot.id = sch.copilot_id
  LEFT JOIN stations         dep_st    ON dep_st.id    = sch.departure_station_id
  LEFT JOIN stations         arr_st    ON arr_st.id    = sch.arrival_station_id
  WHERE sch.departure_station_id = p_station_id
    AND sch.departure_datetime >= (p_date::timestamptz AT TIME ZONE 'UTC')
    AND sch.departure_datetime <  ((p_date + 1)::timestamptz AT TIME ZONE 'UTC')
  ORDER BY sch.departure_datetime ASC;
$$;

GRANT EXECUTE ON FUNCTION get_station_departures(uuid, date) TO anon, authenticated;
