-- Enable RLS on backup tables
ALTER TABLE public.players_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players_payment_backup ENABLE ROW LEVEL SECURITY; 