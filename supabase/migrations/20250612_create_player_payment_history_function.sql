-- Create function to get player payment history
CREATE OR REPLACE FUNCTION get_player_payment_history(
    p_player_id UUID,
    p_parent_id UUID,
    p_year INTEGER
)
RETURNS SETOF json AS $$
DECLARE
    result json;
    is_parent_of_player BOOLEAN;
BEGIN
    -- First check if this parent is associated with this player
    SELECT EXISTS (
        SELECT 1 
        FROM parent_children pc 
        WHERE pc.parent_id = p_parent_id 
        AND pc.player_id = p_player_id
    ) INTO is_parent_of_player;
    
    -- If direct relationship exists in parent_children
    IF is_parent_of_player THEN
        -- Get all payment records for this player for the specified year
        FOR result IN
            SELECT 
                json_build_object(
                    'player_id', mp.player_id,
                    'year', mp.year,
                    'month', mp.month,
                    'status', mp.status,
                    'updated_at', mp.updated_at
                )
            FROM 
                monthly_payments mp
            WHERE 
                mp.player_id = p_player_id
                AND mp.year = p_year
            ORDER BY 
                mp.year DESC, mp.month DESC
        LOOP
            RETURN NEXT result;
        END LOOP;
    END IF;

    -- If no direct relationship in parent_children, check via players.parent_id
    IF NOT is_parent_of_player THEN
        -- Check if player has this parent_id
        SELECT EXISTS (
            SELECT 1 
            FROM players p
            WHERE p.id = p_player_id 
            AND p.parent_id = p_parent_id
        ) INTO is_parent_of_player;
        
        IF is_parent_of_player THEN
            -- Get all payment records for this player for the specified year
            FOR result IN
                SELECT 
                    json_build_object(
                        'player_id', mp.player_id,
                        'year', mp.year,
                        'month', mp.month,
                        'status', mp.status,
                        'updated_at', mp.updated_at
                    )
                FROM 
                    monthly_payments mp
                WHERE 
                    mp.player_id = p_player_id
                    AND mp.year = p_year
                ORDER BY 
                    mp.year DESC, mp.month DESC
            LOOP
                RETURN NEXT result;
            END LOOP;
        END IF;
    END IF;
    
    -- If no results found at all, return empty set
    IF NOT FOUND THEN
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 