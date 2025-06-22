-- Get the exact policy definition
SELECT 
    pg_policy.polname AS policy_name,
    pg_class.relname AS table_name,
    pg_policy.polcmd AS command,
    pg_get_expr(pg_policy.polqual, pg_policy.polrelid) AS using_expression
FROM pg_policy
JOIN pg_class ON pg_policy.polrelid = pg_class.oid
WHERE pg_class.relname = 'monthly_payments'
AND pg_policy.polname = 'parent_read_payments'; 