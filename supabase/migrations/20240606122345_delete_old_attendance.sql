-- Delete attendance records for recurring activities
-- This is necessary before changing the activity_id column type
-- because we can't easily maintain the foreign key constraint

-- First, let's identify recurring activities
WITH recurring_activities AS (
  SELECT id FROM activities WHERE is_repeating = true
)
-- Delete attendance records for these activities
DELETE FROM activity_attendance
WHERE activity_id IN (SELECT id FROM recurring_activities);

-- Now we can safely proceed with the migration 