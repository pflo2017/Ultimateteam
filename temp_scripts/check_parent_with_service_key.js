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

async function checkSpecificParent() {
  // Check for the specific parent
  const { data: parent, error: parentError } = await supabase
    .from('parents')
    .select('*')
    .or('email.eq.parent.test@gmail.com,phone_number.eq.+40760600600')
    .single();

  if (parentError) {
    console.error('Error fetching parent:', parentError);
    if (parentError.code === 'PGRST116') {
      console.log('No parent found with email parent.test@gmail.com or phone +40760600600');
    }
    return;
  }

  if (!parent) {
    console.log('No parent found with email parent.test@gmail.com or phone +40760600600');
    return;
  }

  console.log('\n=== PARENT DETAILS ===');
  console.log(`ID: ${parent.id}`);
  console.log(`Name: ${parent.name}`);
  console.log(`Email: ${parent.email}`);
  console.log(`Phone: ${parent.phone_number}`);
  console.log(`Created: ${parent.created_at}`);
  console.log(`User ID: ${parent.user_id || 'None'}`);
  console.log(`Team ID: ${parent.team_id || 'None'}`);
  console.log(`Is Active: ${parent.is_active}`);
  console.log(`Phone Verified: ${parent.phone_verified}`);

  // Check if parent has children
  const { data: children, error: childrenError } = await supabase
    .from('parent_children')
    .select('id, full_name, team_id')
    .eq('parent_id', parent.id);
    
  if (childrenError) {
    console.error(`Error checking children:`, childrenError);
  } else {
    console.log(`\nChildren: ${children.length > 0 ? children.length : 'None'}`);
    if (children.length > 0) {
      children.forEach((child, index) => {
        console.log(`  Child ${index + 1}: ${child.full_name} (Team ID: ${child.team_id || 'None'})`);
      });
    }
  }

  // Check if there's a corresponding auth user using admin API
  console.log('\nChecking auth users...');
  
  // Check by email
  const { data: authUsersByEmail, error: authEmailError } = await supabase.auth.admin.listUsers({
    filters: {
      email: parent.email
    }
  });

  if (authEmailError) {
    console.error('Error checking auth users by email:', authEmailError);
  } else {
    console.log(`Found ${authUsersByEmail?.users?.length || 0} auth users by email`);
    
    if (authUsersByEmail?.users?.length > 0) {
      console.log('\nAuth user details (by email):');
      const user = authUsersByEmail.users[0];
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Phone: ${user.phone}`);
      console.log(`Created: ${user.created_at}`);
      console.log(`Last Sign In: ${user.last_sign_in_at || 'Never'}`);
    }
  }
  
  // Check by phone
  const { data: authUsersByPhone, error: authPhoneError } = await supabase.auth.admin.listUsers({
    filters: {
      phone: parent.phone_number
    }
  });

  if (authPhoneError) {
    console.error('Error checking auth users by phone:', authPhoneError);
  } else {
    console.log(`Found ${authUsersByPhone?.users?.length || 0} auth users by phone`);
    
    if (authUsersByPhone?.users?.length > 0) {
      console.log('\nAuth user details (by phone):');
      const user = authUsersByPhone.users[0];
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Phone: ${user.phone}`);
      console.log(`Created: ${user.created_at}`);
      console.log(`Last Sign In: ${user.last_sign_in_at || 'Never'}`);
    }
  }
}

checkSpecificParent()
  .then(() => console.log('\nFinished checking specific parent'))
  .catch(err => console.error('Error running script:', err)); 