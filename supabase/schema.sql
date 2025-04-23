-- Create admin_profiles table
CREATE TABLE IF NOT EXISTS admin_profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    club_name TEXT NOT NULL,
    club_location TEXT NOT NULL,
    admin_name TEXT NOT NULL,
    club_logo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create RLS (Row Level Security) policies
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

-- Policy for viewing admin profiles (only authenticated users can view)
CREATE POLICY "View admin profiles" ON admin_profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy for inserting admin profiles (users can only insert their own profile)
CREATE POLICY "Create own admin profile" ON admin_profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Policy for updating admin profiles (users can only update their own profile)
CREATE POLICY "Update own admin profile" ON admin_profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy for deleting admin profiles (users can only delete their own profile)
CREATE POLICY "Delete own admin profile" ON admin_profiles
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Create storage bucket for club logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('club-logos', 'club-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for club logos bucket
CREATE POLICY "Public Access" ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'club-logos');

CREATE POLICY "Authenticated users can upload club logos" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'club-logos' 
        AND (LOWER(file_ext) = '.jpg' OR LOWER(file_ext) = '.jpeg' OR LOWER(file_ext) = '.png')
        AND file_size < 2097152
    );

CREATE POLICY "Users can update their own club logos" ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'club-logos' AND owner = auth.uid())
    WITH CHECK (bucket_id = 'club-logos' AND owner = auth.uid());

CREATE POLICY "Users can delete their own club logos" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'club-logos' AND owner = auth.uid());

-- Create function to handle updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER handle_updated_at
    BEFORE UPDATE ON admin_profiles
    FOR EACH ROW
    EXECUTE PROCEDURE handle_updated_at();

-- Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    name text not null,
    access_code text not null,
    admin_id uuid references auth.users(id) on delete cascade not null,
    is_active boolean default true
);

-- Set up Row Level Security (RLS)
alter table public.teams enable row level security;

-- Create policies
create policy "Teams are viewable by admin who created them" on public.teams
    for select using (auth.uid() = admin_id);

create policy "Teams are insertable by authenticated admins" on public.teams
    for insert with check (auth.role() = 'authenticated');

create policy "Teams are updatable by admin who created them" on public.teams
    for update using (auth.uid() = admin_id);

create policy "Teams are deletable by admin who created them" on public.teams
    for delete using (auth.uid() = admin_id);

-- Create indexes
create index teams_admin_id_idx on public.teams(admin_id);
create unique index teams_access_code_idx on public.teams(access_code); 