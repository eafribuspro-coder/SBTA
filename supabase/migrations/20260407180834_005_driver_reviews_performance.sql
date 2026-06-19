/*
  # Driver Reviews & Performance System Enhancement

  1. Changes
    - Add missing columns to existing driver_reviews table
    - Create driver_performance_badges table for tracking
    - Add functions for points calculation
    - Add triggers for automatic updates
    
  2. Security
    - Update RLS policies for public review submission
    - Policies for performance viewing
*/

-- Add missing columns to driver_reviews if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_reviews' AND column_name = 'token') THEN
    ALTER TABLE driver_reviews ADD COLUMN token text UNIQUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_reviews' AND column_name = 'qualities') THEN
    ALTER TABLE driver_reviews ADD COLUMN qualities text[] DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_reviews' AND column_name = 'phone_distraction') THEN
    ALTER TABLE driver_reviews ADD COLUMN phone_distraction boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_reviews' AND column_name = 'points_awarded') THEN
    ALTER TABLE driver_reviews ADD COLUMN points_awarded integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_reviews' AND column_name = 'token_used') THEN
    ALTER TABLE driver_reviews ADD COLUMN token_used boolean DEFAULT false;
  END IF;
END $$;

-- Create driver_performance_badges table
CREATE TABLE IF NOT EXISTS driver_performance_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid UNIQUE NOT NULL REFERENCES users(id),
  current_badge text DEFAULT 'bronze' CHECK (current_badge IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  total_points integer DEFAULT 0,
  total_reviews integer DEFAULT 0,
  average_rating numeric(3,2) DEFAULT 0.0,
  phone_distraction_count integer DEFAULT 0,
  qualities_count jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE driver_performance_badges ENABLE ROW LEVEL SECURITY;

-- Policies for driver_performance_badges
CREATE POLICY "Drivers view own performance"
  ON driver_performance_badges
  FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "Admins view all performance"
  ON driver_performance_badges
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'daf', 'comptable')
    )
  );

-- Function to calculate points based on review
CREATE OR REPLACE FUNCTION calculate_review_points(
  p_rating integer,
  p_qualities text[],
  p_phone_distraction boolean
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  points integer := 0;
BEGIN
  points := p_rating * 10;
  points := points + (COALESCE(array_length(p_qualities, 1), 0) * 2);
  
  IF p_phone_distraction THEN
    points := points - 10;
  END IF;
  
  IF p_rating = 5 THEN
    points := points + 5;
  END IF;
  
  IF points < 0 THEN
    points := 0;
  END IF;
  
  RETURN points;
END;
$$;

-- Function to determine badge level from points
CREATE OR REPLACE FUNCTION get_badge_from_points(p_points integer)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_points >= 600 THEN
    RETURN 'diamond';
  ELSIF p_points >= 500 THEN
    RETURN 'platinum';
  ELSIF p_points >= 300 THEN
    RETURN 'gold';
  ELSIF p_points >= 150 THEN
    RETURN 'silver';
  ELSE
    RETURN 'bronze';
  END IF;
END;
$$;

-- Trigger to update driver performance after review submission
CREATE OR REPLACE FUNCTION update_driver_performance_after_review()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_qualities_count jsonb;
  v_quality text;
  v_current_count integer;
BEGIN
  INSERT INTO driver_performance_badges (driver_id, total_points, total_reviews)
  VALUES (NEW.driver_id, 0, 0)
  ON CONFLICT (driver_id) DO NOTHING;
  
  SELECT qualities_count INTO v_qualities_count
  FROM driver_performance_badges
  WHERE driver_id = NEW.driver_id;
  
  IF v_qualities_count IS NULL THEN
    v_qualities_count := '{}'::jsonb;
  END IF;
  
  IF NEW.qualities IS NOT NULL THEN
    FOREACH v_quality IN ARRAY NEW.qualities
    LOOP
      v_current_count := COALESCE((v_qualities_count->>v_quality)::integer, 0);
      v_qualities_count := jsonb_set(
        v_qualities_count,
        ARRAY[v_quality],
        to_jsonb(v_current_count + 1)
      );
    END LOOP;
  END IF;
  
  UPDATE driver_performance_badges
  SET
    total_points = total_points + NEW.points_awarded,
    total_reviews = total_reviews + 1,
    average_rating = (
      SELECT AVG(rating)::numeric(3,2)
      FROM driver_reviews
      WHERE driver_id = NEW.driver_id
      AND token_used = true
      AND rating IS NOT NULL
    ),
    phone_distraction_count = phone_distraction_count + CASE WHEN NEW.phone_distraction THEN 1 ELSE 0 END,
    qualities_count = v_qualities_count,
    current_badge = get_badge_from_points(total_points + NEW.points_awarded),
    updated_at = now()
  WHERE driver_id = NEW.driver_id;
  
  UPDATE users
  SET
    driver_avg_rating = (
      SELECT average_rating
      FROM driver_performance_badges
      WHERE driver_id = NEW.driver_id
    ),
    loyalty_points = (
      SELECT total_points
      FROM driver_performance_badges
      WHERE driver_id = NEW.driver_id
    ),
    driver_total_reviews = (
      SELECT total_reviews
      FROM driver_performance_badges
      WHERE driver_id = NEW.driver_id
    )
  WHERE id = NEW.driver_id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_review_submitted ON driver_reviews;

CREATE TRIGGER after_review_submitted
  AFTER INSERT ON driver_reviews
  FOR EACH ROW
  WHEN (NEW.token_used = true AND NEW.rating IS NOT NULL)
  EXECUTE FUNCTION update_driver_performance_after_review();

-- Create index on token column
CREATE INDEX IF NOT EXISTS idx_driver_reviews_token ON driver_reviews(token) WHERE token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_driver_performance_badges_driver_id ON driver_performance_badges(driver_id);
