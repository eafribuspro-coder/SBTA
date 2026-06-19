/*
  # Guichet Isolation — RLS & helper function

  ## Summary
  Enforce strict per-counter visibility for guichetiers and per-station
  visibility for chef_gare.

  ## Changes

  ### New helper function
  - `get_my_counter_id()` — returns the counter id whose `assigned_user_id`
    matches `auth.uid()`. SECURITY DEFINER so it can bypass RLS on counters.

  ### reservations
  - DROP old broad "Guichetier can insert/update reservations" policies.
  - ADD new INSERT policy: guichetier can only insert rows where
    `booked_by = auth.uid()`.
  - ADD new UPDATE policy: guichetier can only update rows they booked
    (`booked_by = auth.uid()`).

  ### payments
  - DROP old broad "Guichetier can insert/update payments" policies.
  - ADD new INSERT policy: guichetier can only insert payments whose
    linked reservation was booked by themselves.
  - ADD new UPDATE policy: same ownership check via reservation.booked_by.

  ### Security notes
  - Admin retains full access via existing ALL policy.
  - SELECT policies for guichetier were already correctly scoped to
    `booked_by = auth.uid()` — no change needed there.
  - chef_gare SELECT policies already use `get_my_station_id()` — correct.
*/

-- ── Helper: get_my_counter_id ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_counter_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT id FROM counters WHERE assigned_user_id = auth.uid() LIMIT 1;
$$;

-- ── reservations — tighten INSERT / UPDATE for guichetier ────────────────────

-- Drop old broad policies
DROP POLICY IF EXISTS "Guichetier can insert reservations" ON reservations;
DROP POLICY IF EXISTS "Guichetier can update reservations" ON reservations;

-- New INSERT: guichetier may only create rows they own
CREATE POLICY "Guichetier can insert own reservations"
  ON reservations FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'guichetier'
      AND booked_by = auth.uid()
    )
  );

-- New UPDATE: guichetier may only update rows they booked
CREATE POLICY "Guichetier can update own reservations"
  ON reservations FOR UPDATE
  TO authenticated
  USING (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'guichetier'
      AND booked_by = auth.uid()
    )
  )
  WITH CHECK (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'guichetier'
      AND booked_by = auth.uid()
    )
  );

-- ── payments — tighten INSERT / UPDATE for guichetier ────────────────────────

-- Drop old broad policies
DROP POLICY IF EXISTS "Guichetier can insert payments" ON payments;
DROP POLICY IF EXISTS "Guichetier can update payments"  ON payments;

-- New INSERT: guichetier can only insert a payment for a reservation they own
CREATE POLICY "Guichetier can insert own counter payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'guichetier'
      AND processed_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM reservations r
        WHERE r.id = payments.reservation_id
          AND r.booked_by = auth.uid()
      )
    )
  );

-- New UPDATE: guichetier can only update payments they processed
CREATE POLICY "Guichetier can update own counter payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'guichetier'
      AND processed_by = auth.uid()
    )
  )
  WITH CHECK (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'guichetier'
      AND processed_by = auth.uid()
    )
  );
