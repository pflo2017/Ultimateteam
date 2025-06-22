-- Add user_id column to coaches table if it doesn't exist
ALTER TABLE public.coaches
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create an index on the user_id column for faster lookups
CREATE INDEX IF NOT EXISTS coaches_user_id_idx ON public.coaches(user_id);

-- Explain the purpose of the change with a comment
COMMENT ON COLUMN public.coaches.user_id IS 'The auth.users ID of the coach. Used for authentication and RLS policies.';

-- Check if we need to update the RLS policies for the activity_attendance table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'activity_attendance'
        AND policyname = 'Coaches can record attendance'
    ) THEN
        -- Drop existing policies
        DROP POLICY IF EXISTS "Coaches can record attendance" ON activity_attendance;
        DROP POLICY IF EXISTS "Coaches can update their attendance records" ON activity_attendance;
        DROP POLICY IF EXISTS "Coaches can delete attendance" ON activity_attendance;

        -- Recreate the policies with the correct conditions
        CREATE POLICY "Coaches can record attendance"
        ON activity_attendance
        FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM activities a
            JOIN teams t ON a.team_id = t.id
            JOIN coaches c ON t.coach_id = c.id
            WHERE a.id = activity_attendance.activity_id
            AND c.user_id = auth.uid()
            AND c.is_active = true
          )
          AND recorded_by = auth.uid()
        );

        CREATE POLICY "Coaches can update their attendance records"
        ON activity_attendance
        FOR UPDATE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM activities a
            JOIN teams t ON a.team_id = t.id
            JOIN coaches c ON t.coach_id = c.id
            WHERE a.id = activity_attendance.activity_id
            AND c.user_id = auth.uid()
            AND c.is_active = true
          )
          AND recorded_by = auth.uid()
        );

        CREATE POLICY "Coaches can delete attendance"
        ON activity_attendance
        FOR DELETE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM activities a
            JOIN teams t ON a.team_id = t.id
            JOIN coaches c ON t.coach_id = c.id
            WHERE a.id = activity_attendance.activity_id
            AND c.user_id = auth.uid()
            AND c.is_active = true
          )
          AND recorded_by = auth.uid()
        );
    END IF;
END $$; 