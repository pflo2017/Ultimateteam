-- Create admin_logs table to track administrative actions
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    target_table TEXT,
    target_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    ip_address TEXT
);

-- Enable RLS
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Master admins can read all logs" ON public.admin_logs
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM master_admins 
        WHERE user_id = auth.uid()
    ));

CREATE POLICY "Master admins can insert logs" ON public.admin_logs
    FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM master_admins 
        WHERE user_id = auth.uid()
    ));

-- Create index for faster queries
CREATE INDEX admin_logs_admin_id_idx ON public.admin_logs(admin_id);
CREATE INDEX admin_logs_target_user_id_idx ON public.admin_logs(target_user_id);
CREATE INDEX admin_logs_created_at_idx ON public.admin_logs(created_at);

COMMENT ON TABLE public.admin_logs IS 'Logs of administrative actions performed by master admins';

-- Add comments for documentation
COMMENT ON COLUMN public.admin_logs.admin_id IS 'The ID of the admin who performed the action';
COMMENT ON COLUMN public.admin_logs.action_type IS 'The type of action performed (e.g., password_reset, user_suspension)';
COMMENT ON COLUMN public.admin_logs.target_user_id IS 'The ID of the user affected by the action, if applicable';
COMMENT ON COLUMN public.admin_logs.target_table IS 'The table affected by the action, if applicable';
COMMENT ON COLUMN public.admin_logs.target_id IS 'The ID of the record affected by the action, if applicable';
COMMENT ON COLUMN public.admin_logs.details IS 'Additional details about the action';
COMMENT ON COLUMN public.admin_logs.ip_address IS 'The IP address from which the action was performed'; 