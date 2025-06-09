-- Create coaches table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.coaches (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    name text not null,
    phone_number text not null,
    access_code text not null unique,
    is_active boolean default true,
    admin_id uuid references auth.users(id) on delete cascade not null
);

-- Enable RLS if not already enabled
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coaches' AND policyname = 'Coaches are viewable by admin who created them') THEN
        CREATE POLICY "Coaches are viewable by admin who created them"
            ON public.coaches FOR SELECT
            USING (auth.uid() = admin_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coaches' AND policyname = 'Coaches are insertable by admin') THEN
        CREATE POLICY "Coaches are insertable by admin"
            ON public.coaches FOR INSERT
            WITH CHECK (auth.uid() = admin_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coaches' AND policyname = 'Coaches are updatable by admin who created them') THEN
        CREATE POLICY "Coaches are updatable by admin who created them"
            ON public.coaches FOR UPDATE
            USING (auth.uid() = admin_id)
            WITH CHECK (auth.uid() = admin_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coaches' AND policyname = 'Coaches are deletable by admin who created them') THEN
        CREATE POLICY "Coaches are deletable by admin who created them"
            ON public.coaches FOR DELETE
            USING (auth.uid() = admin_id);
    END IF;
END $$;

-- Create indexes if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'coaches' AND indexname = 'coaches_admin_id_idx') THEN
        CREATE INDEX coaches_admin_id_idx ON public.coaches(admin_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'coaches' AND indexname = 'coaches_access_code_idx') THEN
        CREATE INDEX coaches_access_code_idx ON public.coaches(access_code);
    END IF;
END $$; 