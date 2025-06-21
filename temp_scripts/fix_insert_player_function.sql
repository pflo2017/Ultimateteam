-- Fix the insert_player_for_child function to handle payment_status correctly
-- This addresses the error: "column "player_status" is of type payment_status_enum but expression is of type text"

-- Drop the existing function
DROP FUNCTION IF EXISTS public.insert_player_for_child(text, uuid, uuid, uuid, uuid, boolean);

-- Recreate the function with proper type casting for player_status
CREATE OR REPLACE FUNCTION public.insert_player_for_child(
    p_name text,
    p_team_id uuid,
    p_admin_id uuid,
    p_club_id uuid,
    p_parent_id uuid,
    p_is_new_trial boolean
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_birth_date timestamp with time zone;
    v_player_id uuid;
    v_parent_child_id uuid;
BEGIN
    -- Try to get birth_date and parent_child_id from parent_children table
    SELECT birth_date, id INTO v_birth_date, v_parent_child_id
    FROM parent_children
    WHERE parent_id = p_parent_id
    AND LOWER(full_name) = LOWER(p_name)
    AND is_active = true
    AND player_id IS NULL
    LIMIT 1;

    -- Insert into players table with birth_date
    INSERT INTO public.players (
        name, 
        team_id, 
        admin_id, 
        club_id, 
        parent_id,
        birth_date,
        is_active,
        payment_status
    )
    VALUES (
        p_name, 
        p_team_id, 
        p_admin_id, 
        p_club_id, 
        p_parent_id,
        COALESCE(v_birth_date, NOW()),
        true,
        CASE WHEN p_is_new_trial THEN 'on_trial' ELSE 'not_paid' END
    )
    RETURNING id INTO v_player_id;
    
    -- If we found a parent_children record without a player_id, update it
    IF v_parent_child_id IS NOT NULL THEN
        UPDATE parent_children
        SET player_id = v_player_id
        WHERE id = v_parent_child_id;
    END IF;
    
    -- Return the player ID so it can be used by the caller if needed
    RETURN v_player_id;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.insert_player_for_child(text, uuid, uuid, uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_player_for_child(text, uuid, uuid, uuid, uuid, boolean) TO anon; 