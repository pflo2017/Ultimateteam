-- Create the parents table and related functions
BEGIN;

-- Create parents table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.parents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    password TEXT NOT NULL,
    team_id UUID REFERENCES public.teams(id),
    phone_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    UNIQUE(email),
    UNIQUE(phone_number)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS parents_phone_number_idx ON public.parents(phone_number);
CREATE INDEX IF NOT EXISTS parents_email_idx ON public.parents(email);
CREATE INDEX IF NOT EXISTS parents_team_id_idx ON public.parents(team_id);

-- Enable RLS
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Parents can view own data" ON public.parents;
DROP POLICY IF EXISTS "Parents can update own data" ON public.parents;
DROP POLICY IF EXISTS "Anyone can create parent account" ON public.parents;
DROP POLICY IF EXISTS "Admins can view all parents" ON public.parents;
DROP POLICY IF EXISTS "Admins can update parents" ON public.parents;

-- Create policies
CREATE POLICY "Parents can view own data"
    ON public.parents FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Parents can update own data"
    ON public.parents FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Anyone can create parent account"
    ON public.parents FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can view all parents"
    ON public.parents FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.clubs WHERE clubs.admin_id = auth.uid()));

CREATE POLICY "Admins can update parents"
    ON public.parents FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.clubs WHERE clubs.admin_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.clubs WHERE clubs.admin_id = auth.uid()));

-- Create helper functions
CREATE OR REPLACE FUNCTION public.verify_parent_phone(parent_phone text)
RETURNS boolean AS $$
BEGIN
    UPDATE public.parents
    SET phone_verified = true
    WHERE phone_number = parent_phone;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_parent_phone(phone text)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.parents
        WHERE phone_number = phone
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.verify_parent_password(parent_phone text, parent_password text)
RETURNS UUID AS $$
DECLARE
    parent_id UUID;
BEGIN
    SELECT id INTO parent_id
    FROM public.parents
    WHERE phone_number = parent_phone
    AND password = parent_password
    AND is_active = true;
    RETURN parent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant privileges
GRANT ALL ON public.parents TO authenticated;
GRANT ALL ON public.parents TO service_role;

GRANT EXECUTE ON FUNCTION public.verify_parent_phone TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_parent_phone TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_parent_password TO authenticated, service_role;

COMMIT; 