-- Create a function to insert a player for a child
CREATE OR REPLACE FUNCTION public.insert_player_for_child(
    p_name text,
    p_team_id uuid,
    p_admin_id uuid,
    p_club_id uuid,
    p_parent_id uuid,
    p_is_new_trial boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_birth_date timestamp with time zone;
BEGIN
    -- Get birth_date from parent_children table
    SELECT birth_date INTO v_birth_date
    FROM parent_children
    WHERE parent_id = p_parent_id
    AND LOWER(full_name) = LOWER(p_name)
    AND is_active = true;

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
    );
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.insert_player_for_child(text, uuid, uuid, uuid, uuid, boolean) TO anon; 