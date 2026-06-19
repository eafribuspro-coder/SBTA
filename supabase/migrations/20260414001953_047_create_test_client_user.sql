/*
  # Create Test Client User

  Creates a dedicated test client user with a known password for testing the client interface.
  
  1. Updates client01@gmail.com user profile with proper name data
  2. Ensures the user has all required fields for loyalty display
*/

UPDATE users
SET 
  first_name = 'Marie',
  last_name = 'Kouassi',
  full_name = 'Marie Kouassi',
  phone = '+225 07 12 34 56 78',
  loyalty_card_number = COALESCE(loyalty_card_number, 'SBTA-2024-001'),
  loyalty_tier = 'platinum',
  loyalty_points = 12500
WHERE email = 'client01@gmail.com';
