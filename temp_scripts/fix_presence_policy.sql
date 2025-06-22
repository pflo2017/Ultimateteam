-- Fix RLS policy issue
ALTER TABLE activity_presence DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_presence ADD COLUMN IF NOT EXISTS parent_id UUID;
ALTER TABLE activity_presence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Parents can manage presence" ON activity_presence;
DROP POLICY IF EXISTS "Everyone can read presence" ON activity_presence;
CREATE POLICY "Everyone can read presence" ON activity_presence FOR SELECT USING (true);
CREATE POLICY "Everyone can modify presence" ON activity_presence FOR ALL USING (true);
