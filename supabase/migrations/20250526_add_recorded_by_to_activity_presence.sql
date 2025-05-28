-- Add recorded_by column to activity_presence table
ALTER TABLE public.activity_presence
ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES auth.users(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS activity_presence_recorded_by_idx 
ON public.activity_presence(recorded_by);

-- Update RLS policies to allow coaches/admins to record attendance
CREATE POLICY "Coaches can record attendance"
ON public.activity_presence
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    WHERE a.id = activity_id 
    AND t.coach_id IN (
      SELECT id FROM coaches 
      WHERE user_id = auth.uid()
    )
  )
  AND recorded_by = auth.uid()
);

CREATE POLICY "Admins can record attendance"
ON public.activity_presence
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_profiles 
    WHERE user_id = auth.uid()
  )
  AND recorded_by = auth.uid()
);

-- Allow coaches to update attendance they recorded
CREATE POLICY "Coaches can update their attendance records"
ON public.activity_presence
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    WHERE a.id = activity_id 
    AND t.coach_id IN (
      SELECT id FROM coaches 
      WHERE user_id = auth.uid()
    )
  )
  AND recorded_by = auth.uid()
);

-- Allow admins to update any attendance records
CREATE POLICY "Admins can update any attendance records"
ON public.activity_presence
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles 
    WHERE user_id = auth.uid()
  )
); 