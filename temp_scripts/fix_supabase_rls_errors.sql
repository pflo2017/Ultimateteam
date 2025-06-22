-- Enable Row Level Security (RLS) on activity_attendance table
ALTER TABLE public.activity_attendance ENABLE ROW LEVEL SECURITY;

-- Enable RLS on backup tables
ALTER TABLE public.players_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_payments_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players_column_backup ENABLE ROW LEVEL SECURITY;

-- Create basic policies for backup tables to prevent access
-- (these are backup tables, so we should restrict access)
CREATE POLICY "Only admins can access backup tables - players_backup"
ON public.players_backup
FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Only admins can access backup tables - player_payments_backup"
ON public.player_payments_backup
FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Only admins can access backup tables - players_column_backup"
ON public.players_column_backup
FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Note: We don't need to create policies for activity_attendance
-- since the error message shows they already exist, just RLS needs to be enabled 