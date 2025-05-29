-- Create activity_attendance table for recording actual attendance during activities
CREATE TABLE IF NOT EXISTS public.activity_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent')),
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (activity_id, player_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS activity_attendance_activity_id_idx ON activity_attendance(activity_id);
CREATE INDEX IF NOT EXISTS activity_attendance_player_id_idx ON activity_attendance(player_id);
CREATE INDEX IF NOT EXISTS activity_attendance_recorded_by_idx ON activity_attendance(recorded_by);
CREATE INDEX IF NOT EXISTS activity_attendance_recorded_at_idx ON activity_attendance(recorded_at);

-- Enable RLS
ALTER TABLE activity_attendance ENABLE ROW LEVEL SECURITY;

-- Allow coaches to view attendance for their team's activities
CREATE POLICY "Coaches can view attendance"
ON activity_attendance
FOR SELECT
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
);

-- Allow coaches to record attendance for their team's activities
CREATE POLICY "Coaches can record attendance"
ON activity_attendance
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

-- Allow coaches to update attendance they recorded
CREATE POLICY "Coaches can update their attendance records"
ON activity_attendance
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

-- Allow admins to manage all attendance records
CREATE POLICY "Admins can manage all attendance"
ON activity_attendance
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles 
    WHERE user_id = auth.uid()
  )
);

-- Allow parents to view attendance for their children
CREATE POLICY "Parents can view their children's attendance"
ON activity_attendance
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM parent_children pc
    WHERE pc.player_id = activity_attendance.player_id 
    AND pc.parent_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER set_activity_attendance_updated_at
  BEFORE UPDATE ON activity_attendance
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at); 