-- Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Emergency direct coach fix" ON activity_attendance;

-- Create a new policy with the correct syntax
CREATE POLICY "Emergency direct coach fix" 
ON activity_attendance
FOR INSERT
TO authenticated
WITH CHECK (
  recorded_by::text = '32efbe39-15ca-417a-b340-4d7eb4324db6'
);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON activity_attendance TO authenticated; 