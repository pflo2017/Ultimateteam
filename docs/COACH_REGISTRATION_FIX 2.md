# Coach Registration Fix

This document explains how to fix the coach login and registration flow in the UltimateTeam app.

## Issue

The coach login and registration flow had several issues:

1. Coaches who had already registered were being prompted to register again
2. Newly created coaches weren't properly completing the registration process
3. The system wasn't properly detecting when a coach had already registered in auth but their user_id wasn't set in the coaches table

## Solution

We've implemented a comprehensive solution by:

1. Creating database functions to reliably update coach records
2. Adding a function to check coach registration status
3. Updating the CoachLoginScreen to use these functions
4. Adding extensive error handling and fallbacks

## How to Apply the Fix

### 1. Apply the Database Functions

Run the following SQL in the Supabase SQL Editor:

```sql
-- Create a function to update coach user_id directly
CREATE OR REPLACE FUNCTION public.update_coach_user_id(
    p_coach_id UUID,
    p_user_id UUID,
    p_email TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated INTEGER := 0;
BEGIN
    -- Log the function call
    RAISE LOG 'update_coach_user_id called with coach_id=%, user_id=%, email=%', p_coach_id, p_user_id, p_email;
    
    -- First try to update by coach ID
    UPDATE coaches
    SET 
        user_id = p_user_id,
        email = COALESCE(p_email, email)
    WHERE id = p_coach_id;
    
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    
    RAISE LOG 'update_coach_user_id: Updated % rows by coach_id', v_updated;
    
    RETURN v_updated;
END;
$$;

-- Create a function to update coach user_id by phone number
CREATE OR REPLACE FUNCTION public.update_coach_user_id_by_phone(
    p_phone_number TEXT,
    p_user_id UUID,
    p_email TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated INTEGER := 0;
BEGIN
    -- Log the function call
    RAISE LOG 'update_coach_user_id_by_phone called with phone=%, user_id=%, email=%', p_phone_number, p_user_id, p_email;
    
    -- Try to update by phone number
    UPDATE coaches
    SET 
        user_id = p_user_id,
        email = COALESCE(p_email, email)
    WHERE phone_number = p_phone_number;
    
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    
    RAISE LOG 'update_coach_user_id_by_phone: Updated % rows by phone', v_updated;
    
    RETURN v_updated;
END;
$$;

-- Add comments to explain the functions
COMMENT ON FUNCTION public.update_coach_user_id IS 'Update coach user_id by coach ID (security definer to bypass RLS)';
COMMENT ON FUNCTION public.update_coach_user_id_by_phone IS 'Update coach user_id by phone number (security definer to bypass RLS)';

-- Grant execute permissions to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.update_coach_user_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_coach_user_id TO anon;
GRANT EXECUTE ON FUNCTION public.update_coach_user_id_by_phone TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_coach_user_id_by_phone TO anon;
```

### 2. Apply the Coach Status Check Function

Run the following SQL in the Supabase SQL Editor:

```sql
-- Function to check coach registration status
CREATE OR REPLACE FUNCTION public.check_coach_registration_status(
    p_phone_number TEXT
)
RETURNS TABLE (
    coach_id UUID,
    coach_name TEXT,
    phone_number TEXT,
    user_id UUID,
    auth_user_id UUID,
    auth_phone TEXT,
    registration_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH auth_data AS (
        SELECT 
            id, 
            phone
        FROM 
            auth.users
        WHERE 
            phone = p_phone_number
            OR phone = REPLACE(p_phone_number, '+', '')
            OR phone = SUBSTRING(p_phone_number FROM 2)
    )
    SELECT 
        c.id AS coach_id,
        c.name AS coach_name,
        c.phone_number,
        c.user_id,
        a.id AS auth_user_id,
        a.phone AS auth_phone,
        CASE
            WHEN c.id IS NULL THEN 'NO_COACH_FOUND'
            WHEN c.user_id IS NULL AND a.id IS NULL THEN 'NEEDS_REGISTRATION'
            WHEN c.user_id IS NULL AND a.id IS NOT NULL THEN 'AUTH_EXISTS_NEEDS_LINKING'
            WHEN c.user_id IS NOT NULL AND c.user_id = a.id THEN 'FULLY_REGISTERED'
            WHEN c.user_id IS NOT NULL AND a.id IS NULL THEN 'COACH_HAS_USER_ID_BUT_NO_AUTH'
            WHEN c.user_id IS NOT NULL AND c.user_id != a.id THEN 'USER_ID_MISMATCH'
            ELSE 'UNKNOWN'
        END AS registration_status
    FROM 
        coaches c
    LEFT JOIN 
        auth_data a ON TRUE
    WHERE 
        c.phone_number = p_phone_number
        OR c.phone_number = REPLACE(p_phone_number, '+', '')
        OR c.phone_number = SUBSTRING(p_phone_number FROM 2);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_coach_registration_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_coach_registration_status TO anon;

-- Comment on function
COMMENT ON FUNCTION public.check_coach_registration_status IS 'Check registration status of a coach by phone number';
```

### 3. Fix Existing Coaches (Optional)

If you want to fix existing coaches who have auth accounts but no user_id set:

```sql
-- Fix existing coaches with NULL user_id
DO $$
DECLARE
    coach_record RECORD;
    auth_user_id UUID;
BEGIN
    FOR coach_record IN 
        SELECT c.id, c.phone_number, c.email 
        FROM coaches c 
        WHERE c.user_id IS NULL
    LOOP
        -- Try to find matching user in auth.users by phone
        SELECT id INTO auth_user_id
        FROM auth.users
        WHERE phone = coach_record.phone_number
        OR phone = REPLACE(coach_record.phone_number, '+', '')
        OR phone = SUBSTRING(coach_record.phone_number FROM 2)
        LIMIT 1;
        
        IF auth_user_id IS NOT NULL THEN
            RAISE NOTICE 'Fixing coach % with phone % - found auth user %', 
                coach_record.id, coach_record.phone_number, auth_user_id;
                
            -- Update the coach record
            UPDATE coaches
            SET user_id = auth_user_id
            WHERE id = coach_record.id;
        END IF;
    END LOOP;
END;
$$;
```

### 4. Verify the Fix

You can check the status of a coach by running:

```sql
SELECT * FROM check_coach_registration_status('+40700002002');
```

Replace the phone number with the coach's phone number you want to check.

## Testing

After applying the fix, test the following scenarios:

1. Login with an existing coach who already has a user_id
2. Register a new coach who doesn't have a user_id
3. Try logging in with a non-existent coach

## Troubleshooting

If you encounter issues:

1. Check the logs for errors
2. Verify the database functions exist by running: 
   ```sql
   SELECT proname, prosrc FROM pg_proc WHERE proname IN ('update_coach_user_id', 'update_coach_user_id_by_phone', 'check_coach_registration_status');
   ```
3. Check if the coach has a user_id set in the coaches table
4. Verify if the phone number exists in auth.users 