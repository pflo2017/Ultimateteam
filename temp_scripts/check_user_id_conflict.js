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

async function checkUserIdConflict() {
  const userId = 'f5c67ce1-081b-4ef5-b23c-3dc46a544d92'; // The user ID from the error
  
  console.log(`Checking which parent has user_id: ${userId}`);
  
  // Query the parents table
  const { data: parent, error: parentError } = await supabase
    .from('parents')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  if (parentError) {
    console.error('Error querying parent:', parentError);
    return;
  }
  
  if (!parent) {
    console.log('No parent found with this user_id');
    return;
  }
  
  console.log('\n=== PARENT WITH CONFLICTING USER_ID ===');
  console.log(`ID: ${parent.id}`);
  console.log(`Name: ${parent.name}`);
  console.log(`Email: ${parent.email}`);
  console.log(`Phone: ${parent.phone_number}`);
  console.log(`Created: ${parent.created_at}`);
  
  // Check auth user details
  console.log('\nChecking auth user details...');
  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId);
  
  if (authError) {
    console.error('Error getting auth user:', authError);
    return;
  }
  
  if (!authData?.user) {
    console.log('No auth user found with this ID');
    return;
  }
  
  console.log('\n=== AUTH USER DETAILS ===');
  console.log(`ID: ${authData.user.id}`);
  console.log(`Email: ${authData.user.email}`);
  console.log(`Phone: ${authData.user.phone}`);
  console.log(`Created: ${authData.user.created_at}`);
  console.log(`Last Sign In: ${authData.user.last_sign_in_at || 'Never'}`);
}

checkUserIdConflict()
  .then(() => console.log('\nFinished checking user ID conflict'))
  .catch(err => console.error('Error running script:', err)); 