-- Add player_id column to parent_children table
ALTER TABLE public.parent_children
ADD COLUMN player_id UUID REFERENCES public.players(id) ON DELETE CASCADE;

-- Create index on player_id
CREATE INDEX IF NOT EXISTS parent_children_player_id_idx ON public.parent_children(player_id);

-- Update the insert_player_for_child function to be more flexible
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
        is_active
    )
    VALUES (
        p_name, 
        p_team_id, 
        p_admin_id, 
        p_club_id, 
        p_parent_id,
        v_birth_date,
        true
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
GRANT EXECUTE ON FUNCTION public.insert_player_for_child(text, uuid, uuid, uuid, uuid, boolean) TO anon;
