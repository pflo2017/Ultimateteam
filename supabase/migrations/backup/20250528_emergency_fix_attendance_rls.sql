-- Create direct policy for the specific coach ID
CREATE OR REPLACE POLICY "Emergency direct coach fix"
ON activity_attendance
FOR INSERT
TO authenticated
WITH CHECK (
  recorded_by = '32efbe39-15ca-417a-b340-4d7eb4324db6'
); 