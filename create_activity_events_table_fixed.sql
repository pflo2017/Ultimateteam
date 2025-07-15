-- Create activity_events table for storing match events (goals, assists, cards, etc.)
CREATE TABLE IF NOT EXISTS public.activity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('goal', 'assist', 'yellow_card', 'red_card', 'man_of_the_match')),
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  assist_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  minute INTEGER CHECK (minute >= 1 AND minute <= 90),
  half TEXT CHECK (half IN ('first', 'second', 'extra_time')),
  man_of_the_match_id UUID REFERENCES players(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS activity_events_activity_id_idx ON activity_events(activity_id);
CREATE INDEX IF NOT EXISTS activity_events_player_id_idx ON activity_events(player_id);
CREATE INDEX IF NOT EXISTS activity_events_event_type_idx ON activity_events(event_type);
CREATE INDEX IF NOT EXISTS activity_events_created_by_idx ON activity_events(created_by);

-- Enable Row Level Security
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for coaches
CREATE POLICY "Coaches can view events for their team's activities"
ON activity_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    WHERE a.id::text = activity_events.activity_id
    AND t.coach_id IN (
      SELECT id FROM coaches WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Coaches can create events for their team's activities"
ON activity_events
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    WHERE a.id::text = activity_events.activity_id
    AND t.coach_id IN (
      SELECT id FROM coaches WHERE user_id = auth.uid()
    )
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Coaches can update events for their team's activities"
ON activity_events
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    WHERE a.id::text = activity_events.activity_id
    AND t.coach_id IN (
      SELECT id FROM coaches WHERE user_id = auth.uid()
    )
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Coaches can delete events for their team's activities"
ON activity_events
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    WHERE a.id::text = activity_events.activity_id
    AND t.coach_id IN (
      SELECT id FROM coaches WHERE user_id = auth.uid()
    )
  )
  AND created_by = auth.uid()
);

-- Create RLS policies for admins (read-only access to all events in their club)
CREATE POLICY "Admins can view all events in their club"
ON activity_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN clubs c ON a.club_id = c.id
    WHERE a.id::text = activity_events.activity_id
    AND c.admin_id = auth.uid()
  )
);

-- Create RLS policies for parents (read-only access to events for their children's activities)
CREATE POLICY "Parents can view events for their children's activities"
ON activity_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN parent_children pc ON pc.team_id = t.id
    WHERE a.id::text = activity_events.activity_id
    AND pc.parent_id = auth.uid()
  )
);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_activity_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating timestamps
CREATE TRIGGER update_activity_events_updated_at
BEFORE UPDATE ON activity_events
FOR EACH ROW
EXECUTE FUNCTION update_activity_events_updated_at();

-- Add comment explaining the table
COMMENT ON TABLE activity_events IS 'Stores match events (goals, assists, cards, man of the match) linked to specific game activities';
COMMENT ON COLUMN activity_events.activity_id IS 'References activities(id) - can be UUID or composite ID for recurring activities';
COMMENT ON COLUMN activity_events.event_type IS 'Type of match event: goal, assist, yellow_card, red_card, man_of_the_match';
COMMENT ON COLUMN activity_events.player_id IS 'Player involved in the event (for goals, cards, etc.)';
COMMENT ON COLUMN activity_events.assist_player_id IS 'Player who provided the assist (for goals)';
COMMENT ON COLUMN activity_events.minute IS 'Minute of the match when event occurred (1-90)';
COMMENT ON COLUMN activity_events.half IS 'Half of the match: first, second, or extra_time';
COMMENT ON COLUMN activity_events.man_of_the_match_id IS 'Player selected as man of the match (for man_of_the_match event type)';
COMMENT ON COLUMN activity_events.metadata IS 'Additional event data in JSON format'; 