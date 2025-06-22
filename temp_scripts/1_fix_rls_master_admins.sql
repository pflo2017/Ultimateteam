-- Fix RLS for master_admins table (has policy but RLS disabled)
ALTER TABLE public.master_admins ENABLE ROW LEVEL SECURITY; 