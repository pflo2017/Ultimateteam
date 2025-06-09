-- Create activities table
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  duration TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('training', 'game', 'tournament', 'other')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  additional_info TEXT,
  private_notes TEXT,
  invitation_setting TEXT,
  rsvp_by TIMESTAMPTZ,
  slots INTEGER,
  -- Repeat schedule fields
  is_repeating BOOLEAN DEFAULT FALSE,
  repeat_type TEXT CHECK (repeat_type IN ('daily', 'weekly', 'monthly')),
  repeat_days INTEGER[], -- Array of days of the week (0 = Sunday, 1 = Monday, etc.)
  repeat_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create activity_attendees table for tracking RSVPs
CREATE TABLE IF NOT EXISTS activity_attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('yes', 'no', 'maybe')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (activity_id, user_id)
);

-- Create RLS policies
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_attendees ENABLE ROW LEVEL SECURITY;

-- All users can view public activities
CREATE POLICY "Anyone can view public activities" 
  ON activities 
  FOR SELECT 
  USING (is_public = TRUE);

-- Team coaches can view their team's activities (even private ones)
CREATE POLICY "Team coaches can view their team's activities" 
  ON activities 
  FOR SELECT 
  USING (
    team_id IN (
      SELECT team_id FROM coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Admin can view all activities
CREATE POLICY "Admins can view all activities" 
  ON activities 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles WHERE user_id = auth.uid()
    )
  );

-- Coaches can create activities for their teams
CREATE POLICY "Coaches can create activities for their teams" 
  ON activities 
  FOR INSERT 
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM coach_profiles WHERE user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM admin_profiles WHERE user_id = auth.uid()
    )
  );

-- Coaches can update activities for their teams
CREATE POLICY "Coaches can update activities for their teams" 
  ON activities 
  FOR UPDATE 
  USING (
    team_id IN (
      SELECT team_id FROM coach_profiles WHERE user_id = auth.uid()
    ) OR
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM admin_profiles WHERE user_id = auth.uid()
    )
  );

-- Coaches can delete activities for their teams
CREATE POLICY "Coaches can delete activities for their teams" 
  ON activities 
  FOR DELETE 
  USING (
    team_id IN (
      SELECT team_id FROM coach_profiles WHERE user_id = auth.uid()
    ) OR
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM admin_profiles WHERE user_id = auth.uid()
    )
  );

-- Create functions for updating timestamps
CREATE OR REPLACE FUNCTION update_modified_column() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updating timestamps
CREATE TRIGGER update_activities_modtime
BEFORE UPDATE ON activities
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_activity_attendees_modtime
BEFORE UPDATE ON activity_attendees
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS activities_team_id_idx ON activities(team_id);
CREATE INDEX IF NOT EXISTS activities_created_by_idx ON activities(created_by);
CREATE INDEX IF NOT EXISTS activities_start_time_idx ON activities(start_time);
CREATE INDEX IF NOT EXISTS activity_attendees_activity_id_idx ON activity_attendees(activity_id);
CREATE INDEX IF NOT EXISTS activity_attendees_user_id_idx ON activity_attendees(user_id); 