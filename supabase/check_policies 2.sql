-- Check existing RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'parents';

-- Check table owner and permissions
SELECT relname, relowner::regrole, relacl
FROM pg_class
WHERE relname = 'parents';

-- Check if RLS is enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'parents'; 