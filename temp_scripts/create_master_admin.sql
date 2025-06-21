-- First, check if the master_admins table exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'master_admins') THEN
        -- Create master_admins table if it doesn't exist
        CREATE TABLE master_admins (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES auth.users(id) NOT NULL,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          is_super_admin BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
        
        -- Enable RLS
        ALTER TABLE master_admins ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        CREATE POLICY "Super admins can manage master admins" ON master_admins
          FOR ALL USING (
            EXISTS (
              SELECT 1 FROM master_admins ma 
              WHERE ma.user_id = auth.uid() AND ma.is_super_admin = true
            )
          );
          
        CREATE POLICY "All master admins can view other master admins" ON master_admins
          FOR SELECT USING (
            EXISTS (
              SELECT 1 FROM master_admins ma 
              WHERE ma.user_id = auth.uid()
            )
          );
    END IF;
END $$;

-- Add existing user to master_admins table
INSERT INTO master_admins (user_id, email, name, is_super_admin)
SELECT id, email, 'Master Admin', true
FROM auth.users
WHERE email = 'master.florinp@gmail.com'
ON CONFLICT (email) DO UPDATE
SET is_super_admin = true; 