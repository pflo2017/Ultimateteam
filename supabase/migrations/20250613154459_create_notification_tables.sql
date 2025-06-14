-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('parent', 'coach', 'admin')),
    sender_id UUID,
    sender_type TEXT CHECK (sender_type IN ('system', 'parent', 'coach', 'admin')),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'sent')),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create payment reminder logs table
CREATE TABLE IF NOT EXISTS public.payment_reminder_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL,
    parent_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('coach', 'admin')),
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON public.notifications(recipient_id, recipient_type);
CREATE INDEX IF NOT EXISTS notifications_type_idx ON public.notifications(type);
CREATE INDEX IF NOT EXISTS payment_reminder_logs_player_idx ON public.payment_reminder_logs(player_id);
CREATE INDEX IF NOT EXISTS payment_reminder_logs_parent_idx ON public.payment_reminder_logs(parent_id);

-- Add RLS policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reminder_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins and coaches to insert notifications
CREATE POLICY "Allow admins and coaches to insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = sender_id AND 
    (sender_type = 'admin' OR sender_type = 'coach')
);

-- Allow recipients to read their own notifications
CREATE POLICY "Allow recipients to read their own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
    auth.uid() = recipient_id
);

-- Allow admins and coaches to insert payment reminder logs
CREATE POLICY "Allow admins and coaches to insert payment reminder logs"
ON public.payment_reminder_logs
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = sender_id AND 
    (sender_type = 'admin' OR sender_type = 'coach')
);

-- Grant permissions
GRANT SELECT, INSERT ON public.notifications TO authenticated;
GRANT SELECT, INSERT ON public.payment_reminder_logs TO authenticated;
GRANT SELECT, INSERT ON public.notifications TO service_role;
GRANT SELECT, INSERT ON public.payment_reminder_logs TO service_role;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_as_read(p_notification_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.notifications
    SET status = 'read', updated_at = now()
    WHERE id = p_notification_id
    AND recipient_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 