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
BEGIN
    INSERT INTO public.players (
        name, 
        team_id, 
        admin_id, 
        club_id, 
        is_active, 
        parent_id,
        medical_visa_status, 
        payment_status
    )
    VALUES (
        p_name, 
        p_team_id, 
        p_admin_id, 
        p_club_id, 
        true, 
        p_parent_id,
        'pending', -- Use a valid medical_visa_status
        CASE WHEN p_is_new_trial THEN 'on_trial' ELSE 'select_status' END -- Set payment status based on trial flag
    );
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.insert_player_for_child(text, uuid, uuid, uuid, uuid, boolean) TO anon; 