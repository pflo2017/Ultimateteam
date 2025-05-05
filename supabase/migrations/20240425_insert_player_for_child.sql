-- Create a function to insert a player for a child
CREATE OR REPLACE FUNCTION public.insert_player_for_child(
    p_name text,
    p_team_id uuid,
    p_admin_id uuid,
    p_club_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.players (name, team_id, admin_id, club_id, is_active)
    VALUES (p_name, p_team_id, p_admin_id, p_club_id, true);
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.insert_player_for_child(text, uuid, uuid, uuid) TO anon; 