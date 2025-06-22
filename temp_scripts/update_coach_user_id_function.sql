-- Function to update coach user_id based on phone number
-- This function will be called after a successful login to ensure the coach record is linked to the auth user

CREATE OR REPLACE FUNCTION update_coach_user_id(phone_param TEXT, user_id_param UUID) 
RETURNS BOOLEAN AS $$
DECLARE
  coach_id UUID;
  updated_rows INTEGER;
BEGIN
  -- Find the coach with the matching phone number
  SELECT id INTO coach_id 
  FROM coaches 
  WHERE phone_number = phone_param 
  OR phone_number = REPLACE(phone_param, ' ', '');
  
  -- If we found a coach, update their user_id
  IF coach_id IS NOT NULL THEN
    UPDATE coaches 
    SET user_id = user_id_param
    WHERE id = coach_id AND (user_id IS NULL OR user_id <> user_id_param);
    
    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    
    -- Return true if we updated a row, false otherwise
    RETURN updated_rows > 0;
  ELSE
    -- No coach found with this phone number
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 