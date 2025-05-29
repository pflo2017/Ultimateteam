-- Update RLS policy for posts table to allow coaches to create posts
CREATE POLICY "Allow coaches to insert posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM coaches WHERE coaches.user_id = auth.uid()));
