-- Create a direct update function that uses SQL directly
-- This bypasses any ORM caching or logic issues
CREATE OR REPLACE FUNCTION direct_update_parent_email(p_id uuid, p_email text)
RETURNS text AS $$
DECLARE
    result text;
BEGIN
    -- Direct SQL update
    UPDATE parents 
    SET email = p_email,
        updated_at = NOW()
    WHERE id = p_id;
    
    -- Get the updated email to confirm it worked
    SELECT email INTO result FROM parents WHERE id = p_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql; 