/*
  # Fix RLS Recursion on All Tables

  ## Problem
  Many tables have RLS policies that query the users table to check roles:
  - EXISTS (SELECT FROM users WHERE id = auth.uid() AND role = ...)
  - This creates recursion when users try to login
  
  ## Solution
  Replace all policies that query users table with calls to has_role() function
  which uses SECURITY DEFINER to bypass RLS.

  ## Changes
  1. Drop problematic policies on driver_performance_badges
  2. Drop problematic policies on loyalty_redemptions
  3. Recreate them using has_role() function instead
*/

-- ===================================
-- FIX: driver_performance_badges
-- ===================================

DROP POLICY IF EXISTS "Admins view all performance" ON driver_performance_badges;

-- Allow admins/daf/comptable to view all performance badges
CREATE POLICY "admin_view_performance"
  ON driver_performance_badges
  FOR SELECT
  TO authenticated
  USING (
    has_role('admin') 
    OR has_role('daf') 
    OR has_role('comptable')
  );

-- Allow drivers to view their own badges
CREATE POLICY "driver_view_own_badges"
  ON driver_performance_badges
  FOR SELECT
  TO authenticated
  USING (
    driver_id = auth.uid()
  );

-- ===================================
-- FIX: loyalty_redemptions
-- ===================================

DROP POLICY IF EXISTS "Guichetiers can view redemptions" ON loyalty_redemptions;
DROP POLICY IF EXISTS "Guichetiers can update redemptions" ON loyalty_redemptions;

-- Allow guichetiers/admin/comptable to view redemptions
CREATE POLICY "staff_view_redemptions"
  ON loyalty_redemptions
  FOR SELECT
  TO authenticated
  USING (
    has_role('admin')
    OR has_role('guichetier')
    OR has_role('comptable')
  );

-- Allow guichetiers/admin to update redemptions
CREATE POLICY "staff_update_redemptions"
  ON loyalty_redemptions
  FOR UPDATE
  TO authenticated
  USING (
    has_role('admin')
    OR has_role('guichetier')
  )
  WITH CHECK (
    has_role('admin')
    OR has_role('guichetier')
  );

-- Allow customers to view their own redemptions
CREATE POLICY "customer_view_own_redemptions"
  ON loyalty_redemptions
  FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
  );
