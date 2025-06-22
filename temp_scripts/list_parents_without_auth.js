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

// Extract Supabase anon key using regex
const supabaseKeyMatch = configContent.match(/supabaseAnonKey:.*?["']([^"']+)["']/);
if (!supabaseKeyMatch) {
  console.error('Could not find supabaseAnonKey in app.config.js');
  process.exit(1);
}
const SUPABASE_ANON_KEY = supabaseKeyMatch[1];

// Service role key must be provided as an environment variable for security
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

console.log('Using Supabase URL:', SUPABASE_URL);
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function listParentsWithoutAuth() {
  console.log('Fetching parents without user_id...');
  
  // Fetch parents without user_id
  const { data: parentsWithoutUserId, error: parentsError } = await supabase
    .from('parents')
    .select('*')
    .is('user_id', null);

  if (parentsError) {
    console.error('Error fetching parents:', parentsError);
    return;
  }

  console.log(`\nFound ${parentsWithoutUserId.length} parents without user_id:`);
  
  if (parentsWithoutUserId.length > 0) {
    console.log('\n=== PARENTS WITHOUT AUTH ACCOUNTS ===');
    
    for (const parent of parentsWithoutUserId) {
      console.log(`\n--- Parent ID: ${parent.id} ---`);
      console.log(`Name: ${parent.name}`);
      console.log(`Phone: ${parent.phone_number}`);
      console.log(`Email: ${parent.email}`);
      console.log(`Created: ${parent.created_at}`);
      console.log(`Is Active: ${parent.is_active}`);
      console.log(`Team ID: ${parent.team_id || 'None'}`);
      
      // Check if parent has children
      const { data: children, error: childrenError } = await supabase
        .from('parent_children')
        .select('id, full_name, team_id')
        .eq('parent_id', parent.id);
        
      if (childrenError) {
        console.error(`Error checking children for parent ${parent.id}:`, childrenError);
      } else {
        console.log(`Children: ${children.length > 0 ? children.length : 'None'}`);
        if (children.length > 0) {
          children.forEach((child, index) => {
            console.log(`  Child ${index + 1}: ${child.full_name} (Team ID: ${child.team_id || 'None'})`);
          });
        }
      }
      
      console.log('------------------------');
    }
  } else {
    console.log('No parents without auth accounts found.');
  }
}

listParentsWithoutAuth()
  .then(() => console.log('\nFinished listing parents without auth accounts'))
  .catch(err => console.error('Error running script:', err)); 