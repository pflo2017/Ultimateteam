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

// Use the provided service role key
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbHRwamV6bnR6Z2lhd2NobWFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTMzNzM0MiwiZXhwIjoyMDYwOTEzMzQyfQ.5MPohDgqv5b4U77jLnEZ-zeYVlazThOjNNKVzrcrfoI';

console.log('Using Supabase URL:', SUPABASE_URL);
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Create a readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline.question
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function deleteParentsWithoutChildren() {
  try {
    console.log('Fetching parent records...');
    
    // Get all parents without user_id
    const { data: allParents, error: fetchError } = await supabase
      .from('parents')
      .select('*')
      .is('user_id', null);
      
    if (fetchError) {
      console.error('Error fetching parents:', fetchError);
      rl.close();
      return;
    }
    
    // Get all parent-children relationships
    const { data: allParentChildren, error: pcError } = await supabase
      .from('parent_children')
      .select('parent_id');
      
    if (pcError) {
      console.error('Error fetching parent-children relationships:', pcError);
      rl.close();
      return;
    }
    
    // Create a set of parent IDs that have children
    const parentIdsWithChildren = new Set(allParentChildren.map(pc => pc.parent_id));
    
    // Filter parents without children
    const parentsWithoutChildren = allParents.filter(parent => !parentIdsWithChildren.has(parent.id));
    
    // Display parents without children
    console.log(`\nFound ${parentsWithoutChildren.length} parents without children and without user_id`);
    
    if (parentsWithoutChildren.length === 0) {
      console.log('No parents to delete.');
      rl.close();
      return;
    }
    
    console.log('\n=== PARENTS TO DELETE ===');
    parentsWithoutChildren.forEach((parent, index) => {
      console.log(`${index + 1}. ${parent.name} (${parent.email || parent.phone_number})`);
    });
    
    // Confirm deletion
    const confirmDelete = await question('\nAre you sure you want to delete these parents? (yes/no): ');
    
    if (confirmDelete.toLowerCase() !== 'yes' && confirmDelete.toLowerCase() !== 'y') {
      console.log('Deletion cancelled.');
      rl.close();
      return;
    }
    
    // Extract parent IDs to delete
    const parentIdsToDelete = parentsWithoutChildren.map(parent => parent.id);
    
    // Delete parents
    console.log(`\nDeleting ${parentIdsToDelete.length} parents...`);
    
    const { error: deleteError } = await supabase
      .from('parents')
      .delete()
      .in('id', parentIdsToDelete);
      
    if (deleteError) {
      console.error('Error deleting parents:', deleteError);
      rl.close();
      return;
    }
    
    console.log(`✅ Successfully deleted ${parentIdsToDelete.length} parents without children.`);
    
  } catch (err) {
    console.error('Error during deletion:', err);
  } finally {
    rl.close();
  }
}

deleteParentsWithoutChildren()
  .then(() => console.log('\nFinished parent deletion process'))
  .catch(err => {
    console.error('Error running script:', err);
    rl.close();
  }); 