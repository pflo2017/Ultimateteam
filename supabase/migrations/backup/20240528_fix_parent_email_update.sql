-- Create a superuser-level function to update parent email
-- This function will bypass RLS policies
CREATE OR REPLACE FUNCTION update_parent_email_bypass(
  p_id uuid, 
  p_email text
) 
RETURNS jsonb
SECURITY DEFINER  -- This runs with the privileges of the function creator (superuser)
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Direct update bypassing RLS
  UPDATE parents
  SET 
    email = p_email,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_id;
  
  -- Get the updated record
  SELECT jsonb_build_object(
    'id', id,
    'email', email,
    'name', name,
    'updated_at', updated_at
  ) INTO result
  FROM parents
  WHERE id = p_id;
  
  -- For debugging
  RAISE NOTICE 'Updated parent % with email %', p_id, p_email;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql; 