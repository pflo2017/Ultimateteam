-- Safe RLS Policy Fix Script
-- This script safely fixes auth_rls_initplan warnings one policy at a time
-- Each policy fix is wrapped in its own transaction

-- Helper function to safely update policies
CREATE OR REPLACE FUNCTION fix_rls_policy(
  schema_name TEXT,
  table_name TEXT,
  policy_name TEXT
) RETURNS TEXT AS $$
DECLARE
  policy_exists BOOLEAN;
  policy_def TEXT;
  using_clause TEXT;
  check_clause TEXT;
  cmd TEXT;
  result TEXT;
BEGIN
  -- Check if policy exists
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = schema_name 
    AND tablename = table_name 
    AND policyname = policy_name
  ) INTO policy_exists;
  
  IF NOT policy_exists THEN
    RETURN 'Policy does not exist: ' || schema_name || '.' || table_name || ' - ' || policy_name;
  END IF;
  
  -- Get policy details
  SELECT 
    pg_policies.cmd,
    pg_policies.qual,
    pg_policies.with_check
  INTO 
    cmd,
    using_clause,
    check_clause
  FROM pg_policies
  WHERE schemaname = schema_name 
  AND tablename = table_name 
  AND policyname = policy_name;
  
  -- Replace auth.uid() with (SELECT auth.uid()) in USING clause if it exists
  IF using_clause IS NOT NULL AND using_clause LIKE '%auth.uid()%' THEN
    using_clause := replace(using_clause, 'auth.uid()', '(SELECT auth.uid())');
  END IF;
  
  -- Replace auth.uid() with (SELECT auth.uid()) in WITH CHECK clause if it exists
  IF check_clause IS NOT NULL AND check_clause LIKE '%auth.uid()%' THEN
    check_clause := replace(check_clause, 'auth.uid()', '(SELECT auth.uid())');
  END IF;
  
  -- Drop and recreate the policy with optimized auth calls
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_name) || ' ON ' || quote_ident(schema_name) || '.' || quote_ident(table_name);
    
    -- Handle different policy types correctly
    IF cmd = 'INSERT' THEN
      -- INSERT policies might only have WITH CHECK and no USING
      IF check_clause IS NOT NULL THEN
        IF using_clause IS NOT NULL THEN
          EXECUTE 'CREATE POLICY ' || quote_ident(policy_name) || ' ON ' || quote_ident(schema_name) || '.' || quote_ident(table_name) || 
                ' FOR ' || cmd || ' USING (' || using_clause || ') WITH CHECK (' || check_clause || ')';
        ELSE
          EXECUTE 'CREATE POLICY ' || quote_ident(policy_name) || ' ON ' || quote_ident(schema_name) || '.' || quote_ident(table_name) || 
                ' FOR ' || cmd || ' WITH CHECK (' || check_clause || ')';
        END IF;
      ELSE
        RETURN 'Error: INSERT policy without WITH CHECK clause: ' || schema_name || '.' || table_name || ' - ' || policy_name;
      END IF;
    ELSE
      -- Other policy types
      IF using_clause IS NOT NULL THEN
        IF check_clause IS NOT NULL THEN
          EXECUTE 'CREATE POLICY ' || quote_ident(policy_name) || ' ON ' || quote_ident(schema_name) || '.' || quote_ident(table_name) || 
                ' FOR ' || cmd || ' USING (' || using_clause || ') WITH CHECK (' || check_clause || ')';
        ELSE
          EXECUTE 'CREATE POLICY ' || quote_ident(policy_name) || ' ON ' || quote_ident(schema_name) || '.' || quote_ident(table_name) || 
                ' FOR ' || cmd || ' USING (' || using_clause || ')';
        END IF;
      ELSE
        RETURN 'Error: Policy without USING clause: ' || schema_name || '.' || table_name || ' - ' || policy_name;
      END IF;
    END IF;
    
    result := 'Successfully fixed policy: ' || schema_name || '.' || table_name || ' - ' || policy_name;
    RETURN result;
  EXCEPTION WHEN OTHERS THEN
    result := 'Error fixing policy: ' || schema_name || '.' || table_name || ' - ' || policy_name || '. Error: ' || SQLERRM;
    RETURN result;
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to fix all policies with auth.uid() calls
CREATE OR REPLACE FUNCTION fix_all_auth_policies() RETURNS SETOF TEXT AS $$
DECLARE
  policy_record RECORD;
  result TEXT;
BEGIN
  -- Loop through all policies that directly use auth functions
  FOR policy_record IN 
    SELECT 
      schemaname, 
      tablename, 
      policyname
    FROM 
      pg_policies
    WHERE 
      qual LIKE '%auth.uid()%' OR 
      with_check LIKE '%auth.uid()%'
    ORDER BY 
      tablename, policyname
  LOOP
    -- Fix each policy in its own transaction
    BEGIN
      result := fix_rls_policy(policy_record.schemaname, policy_record.tablename, policy_record.policyname);
      RETURN NEXT result;
    EXCEPTION WHEN OTHERS THEN
      result := 'Error in transaction for policy: ' || policy_record.schemaname || '.' || policy_record.tablename || ' - ' || policy_record.policyname || '. Error: ' || SQLERRM;
      RETURN NEXT result;
    END;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to fix all policies
SELECT * FROM fix_all_auth_policies(); 