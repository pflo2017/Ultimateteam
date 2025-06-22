// Script to apply activity presence policies fix
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase connection details (from your app.config.js)
const supabaseUrl = 'https://ulltpjezntzgiawchmaj.supabase.co';
const supabaseAnonKey = 'process.env.SUPABASE_SERVICE_KEY || "REMOVED_FOR_SECURITY"';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function applyFix() {
  try {
    // Read the SQL file content
    const sqlFilePath = path.join(__dirname, 'fix_activity_presence_policies.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    // Execute the SQL using Supabase
    console.log('Applying activity presence policy fix...');
    const { data, error } = await supabase.rpc('exec_sql', {
      query: sqlContent
    });

    if (error) {
      console.error('Error applying fix:', error);
      return;
    }

    console.log('Activity presence policies successfully updated!');
    
    // Verify the policies
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'activity_presence');

    if (policiesError) {
      console.error('Error checking policies:', policiesError);
      return;
    }

    console.log('Current activity_presence policies:');
    console.table(policies);

  } catch (err) {
    console.error('Error in script execution:', err);
  }
}

applyFix(); 