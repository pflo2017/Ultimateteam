const fs = require('fs');
const path = require('path');

// Create migration timestamp
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const timestamp = `${year}${month}${day}`;

// Migration file path
const migrationDir = path.join(__dirname, 'supabase', 'migrations');
const migrationFilename = `${timestamp}_remove_team_id_from_parents.sql`;
const migrationPath = path.join(migrationDir, migrationFilename);

// Ensure migrations directory exists
if (!fs.existsSync(migrationDir)) {
  fs.mkdirSync(migrationDir, { recursive: true });
}

// SQL to remove team_id column
const sql = `-- Remove team_id column from parents table
-- This column is no longer needed as parents are linked to teams through their children

-- First, check if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'parents'
    AND column_name = 'team_id'
  ) THEN
    -- Drop the column if it exists
    ALTER TABLE public.parents DROP COLUMN team_id;
    RAISE NOTICE 'Removed team_id column from parents table';
  ELSE
    RAISE NOTICE 'team_id column does not exist in parents table';
  END IF;
END $$;
`;

// Write migration file
fs.writeFileSync(migrationPath, sql);

console.log(`Created migration file: ${migrationPath}`);
console.log('To apply this migration, run:');
console.log(`npx supabase migration up`); 