-- Add security policies to backup tables
CREATE POLICY "Only super admins can access players_backup" 
ON public.players_backup
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.master_admins ma 
        WHERE ma.user_id = auth.uid() AND ma.is_super_admin = true
    )
);

CREATE POLICY "Only super admins can access players_payment_backup" 
ON public.players_payment_backup
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.master_admins ma 
        WHERE ma.user_id = auth.uid() AND ma.is_super_admin = true
    )
); 