-- Drop the existing teams table if it exists
DROP TABLE IF EXISTS public.teams;

-- Now run the create table command from schema.sql
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