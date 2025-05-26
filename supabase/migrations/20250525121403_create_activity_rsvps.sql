-- Create activity_rsvps table
CREATE TABLE IF NOT EXISTS activity_rsvps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('attending', 'not_attending', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (activity_id, player_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS activity_rsvps_activity_id_idx ON activity_rsvps(activity_id);
CREATE INDEX IF NOT EXISTS activity_rsvps_player_id_idx ON activity_rsvps(player_id);

-- Set up row level security
ALTER TABLE activity_rsvps ENABLE ROW LEVEL SECURITY;

-- Create policies for coaches, parents, and players
CREATE POLICY activity_rsvps_select_policy
  ON activity_rsvps
  FOR SELECT
  USING (
    -- Coaches can see RSVPs for their teams
    EXISTS (
      SELECT 1 FROM activities a
      JOIN teams t ON a.team_id = t.id
      JOIN coach_teams ct ON t.id = ct.team_id
      WHERE a.id = activity_id AND ct.coach_id = auth.uid
    )
    OR
    -- Parents can see RSVPs for their children
    EXISTS (
      SELECT 1 FROM parent_children pc
      WHERE pc.player_id = activity_rsvps.player_id AND pc.parent_id = auth.uid
    )
  );

-- Parents can insert/update RSVPs for their children
CREATE POLICY activity_rsvps_insert_parent_policy
  ON activity_rsvps
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM parent_children pc
      WHERE pc.player_id = activity_rsvps.player_id AND pc.parent_id = auth.uid
    )
  );

CREATE POLICY activity_rsvps_update_parent_policy
  ON activity_rsvps
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM parent_children pc
      WHERE pc.player_id = activity_rsvps.player_id AND pc.parent_id = auth.uid
    )
  );

-- Coaches can manage all RSVPs for their teams
CREATE POLICY activity_rsvps_all_coach_policy
  ON activity_rsvps
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN teams t ON a.team_id = t.id
      JOIN coach_teams ct ON t.id = ct.team_id
      WHERE a.id = activity_id AND ct.coach_id = auth.uid
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER set_activity_rsvps_updated_at
  BEFORE UPDATE ON activity_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- Add function to get RSVP counts for activities
CREATE OR REPLACE FUNCTION get_activity_rsvp_counts(p_activity_id UUID)
RETURNS TABLE (
  attending_count BIGINT,
  not_attending_count BIGINT,
  pending_count BIGINT
) 
LANGUAGE SQL SECURITY DEFINER
AS $$
  SELECT 
    COUNT(*) FILTER (WHERE status = 'attending') AS attending_count,
    COUNT(*) FILTER (WHERE status = 'not_attending') AS not_attending_count,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count
  FROM activity_rsvps
  WHERE activity_id = p_activity_id;
$$;
