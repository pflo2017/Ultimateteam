-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_parent_payments;

-- Create function to get parent's children's payment records
CREATE OR REPLACE FUNCTION get_parent_payments(
    p_parent_id UUID,
    p_year INTEGER,
    p_month INTEGER
)
RETURNS SETOF json AS $$
DECLARE
    result json;
BEGIN
    -- First try to get payment records directly from the monthly_payments table
    -- for players where this parent is linked via the parent_children table
    FOR result IN
        SELECT 
            json_build_object(
                'player_id', mp.player_id,
                'status', mp.status,
                'updated_at', mp.updated_at
            )
        FROM 
            monthly_payments mp
        JOIN 
            parent_children pc ON mp.player_id = pc.player_id
        WHERE 
            pc.parent_id = p_parent_id
            AND pc.is_active = true
            AND mp.year = p_year
            AND mp.month = p_month
    LOOP
        RETURN NEXT result;
    END LOOP;
    
    -- If no results found with the above query, try using players.parent_id
    IF NOT FOUND THEN
        FOR result IN
            SELECT 
                json_build_object(
                    'player_id', mp.player_id,
                    'status', mp.status,
                    'updated_at', mp.updated_at
                )
            FROM 
                monthly_payments mp
            JOIN 
                players p ON mp.player_id = p.id
            WHERE 
                p.parent_id = p_parent_id
                AND p.is_active = true
                AND mp.year = p_year
                AND mp.month = p_month
        LOOP
            RETURN NEXT result;
        END LOOP;
    END IF;
    
    -- If still no results, get all players linked to this parent
    -- and return placeholders for those without payment records
    IF NOT FOUND THEN
        -- Get all active players linked to this parent via parent_children
        FOR result IN
            SELECT 
                json_build_object(
                    'player_id', pc.player_id,
                    'status', COALESCE(mp.status, 'not_paid'),
                    'updated_at', COALESCE(mp.updated_at, NULL)
                )
            FROM 
                parent_children pc
            LEFT JOIN
                monthly_payments mp ON pc.player_id = mp.player_id 
                                    AND mp.year = p_year 
                                    AND mp.month = p_month
            WHERE 
                pc.parent_id = p_parent_id
                AND pc.is_active = true
        LOOP
            RETURN NEXT result;
        END LOOP;
        
        -- Also get players directly linked via players.parent_id
        FOR result IN
            SELECT 
                json_build_object(
                    'player_id', p.id,
                    'status', COALESCE(mp.status, 'not_paid'),
                    'updated_at', COALESCE(mp.updated_at, NULL)
                )
            FROM 
                players p
            LEFT JOIN
                monthly_payments mp ON p.id = mp.player_id 
                                    AND mp.year = p_year 
                                    AND mp.month = p_month
            WHERE 
                p.parent_id = p_parent_id
                AND p.is_active = true
                AND NOT EXISTS (
                    SELECT 1 FROM parent_children pc 
                    WHERE pc.player_id = p.id AND pc.parent_id = p_parent_id
                )
        LOOP
            RETURN NEXT result;
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 