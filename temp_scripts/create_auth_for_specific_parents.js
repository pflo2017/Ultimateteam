const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

// Create a readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline.question
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createAuthForSpecificParents() {
  console.log('Fetching parents without user_id...');
  
  // Fetch parents without user_id
  const { data: parentsWithoutUserId, error: parentsError } = await supabase
    .from('parents')
    .select('*')
    .is('user_id', null);

  if (parentsError) {
    console.error('Error fetching parents:', parentsError);
    rl.close();
    return;
  }

  console.log(`\nFound ${parentsWithoutUserId.length} parents without user_id`);
  
  if (parentsWithoutUserId.length === 0) {
    console.log('No parents to process');
    rl.close();
    return;
  }

  // Show list of parents
  console.log('\nList of parents without auth accounts:');
  parentsWithoutUserId.forEach((parent, index) => {
    const hasTeamId = parent.team_id ? 'Yes' : 'No';
    console.log(`${index + 1}. ${parent.name} (${parent.phone_number}) - Email: ${parent.email} - Has Team ID: ${hasTeamId}`);
  });

  // Ask user which parents to process
  console.log('\nEnter the numbers of parents to process (comma-separated, e.g., "1,3,5"), or "all" for all parents:');
  const answer = await question('> ');
  
  let parentsToProcess = [];
  
  if (answer.toLowerCase() === 'all') {
    parentsToProcess = parentsWithoutUserId;
  } else {
    const selectedIndices = answer.split(',').map(num => parseInt(num.trim(), 10) - 1);
    parentsToProcess = selectedIndices
      .filter(index => index >= 0 && index < parentsWithoutUserId.length)
      .map(index => parentsWithoutUserId[index]);
  }
  
  console.log(`\nSelected ${parentsToProcess.length} parents to process`);
  
  // Process each selected parent
  for (const parent of parentsToProcess) {
    console.log(`\n--- Processing parent: ${parent.name} (${parent.phone_number}) ---`);
    
    try {
      // Check if parent has children
      const { data: children, error: childrenError } = await supabase
        .from('parent_children')
        .select('id, full_name')
        .eq('parent_id', parent.id);
        
      if (childrenError) {
        console.error(`Error checking children for parent ${parent.id}:`, childrenError);
      }
      
      const hasChildren = children && children.length > 0;
      console.log(`Has children: ${hasChildren ? 'Yes (' + children.length + ')' : 'No'}`);
      
      if (hasChildren) {
        console.log('Children:');
        children.forEach((child, index) => {
          console.log(`  ${index + 1}. ${child.full_name}`);
        });
      }
      
      // Confirm processing this parent
      const confirmProcess = await question(`Process this parent? (yes/no): `);
      if (confirmProcess.toLowerCase() !== 'yes') {
        console.log(`Skipping parent: ${parent.name}`);
        continue;
      }
      
      // Try to create an auth user
      console.log(`Creating auth user for: ${parent.name}`);
      
      // Generate a unique email if needed
      const email = parent.email || `${parent.phone_number.replace(/[^0-9]/g, '')}@ultimateteam.app`;
      
      // Create the auth user with phone and email
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: parent.password,
        phone: parent.phone_number,
        options: {
          data: {
            name: parent.name
          }
        }
      });
      
      if (authError) {
        console.error(`Error creating auth user for ${parent.name}:`, authError);
        continue;
      }
      
      if (!authData.user) {
        console.error(`No user returned when creating auth user for ${parent.name}`);
        continue;
      }
      
      console.log(`Created auth user with ID: ${authData.user.id}`);
      
      // Update the parent record with the auth user ID
      const { error: updateError } = await supabase
        .from('parents')
        .update({ user_id: authData.user.id })
        .eq('id', parent.id);
        
      if (updateError) {
        console.error(`Error updating parent ${parent.id} with user_id:`, updateError);
      } else {
        console.log(`Successfully linked parent ${parent.id} to auth user ${authData.user.id}`);
      }
    } catch (err) {
      console.error(`Unexpected error processing parent ${parent.id}:`, err);
    }
  }
  
  rl.close();
}

createAuthForSpecificParents()
  .then(() => console.log('\nFinished creating auth accounts for selected parents'))
  .catch(err => {
    console.error('Error running script:', err);
    rl.close();
  }); 