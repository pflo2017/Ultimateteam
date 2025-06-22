-- Fix Duplicate Indexes
-- This script removes duplicate indexes to improve database performance

-- Enable transaction for safety
BEGIN;

-- Function to identify duplicate indexes
CREATE OR REPLACE FUNCTION find_duplicate_indexes() RETURNS TABLE(
    schema_name text,
    table_name text,
    index_name text,
    duplicate_index_name text,
    index_columns text,
    duplicate_index_columns text
) AS $$
BEGIN
    RETURN QUERY
    WITH index_list AS (
        SELECT
            schemaname::text AS schema_name,
            tablename::text AS table_name,
            indexname::text AS index_name,
            array_agg(attname::text ORDER BY attnum) AS columns,
            indexdef::text AS index_def
        FROM
            pg_indexes
        JOIN
            pg_attribute ON pg_indexes.tablename = pg_attribute.attrelid::regclass::text
        JOIN
            pg_index ON pg_attribute.attrelid = pg_index.indrelid
            AND pg_attribute.attnum = ANY(pg_index.indkey)
        JOIN
            pg_class ON pg_index.indexrelid = pg_class.oid
            AND pg_indexes.indexname = pg_class.relname
        WHERE
            schemaname NOT IN ('pg_catalog', 'information_schema')
        GROUP BY
            schemaname, tablename, indexname, indexdef
    )
    SELECT
        i1.schema_name,
        i1.table_name,
        i1.index_name,
        i2.index_name AS duplicate_index_name,
        array_to_string(i1.columns, ', ') AS index_columns,
        array_to_string(i2.columns, ', ') AS duplicate_index_columns
    FROM
        index_list i1
    JOIN
        index_list i2 ON i1.schema_name = i2.schema_name
        AND i1.table_name = i2.table_name
        AND i1.columns::text = i2.columns::text
        AND i1.index_name < i2.index_name
    ORDER BY
        i1.schema_name, i1.table_name, i1.index_name;
END;
$$ LANGUAGE plpgsql;

-- Find and display duplicate indexes
SELECT * FROM find_duplicate_indexes();

-- Remove known duplicate indexes
DROP INDEX IF EXISTS admin_profiles_user_id_idx;

-- Remove other duplicate indexes found by the function
DO $$
DECLARE
    duplicate_record RECORD;
BEGIN
    FOR duplicate_record IN SELECT * FROM find_duplicate_indexes() LOOP
        RAISE NOTICE 'Dropping duplicate index: %.%', 
            duplicate_record.schema_name, 
            duplicate_record.duplicate_index_name;
            
        EXECUTE format('DROP INDEX IF EXISTS %I.%I', 
            duplicate_record.schema_name, 
            duplicate_record.duplicate_index_name);
    END LOOP;
END;
$$;

-- Add comments to explain the changes
COMMENT ON TABLE admin_profiles IS 'Admin profiles table with duplicate index removed for better performance';

-- Commit the transaction if everything went well
COMMIT; 