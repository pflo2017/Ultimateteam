-- Drop any existing policy that might be causing issues
DROP POLICY IF EXISTS parents_update_own on parents;

-- Create a policy to allow parents to update their own data
CREATE POLICY parents_update_own ON parents
    FOR UPDATE
    USING (id = auth.uid());

-- Grant explicit update permission on the email column
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
GRANT UPDATE (email, name) ON parents TO authenticated; 