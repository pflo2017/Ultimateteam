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

async function deleteUnlinkedParents() {
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

  console.log(`Found ${parentsWithoutUserId.length} parents without user_id`);
  
  // List parents that will be deleted
  if (parentsWithoutUserId.length > 0) {
    console.log('\nThe following parents will be deleted:');
    parentsWithoutUserId.forEach((parent, index) => {
      console.log(`${index + 1}. ID: ${parent.id}, Name: ${parent.name}, Phone: ${parent.phone_number}, Email: ${parent.email}`);
    });
    
    // Ask for confirmation before deleting
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      readline.question('\nAre you sure you want to delete these parents? (yes/no): ', resolve);
    });
    
    readline.close();
    
    if (answer.toLowerCase() === 'yes') {
      // Delete parents without auth accounts
      for (const parent of parentsWithoutUserId) {
        try {
          // Check if parent has children
          const { data: children, error: childrenError } = await supabase
            .from('parent_children')
            .select('id')
            .eq('parent_id', parent.id);
            
          if (childrenError) {
            console.error(`Error checking children for parent ${parent.id}:`, childrenError);
            continue;
          }
          
          if (children && children.length > 0) {
            console.log(`Parent ${parent.id} (${parent.name}) has ${children.length} children, skipping deletion`);
            continue;
          }
          
          // Delete parent
          const { error: deleteError } = await supabase
            .from('parents')
            .delete()
            .eq('id', parent.id);
            
          if (deleteError) {
            console.error(`Error deleting parent ${parent.id}:`, deleteError);
          } else {
            console.log(`Successfully deleted parent ${parent.id} (${parent.name})`);
          }
        } catch (err) {
          console.error(`Error processing parent ${parent.id}:`, err);
        }
      }
    } else {
      console.log('Deletion cancelled');
    }
  } else {
    console.log('No parents to delete');
  }
}

deleteUnlinkedParents()
  .then(() => console.log('Finished processing parents'))
  .catch(err => console.error('Error running script:', err)); 