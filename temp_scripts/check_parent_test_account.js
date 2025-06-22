const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load Supabase URL from app.config.js
const configPath = path.join(__dirname, 'app.config.js');
const configContent = fs.readFileSync(configPath, 'utf-8');

// Extract Supabase URL using regex
const supabaseUrlMatch = configContent.match(/supabaseUrl:.*?["'](https:\/\/[^"']+)["']/);
if (!supabaseUrlMatch) {
  console.error('Could not find supabaseUrl in app.config.js');
  process.exit(1);
}
const SUPABASE_URL = supabaseUrlMatch[1];

// Use the provided service role key
const SERVICE_ROLE_KEY = 'process.env.SUPABASE_SERVICE_KEY || "REMOVED_FOR_SECURITY"';

console.log('Using Supabase URL:', SUPABASE_URL);
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkParentTestAccount() {
  try {
    console.log('Checking "Parent test" account...');
    
    // Get the Parent test account
    const { data: parentTest, error: fetchError } = await supabase
      .from('parents')
      .select('*')
      .eq('name', 'Parent test')
      .single();
      
    if (fetchError) {
      console.error('Error fetching Parent test account:', fetchError);
      return;
    }
    
    if (!parentTest) {
      console.log('No "Parent test" account found');
      return;
    }
    
    console.log('\nFound "Parent test" account:');
    console.log(`ID: ${parentTest.id}`);
    console.log(`Name: ${parentTest.name}`);
    console.log(`Email: ${parentTest.email || 'None'}`);
    console.log(`Phone: ${parentTest.phone_number || 'None'}`);
    console.log(`User ID: ${parentTest.user_id || 'None'}`);
    console.log(`Created: ${parentTest.created_at}`);
    
    // Check for children
    const { data: children, error: childrenError } = await supabase
      .from('parent_children')
      .select('*')
      .eq('parent_id', parentTest.id);
      
    if (childrenError) {
      console.error('Error fetching children:', childrenError);
    } else {
      console.log(`\nChildren: ${children.length}`);
      children.forEach((child, index) => {
        console.log(`\nChild ${index + 1}:`);
        console.log(`Name: ${child.full_name || 'None'}`);
        console.log(`Team ID: ${child.team_id || 'None'}`);
      });
    }
    
    // Check for auth user with the same email
    if (parentTest.email) {
      console.log('\nChecking for auth user with email:', parentTest.email);
      
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
        filters: {
          email: parentTest.email
        }
      });
      
      if (authError) {
        console.error('Error checking auth users by email:', authError);
      } else {
        const authUsers = authData?.users || [];
        console.log(`Found ${authUsers.length} auth users with matching email`);
        
        authUsers.forEach((user, index) => {
          console.log(`\nAuth User ${index + 1}:`);
          console.log(`ID: ${user.id}`);
          console.log(`Email: ${user.email}`);
          console.log(`Phone: ${user.phone || 'None'}`);
          console.log(`Created: ${user.created_at}`);
          console.log(`Last Sign In: ${user.last_sign_in_at || 'Never'}`);
        });
      }
    }
    
    // Check for auth user with the same phone
    if (parentTest.phone_number) {
      console.log('\nChecking for auth user with phone:', parentTest.phone_number);
      
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
        filters: {
          phone: parentTest.phone_number
        }
      });
      
      if (authError) {
        console.error('Error checking auth users by phone:', authError);
      } else {
        const authUsers = authData?.users || [];
        console.log(`Found ${authUsers.length} auth users with matching phone`);
        
        authUsers.forEach((user, index) => {
          console.log(`\nAuth User ${index + 1}:`);
          console.log(`ID: ${user.id}`);
          console.log(`Email: ${user.email || 'None'}`);
          console.log(`Phone: ${user.phone}`);
          console.log(`Created: ${user.created_at}`);
          console.log(`Last Sign In: ${user.last_sign_in_at || 'Never'}`);
        });
      }
    }
    
    // Check registration logs if available
    console.log('\nChecking recent logs for registration events...');
    
    const { data: logs, error: logsError } = await supabase
      .from('logs')
      .select('*')
      .or(`description.ilike.%${parentTest.email}%,description.ilike.%${parentTest.phone_number}%`)
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (logsError) {
      console.error('Error fetching logs:', logsError);
    } else if (logs && logs.length > 0) {
      console.log(`Found ${logs.length} relevant log entries:`);
      logs.forEach((log, index) => {
        console.log(`\nLog ${index + 1}:`);
        console.log(`Time: ${log.created_at}`);
        console.log(`Type: ${log.type}`);
        console.log(`Description: ${log.description}`);
      });
    } else {
      console.log('No relevant logs found');
      
      // If no logs table exists, check if there's an audit_log table
      const { data: auditLogs, error: auditLogsError } = await supabase
        .from('audit_log')
        .select('*')
        .or(`description.ilike.%${parentTest.email}%,description.ilike.%${parentTest.phone_number}%`)
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (!auditLogsError && auditLogs && auditLogs.length > 0) {
        console.log(`Found ${auditLogs.length} relevant audit log entries:`);
        auditLogs.forEach((log, index) => {
          console.log(`\nAudit Log ${index + 1}:`);
          console.log(`Time: ${log.created_at}`);
          console.log(`Type: ${log.action}`);
          console.log(`Description: ${log.details}`);
        });
      }
    }
    
  } catch (err) {
    console.error('Error checking Parent test account:', err);
  }
}

checkParentTestAccount()
  .then(() => console.log('\nFinished checking Parent test account'))
  .catch(err => console.error('Error running script:', err)); 