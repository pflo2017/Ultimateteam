-- Create the monthly_payments table
CREATE TABLE IF NOT EXISTS monthly_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid', 'unpaid')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Ensure we have only one record per player per month/year
  UNIQUE (player_id, year, month)
);

-- Add RLS policies
ALTER TABLE monthly_payments ENABLE ROW LEVEL SECURITY;

-- Policy for coaches to read payments for their teams
CREATE POLICY coach_read_payments ON monthly_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players p
      JOIN team_coaches tc ON p.team_id = tc.team_id
      WHERE p.id = monthly_payments.player_id
      AND tc.coach_id = auth.uid()
    )
  );

-- Policy for coaches to update payments for their teams
CREATE POLICY coach_update_payments ON monthly_payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM players p
      JOIN team_coaches tc ON p.team_id = tc.team_id
      WHERE p.id = monthly_payments.player_id
      AND tc.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players p
      JOIN team_coaches tc ON p.team_id = tc.team_id
      WHERE p.id = monthly_payments.player_id
      AND tc.coach_id = auth.uid()
    )
  );

-- Policy for coaches to insert payments for their teams
CREATE POLICY coach_insert_payments ON monthly_payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players p
      JOIN team_coaches tc ON p.team_id = tc.team_id
      WHERE p.id = monthly_payments.player_id
      AND tc.coach_id = auth.uid()
    )
  );

-- Policy for admins to read all payments
CREATE POLICY admin_read_payments ON monthly_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Function to initialize payment records for a new month
CREATE OR REPLACE FUNCTION initialize_monthly_payments(p_year INT, p_month INT)
RETURNS VOID AS $$
BEGIN
  -- Insert records for all active players who don't have a record for this month
  INSERT INTO monthly_payments (player_id, year, month, status)
  SELECT id, p_year, p_month, 'unpaid'
  FROM players
  WHERE is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM monthly_payments mp
    WHERE mp.player_id = players.id
    AND mp.year = p_year
    AND mp.month = p_month
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically set the updated_by field
CREATE OR REPLACE FUNCTION set_monthly_payment_updated_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_monthly_payment_updated_by
BEFORE INSERT OR UPDATE ON monthly_payments
FOR EACH ROW
EXECUTE FUNCTION set_monthly_payment_updated_by(); 