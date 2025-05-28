-- Create direct coach policy
CREATE OR REPLACE POLICY "Direct coach can record attendance"
ON activity_attendance
FOR INSERT
TO authenticated
WITH CHECK (
  recorded_by = '32efbe39-15ca-417a-b340-4d7eb4324db6'
); 