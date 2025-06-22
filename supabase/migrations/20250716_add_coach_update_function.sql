-- Migration to add a reliable function for updating coach user_id
-- This is needed because the standard update is sometimes not working correctly

-- Create the function to update coach user_id
CREATE OR REPLACE FUNCTION public.update_coach_user_id(
  coach_id_param UUID,
  user_id_param UUID,
  email_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Direct update using SQL to ensure it works
  UPDATE public.coaches
  SET 
    user_id = user_id_param,
    email = COALESCE(email_param, email)
  WHERE id = coach_id_param;
  
  -- Return success
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error updating coach: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.update_coach_user_id(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_coach_user_id(UUID, UUID, TEXT) TO anon; 