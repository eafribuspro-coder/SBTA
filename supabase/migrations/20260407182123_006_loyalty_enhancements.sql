/*
  # Loyalty Program Enhancements

  1. Changes
    - Update loyalty_rewards_catalog with images and descriptions
    - Add redemption_code and expiry to loyalty_redemptions
    - Add loyalty tier thresholds configuration
    - Add triggers for automatic points attribution
    
  2. New Features
    - Automatic points calculation based on distance and class
    - Bonus points for online booking, reviews, milestones
    - Free trip reward every 10 trips
    - Tier progression (Bronze → Silver → Gold → Platinum)
*/

-- Update loyalty_rewards_catalog with additional fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_rewards_catalog' AND column_name = 'image_url') THEN
    ALTER TABLE loyalty_rewards_catalog ADD COLUMN image_url text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_rewards_catalog' AND column_name = 'validity_days') THEN
    ALTER TABLE loyalty_rewards_catalog ADD COLUMN validity_days integer DEFAULT 30;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_rewards_catalog' AND column_name = 'stock_available') THEN
    ALTER TABLE loyalty_rewards_catalog ADD COLUMN stock_available integer;
  END IF;
END $$;

-- Update loyalty_redemptions with code and expiry
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_redemptions' AND column_name = 'redemption_code') THEN
    ALTER TABLE loyalty_redemptions ADD COLUMN redemption_code text UNIQUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_redemptions' AND column_name = 'expires_at') THEN
    ALTER TABLE loyalty_redemptions ADD COLUMN expires_at timestamptz;
  END IF;
END $$;

-- Function to calculate loyalty points for a reservation
CREATE OR REPLACE FUNCTION calculate_loyalty_points(
  p_reservation_id uuid
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_distance numeric;
  v_seat_class text;
  v_is_online boolean;
  v_total_trips integer;
  v_points integer := 0;
  v_customer_id uuid;
BEGIN
  -- Get reservation details
  SELECT 
    r.customer_id,
    rt.distance_km,
    CASE 
      WHEN s.seat_numbers && ARRAY['VIP1', 'VIP2', 'VIP3', 'VIP4'] THEN 'vip'
      WHEN s.seat_numbers && ARRAY['EX1', 'EX2', 'EX3', 'EX4'] THEN 'executive'
      ELSE 'standard'
    END as seat_class,
    CASE WHEN r.booked_by = r.customer_id THEN true ELSE false END as is_online,
    u.total_trips
  INTO v_customer_id, v_distance, v_seat_class, v_is_online, v_total_trips
  FROM reservations r
  JOIN schedules s ON r.schedule_id = s.id
  JOIN routes rt ON s.route_id = rt.id
  JOIN users u ON r.customer_id = u.id
  WHERE r.id = p_reservation_id;
  
  -- Base points from distance (distance/100 * 10)
  v_points := FLOOR(v_distance / 100) * 10;
  
  -- Bonus for seat class
  IF v_seat_class = 'vip' THEN
    v_points := v_points + 5;
  ELSIF v_seat_class = 'executive' THEN
    v_points := v_points + 15;
  END IF;
  
  -- Bonus for online booking
  IF v_is_online THEN
    v_points := v_points + 3;
  END IF;
  
  -- First trip bonus
  IF v_total_trips = 1 THEN
    v_points := v_points + 50;
  END IF;
  
  -- Milestone bonus: every 10 trips
  IF v_total_trips % 10 = 0 AND v_total_trips > 0 THEN
    -- Create free trip reward
    INSERT INTO loyalty_redemptions (
      customer_id,
      reward_id,
      points_used,
      status,
      redemption_code,
      expires_at
    )
    SELECT 
      v_customer_id,
      id,
      0,
      'validee',
      'BONUS-' || UPPER(substring(md5(random()::text) from 1 for 8)),
      now() + interval '90 days'
    FROM loyalty_rewards_catalog
    WHERE reward_type = 'free_trip'
    LIMIT 1;
  END IF;
  
  RETURN v_points;
END;
$$;

-- Function to determine loyalty tier from points
CREATE OR REPLACE FUNCTION get_loyalty_tier_from_points(p_points integer)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_points >= 2000 THEN
    RETURN 'platinum';
  ELSIF p_points >= 1000 THEN
    RETURN 'gold';
  ELSIF p_points >= 500 THEN
    RETURN 'silver';
  ELSE
    RETURN 'bronze';
  END IF;
END;
$$;

-- Trigger function to award points after reservation confirmed
CREATE OR REPLACE FUNCTION award_loyalty_points_after_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_points integer;
  v_new_tier text;
BEGIN
  -- Only award points when status changes to confirmee and payment is successful
  IF NEW.status = 'confirmee' AND NEW.payment_status = 'payee' AND 
     (OLD.status IS NULL OR OLD.status != 'confirmee') THEN
    
    -- Calculate points
    v_points := calculate_loyalty_points(NEW.id);
    
    -- Update customer loyalty points and trips
    UPDATE users
    SET 
      loyalty_points = loyalty_points + v_points,
      total_trips = total_trips + 1,
      loyalty_tier = get_loyalty_tier_from_points(loyalty_points + v_points)
    WHERE id = NEW.customer_id;
    
    -- Log points transaction
    INSERT INTO loyalty_points_log (customer_id, points_change, reason, reservation_id)
    VALUES (
      NEW.customer_id,
      v_points,
      'Voyage confirmé',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS after_reservation_confirmed ON reservations;

CREATE TRIGGER after_reservation_confirmed
  AFTER INSERT OR UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION award_loyalty_points_after_reservation();

-- Function to generate redemption code
CREATE OR REPLACE FUNCTION generate_redemption_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
  v_exists boolean;
BEGIN
  LOOP
    v_code := 'SBTA-' || UPPER(substring(md5(random()::text) from 1 for 8));
    
    SELECT EXISTS(
      SELECT 1 FROM loyalty_redemptions WHERE redemption_code = v_code
    ) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_code;
END;
$$;

-- Trigger to auto-generate redemption code
CREATE OR REPLACE FUNCTION set_redemption_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.redemption_code IS NULL THEN
    NEW.redemption_code := generate_redemption_code();
  END IF;
  
  -- Set expiry date if not set
  IF NEW.expires_at IS NULL THEN
    SELECT expires_at + interval '1 day' * validity_days
    INTO NEW.expires_at
    FROM loyalty_rewards_catalog
    WHERE id = NEW.reward_id;
    
    IF NEW.expires_at IS NULL THEN
      NEW.expires_at := now() + interval '30 days';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_redemption_insert ON loyalty_redemptions;

CREATE TRIGGER before_redemption_insert
  BEFORE INSERT ON loyalty_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION set_redemption_code();

-- Update loyalty_redemptions policies for guichetier validation
DROP POLICY IF EXISTS "Guichetiers can view redemptions" ON loyalty_redemptions;

CREATE POLICY "Guichetiers can view redemptions"
  ON loyalty_redemptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'guichetier', 'comptable')
    )
  );

DROP POLICY IF EXISTS "Guichetiers can update redemptions" ON loyalty_redemptions;

CREATE POLICY "Guichetiers can update redemptions"
  ON loyalty_redemptions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'guichetier')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'guichetier')
    )
  );

-- Insert sample rewards if catalog is empty
INSERT INTO loyalty_rewards_catalog (name, description, points_required, reward_type, reward_value, validity_days, is_active)
SELECT * FROM (VALUES
  ('Réduction 10%', 'Bénéficiez de 10% de réduction sur votre prochain voyage', 200, 'discount', 10, 30, true),
  ('Réduction 25%', 'Bénéficiez de 25% de réduction sur votre prochain voyage', 500, 'discount', 25, 30, true),
  ('Voyage gratuit', 'Un voyage gratuit sur n''importe quelle destination', 1000, 'free_trip', 100, 90, true),
  ('Surclassement VIP', 'Surclassement gratuit en cabine VIP', 300, 'upgrade', 0, 60, true),
  ('Bon d''achat 5.000 FCFA', 'Bon d''achat valable sur tous les trajets', 400, 'voucher', 5000, 60, true),
  ('Bon d''achat 10.000 FCFA', 'Bon d''achat valable sur tous les trajets', 750, 'voucher', 10000, 60, true)
) AS v(name, description, points_required, reward_type, reward_value, validity_days, is_active)
WHERE NOT EXISTS (SELECT 1 FROM loyalty_rewards_catalog LIMIT 1);

-- Create index for redemption code lookup
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_code ON loyalty_redemptions(redemption_code);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_log_customer ON loyalty_points_log(customer_id);
