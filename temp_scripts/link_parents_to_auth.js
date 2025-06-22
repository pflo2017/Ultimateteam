const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load Supabase URL from app.config.js
const configPath = path.join(__dirname, 'app.config.js');
const configContent = fs.readFileSync(configPath, 'utf-8');

// Extract Supabase URL using regex - looking for the URL in the config
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

async function linkParentsToAuth() {
  console.log('Fetching parents without user_id...');
  
  // 1. Fetch all parents without user_id
  const { data: parents, error: parentsError } = await supabase
    .from('parents')
    .select('id, phone_number, email')
    .is('user_id', null);

  if (parentsError) {
    console.error('Error fetching parents:', parentsError);
    return;
  }

  console.log(`Found ${parents.length} parents without user_id`);

  // 2. For each parent, try to find a matching auth user
  for (const parent of parents) {
    try {
      console.log(`Processing parent ${parent.id} with phone ${parent.phone_number}`);
      
      // Try to find auth user by phone number
      const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
      
      if (usersError) {
        console.error('Error fetching auth users:', usersError);
        continue;
      }

      // Find matching user by phone or email
      const matchingUser = users.find(user => 
        (user.phone && user.phone === parent.phone_number) || 
        (user.email && user.email === parent.email)
      );

      if (matchingUser) {
        console.log(`Found matching auth user ${matchingUser.id} for parent ${parent.id}`);
        
        // Update the parent record with the auth user ID
        const { error: updateError } = await supabase
          .from('parents')
          .update({ user_id: matchingUser.id })
          .eq('id', parent.id);

        if (updateError) {
          console.error(`Error updating parent ${parent.id}:`, updateError);
        } else {
          console.log(`Successfully linked parent ${parent.id} to auth user ${matchingUser.id}`);
        }
      } else {
        console.log(`No matching auth user found for parent ${parent.id}`);
      }
    } catch (err) {
      console.error(`Error processing parent ${parent.id}:`, err);
    }
  }
}

linkParentsToAuth()
  .then(() => console.log('Finished linking parents to auth users'))
  .catch(err => console.error('Error running script:', err)); 