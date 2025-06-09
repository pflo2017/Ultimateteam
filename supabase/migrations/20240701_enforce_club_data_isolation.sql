-- Add club_id to activities table
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE;

-- Set club_id in activities based on team relationship
UPDATE activities a
SET club_id = t.club_id
FROM teams t
WHERE a.team_id = t.id;

-- For activities without a team, set club_id based on creator's admin profile
UPDATE activities a
SET club_id = c.id
FROM admin_profiles ap
JOIN clubs c ON ap.user_id = c.admin_id
WHERE a.club_id IS NULL AND a.created_by = ap.user_id;

-- For activities without a team and not created by admin, set club_id based on coach's club
UPDATE activities a
SET club_id = c.club_id
FROM coach_profiles cp
JOIN coaches c ON cp.user_id = c.id
WHERE a.club_id IS NULL AND a.created_by = cp.user_id;

-- Make club_id NOT NULL after we've populated it
ALTER TABLE activities
ALTER COLUMN club_id SET NOT NULL;

-- Add club_id to activity_attendance table
ALTER TABLE activity_attendance 
ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE;

-- Set club_id in activity_attendance based on activity relationship
UPDATE activity_attendance aa
SET club_id = a.club_id
FROM activities a
WHERE aa.activity_id = a.id;

-- Make club_id NOT NULL after we've populated it
ALTER TABLE activity_attendance
ALTER COLUMN club_id SET NOT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS activities_club_id_idx ON activities(club_id);
CREATE INDEX IF NOT EXISTS activity_attendance_club_id_idx ON activity_attendance(club_id);

-- Create a function to set club_id on new activities based on team_id or user role
CREATE OR REPLACE FUNCTION set_activity_club_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If team_id is provided, get club_id from team
  IF NEW.team_id IS NOT NULL THEN
    SELECT club_id INTO NEW.club_id
    FROM teams
    WHERE id = NEW.team_id;
  END IF;
  
  -- If still no club_id and created by admin, get club_id from admin
  IF NEW.club_id IS NULL THEN
    SELECT c.id INTO NEW.club_id
    FROM clubs c
    WHERE c.admin_id = NEW.created_by
    LIMIT 1;
  END IF;
  
  -- If still no club_id and created by coach, get coach's club_id
  IF NEW.club_id IS NULL THEN
    SELECT c.club_id INTO NEW.club_id
    FROM coaches c
    JOIN coach_profiles cp ON c.id = cp.coach_id
    WHERE cp.user_id = NEW.created_by
    LIMIT 1;
  END IF;
  
  -- Ensure club_id is set
  IF NEW.club_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine club_id for new activity';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to set club_id on new activities
DROP TRIGGER IF EXISTS set_activity_club_id_trigger ON activities;
CREATE TRIGGER set_activity_club_id_trigger
BEFORE INSERT ON activities
FOR EACH ROW
EXECUTE FUNCTION set_activity_club_id();

-- Create a function to set club_id on new activity_attendance records
CREATE OR REPLACE FUNCTION set_attendance_club_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Get club_id from activity
  SELECT club_id INTO NEW.club_id
  FROM activities
  WHERE id = NEW.activity_id;
  
  -- Ensure club_id is set
  IF NEW.club_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine club_id for new attendance record';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to set club_id on new attendance records
DROP TRIGGER IF EXISTS set_attendance_club_id_trigger ON activity_attendance;
CREATE TRIGGER set_attendance_club_id_trigger
BEFORE INSERT ON activity_attendance
FOR EACH ROW
EXECUTE FUNCTION set_attendance_club_id();

-- Update RLS policies for activities to include club-level checks
DROP POLICY IF EXISTS "Anyone can view public activities" ON activities;
CREATE POLICY "Anyone can view public activities within their club" 
  ON activities 
  FOR SELECT 
  USING (
    is_public = TRUE AND
    club_id IN (
      -- For admins, check their club
      SELECT c.id FROM clubs c WHERE c.admin_id = auth.uid()
      UNION
      -- For coaches, check their club
      SELECT c.club_id FROM coaches c 
      JOIN coach_profiles cp ON c.id = cp.coach_id
      WHERE cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Team coaches can view their team's activities" ON activities;
CREATE POLICY "Team coaches can view their team's activities" 
  ON activities 
  FOR SELECT 
  USING (
    team_id IN (
      SELECT team_id FROM coach_profiles WHERE user_id = auth.uid()
    ) AND
    club_id IN (
      SELECT c.club_id FROM coaches c 
      JOIN coach_profiles cp ON c.id = cp.coach_id
      WHERE cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all activities" ON activities;
CREATE POLICY "Admins can view activities in their club" 
  ON activities 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles WHERE user_id = auth.uid()
    ) AND
    club_id IN (
      SELECT c.id FROM clubs c WHERE c.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Coaches can create activities for their teams" ON activities;
CREATE POLICY "Coaches can create activities for their teams in their club" 
  ON activities 
  FOR INSERT 
  WITH CHECK (
    (
      team_id IN (
        SELECT team_id FROM coach_profiles WHERE user_id = auth.uid()
      ) AND
      club_id IN (
        SELECT c.club_id FROM coaches c 
        JOIN coach_profiles cp ON c.id = cp.coach_id
        WHERE cp.user_id = auth.uid()
      )
    ) OR
    (
      EXISTS (
        SELECT 1 FROM admin_profiles WHERE user_id = auth.uid()
      ) AND
      club_id IN (
        SELECT c.id FROM clubs c WHERE c.admin_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Coaches can update activities for their teams" ON activities;
CREATE POLICY "Coaches can update activities for their teams in their club" 
  ON activities 
  FOR UPDATE 
  USING (
    (
      team_id IN (
        SELECT team_id FROM coach_profiles WHERE user_id = auth.uid()
      ) AND
      club_id IN (
        SELECT c.club_id FROM coaches c 
        JOIN coach_profiles cp ON c.id = cp.coach_id
        WHERE cp.user_id = auth.uid()
      )
    ) OR
    (
      created_by = auth.uid() AND
      club_id IN (
        SELECT c.club_id FROM coaches c 
        JOIN coach_profiles cp ON c.id = cp.coach_id
        WHERE cp.user_id = auth.uid()
      )
    ) OR
    (
      EXISTS (
        SELECT 1 FROM admin_profiles WHERE user_id = auth.uid()
      ) AND
      club_id IN (
        SELECT c.id FROM clubs c WHERE c.admin_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Coaches can delete activities for their teams" ON activities;
CREATE POLICY "Coaches can delete activities for their teams in their club" 
  ON activities 
  FOR DELETE 
  USING (
    (
      team_id IN (
        SELECT team_id FROM coach_profiles WHERE user_id = auth.uid()
      ) AND
      club_id IN (
        SELECT c.club_id FROM coaches c 
        JOIN coach_profiles cp ON c.id = cp.coach_id
        WHERE cp.user_id = auth.uid()
      )
    ) OR
    (
      created_by = auth.uid() AND
      club_id IN (
        SELECT c.club_id FROM coaches c 
        JOIN coach_profiles cp ON c.id = cp.coach_id
        WHERE cp.user_id = auth.uid()
      )
    ) OR
    (
      EXISTS (
        SELECT 1 FROM admin_profiles WHERE user_id = auth.uid()
      ) AND
      club_id IN (
        SELECT c.id FROM clubs c WHERE c.admin_id = auth.uid()
      )
    )
  );

-- Update RLS policies for activity_attendance to include club-level checks
ALTER TABLE activity_attendance ENABLE ROW LEVEL SECURITY;

-- Create policy for attendance records
CREATE POLICY "Access only to attendance records in user's club"
  ON activity_attendance
  FOR ALL
  USING (
    club_id IN (
      -- For admins, check their club
      SELECT c.id FROM clubs c WHERE c.admin_id = auth.uid()
      UNION
      -- For coaches, check their club
      SELECT c.club_id FROM coaches c 
      JOIN coach_profiles cp ON c.id = cp.coach_id
      WHERE cp.user_id = auth.uid()
    )
  ); 