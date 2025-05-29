-- Create the parent_children table
BEGIN;

-- Create parent_children table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.parent_children (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_id UUID NOT NULL REFERENCES public.parents(id),
    team_id UUID NOT NULL REFERENCES public.teams(id),
    full_name TEXT NOT NULL,
    birth_date TIMESTAMP WITH TIME ZONE NOT NULL,
    medical_visa_status TEXT NOT NULL CHECK (medical_visa_status IN ('valid', 'pending', 'expired')),
    medical_visa_issue_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Create indexes
CREATE INDEX IF NOT EXISTS parent_children_parent_id_idx ON public.parent_children(parent_id);
CREATE INDEX IF NOT EXISTS parent_children_team_id_idx ON public.parent_children(team_id);

-- Enable RLS
ALTER TABLE public.parent_children ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Parents can view their own children"
    ON public.parent_children FOR SELECT
    USING (parent_id IN (SELECT id FROM public.parents WHERE id = auth.uid()));

CREATE POLICY "Parents can insert their own children"
    ON public.parent_children FOR INSERT
    WITH CHECK (parent_id IN (SELECT id FROM public.parents WHERE id = auth.uid()));

CREATE POLICY "Parents can update their own children"
    ON public.parent_children FOR UPDATE
    USING (parent_id IN (SELECT id FROM public.parents WHERE id = auth.uid()))
    WITH CHECK (parent_id IN (SELECT id FROM public.parents WHERE id = auth.uid()));

-- Grant privileges
GRANT ALL ON public.parent_children TO authenticated;
GRANT ALL ON public.parent_children TO service_role;

COMMIT; 