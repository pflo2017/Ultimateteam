const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load Supabase URL from app.config.js using regex
const configPath = path.join(__dirname, 'app.config.js');
const configText = fs.readFileSync(configPath, 'utf-8');
const supabaseUrlMatch = configText.match(/supabaseUrl:\s*['\"]([^'\"]+)['\"]/);
if (!supabaseUrlMatch) {
  console.error('Could not find supabaseUrl in app.config.js');
  process.exit(1);
}
const SUPABASE_URL = supabaseUrlMatch[1];

// Service role key must be provided as an environment variable for security
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
  console.error('Please set the SUPABASE_SERVICE_ROLE_KEY environment variable.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function createMissingAuthAccounts() {
  console.log('Fetching parents without user_id...');
  
  // 1. Fetch all parents without user_id
  const { data: parents, error: parentsError } = await supabase
    .from('parents')
    .select('id, phone_number, email, password, name')
    .is('user_id', null);

  if (parentsError) {
    console.error('Error fetching parents:', parentsError);
    return;
  }

  console.log(`Found ${parents.length} parents without user_id`);

  // 2. For each parent, create an auth account if needed
  for (const parent of parents) {
    try {
      console.log(`Processing parent ${parent.id} with phone ${parent.phone_number}`);
      
      // Check if auth user already exists with this phone or email
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
        console.log(`Auth user already exists for parent ${parent.id}, linking...`);
        
        // Update the parent record with the auth user ID
        const { error: updateError } = await supabase
          .from('parents')
          .update({ user_id: matchingUser.id })
          .eq('id', parent.id);

        if (updateError) {
          console.error(`Error updating parent ${parent.id}:`, updateError);
        } else {
          console.log(`Successfully linked parent ${parent.id} to existing auth user ${matchingUser.id}`);
        }
      } else {
        console.log(`Creating new auth user for parent ${parent.id}`);
        
        // Create a new auth user
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: parent.email,
          phone: parent.phone_number,
          password: parent.password,
          email_confirm: true,
          phone_confirm: true,
          user_metadata: {
            full_name: parent.name
          }
        });

        if (createError) {
          console.error(`Error creating auth user for parent ${parent.id}:`, createError);
        } else if (newUser?.user) {
          console.log(`Created auth user ${newUser.user.id} for parent ${parent.id}`);
          
          // Update the parent record with the new auth user ID
          const { error: updateError } = await supabase
            .from('parents')
            .update({ user_id: newUser.user.id })
            .eq('id', parent.id);

          if (updateError) {
            console.error(`Error updating parent ${parent.id}:`, updateError);
          } else {
            console.log(`Successfully linked parent ${parent.id} to new auth user ${newUser.user.id}`);
          }
        }
      }
    } catch (err) {
      console.error(`Error processing parent ${parent.id}:`, err);
    }
  }
}

createMissingAuthAccounts()
  .then(() => console.log('Finished creating missing auth accounts'))
  .catch(err => console.error('Error running script:', err)); 