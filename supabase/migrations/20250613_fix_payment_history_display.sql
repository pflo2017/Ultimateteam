-- Fix payment history display for parent view
-- This migration consolidates and updates the payment history functions
-- to ensure that the parent view matches the coach view

-- Drop existing functions first
DROP FUNCTION IF EXISTS get_player_payment_history;
DROP FUNCTION IF EXISTS get_parent_payments;

-- Create function to get player payment history
CREATE OR REPLACE FUNCTION get_player_payment_history(
    p_player_id UUID,
    p_parent_id UUID,
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)
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

-- Create function to get parent's children's payment records
CREATE OR REPLACE FUNCTION get_parent_payments(
    p_parent_id UUID,
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    p_month INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)
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