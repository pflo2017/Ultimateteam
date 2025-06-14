-- Create post_views table to track which users have seen which posts
CREATE TABLE IF NOT EXISTS public.post_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seen_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Enable RLS
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own view
CREATE POLICY "Users can mark post as seen" ON public.post_views
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Anyone can read post_views
CREATE POLICY "Anyone can read post_views" ON public.post_views
    FOR SELECT USING (true); 