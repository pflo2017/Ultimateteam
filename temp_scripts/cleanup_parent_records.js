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

async function cleanupParentRecords() {
  try {
    console.log('Starting parent records cleanup...');
    
    // 1. Get all parents
    console.log('\nFetching all parent records...');
    const { data: allParents, error: fetchError } = await supabase
      .from('parents')
      .select('*');
      
    if (fetchError) {
      console.error('Error fetching parents:', fetchError);
      return;
    }
    
    console.log(`Found ${allParents.length} parent records`);
    
    // 2. Categorize parents
    const parentsWithoutUserId = [];
    const parentsWithoutChildren = [];
    const parentsWithTeamId = [];
    const validParents = [];
    
    // Get all parent-children relationships
    const { data: allParentChildren, error: pcError } = await supabase
      .from('parent_children')
      .select('parent_id');
      
    if (pcError) {
      console.error('Error fetching parent-children relationships:', pcError);
      return;
    }
    
    // Create a set of parent IDs that have children
    const parentIdsWithChildren = new Set(allParentChildren.map(pc => pc.parent_id));
    
    // Categorize each parent
    for (const parent of allParents) {
      // Check if parent has children
      const hasChildren = parentIdsWithChildren.has(parent.id);
      
      if (!parent.user_id) {
        parentsWithoutUserId.push({ ...parent, has_children: hasChildren });
      }
      
      if (!hasChildren) {
        parentsWithoutChildren.push(parent);
      }
      
      if (parent.team_id) {
        parentsWithTeamId.push(parent);
      }
      
      if (parent.user_id && hasChildren && !parent.team_id) {
        validParents.push(parent);
      }
    }
    
    // 3. Display statistics
    console.log('\n=== PARENT RECORDS STATISTICS ===');
    console.log(`Total parents: ${allParents.length}`);
    console.log(`Parents without user_id: ${parentsWithoutUserId.length}`);
    console.log(`Parents without children: ${parentsWithoutChildren.length}`);
    console.log(`Parents with team_id: ${parentsWithTeamId.length}`);
    console.log(`Valid parents: ${validParents.length}`);
    
    // 4. Handle parents with team_id (old implementation)
    if (parentsWithTeamId.length > 0) {
      console.log('\n=== PARENTS WITH TEAM_ID (OLD IMPLEMENTATION) ===');
      
      const shouldRemoveTeamId = await question('Remove team_id from all parents? (yes/no): ');
      
      if (shouldRemoveTeamId.toLowerCase() === 'yes' || shouldRemoveTeamId.toLowerCase() === 'y') {
        console.log('Removing team_id from all parents...');
        
        // Execute the SQL migration to remove the team_id column
        const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20240618_cleanup_parents_table.sql');
        if (fs.existsSync(migrationPath)) {
          console.log('Migration file exists. Please run this migration using the Supabase CLI:');
          console.log('npx supabase migration up');
        } else {
          console.error('Migration file not found. Please create it first.');
        }
      }
    }
    
    // 5. Handle parents without user_id
    if (parentsWithoutUserId.length > 0) {
      console.log('\n=== PARENTS WITHOUT USER_ID ===');
      
      // Group by whether they have children
      const withChildren = parentsWithoutUserId.filter(p => p.has_children);
      const withoutChildren = parentsWithoutUserId.filter(p => !p.has_children);
      
      console.log(`Parents without user_id that have children: ${withChildren.length}`);
      console.log(`Parents without user_id that don't have children: ${withoutChildren.length}`);
      
      // Handle parents without user_id that don't have children
      if (withoutChildren.length > 0) {
        console.log('\nParents without user_id and without children are likely unused accounts.');
        const shouldDelete = await question('Delete parents without user_id and without children? (yes/no): ');
        
        if (shouldDelete.toLowerCase() === 'yes' || shouldDelete.toLowerCase() === 'y') {
          console.log('Deleting parents without user_id and without children...');
          
          const parentIds = withoutChildren.map(p => p.id);
          const { error: deleteError } = await supabase
            .from('parents')
            .delete()
            .in('id', parentIds);
            
          if (deleteError) {
            console.error('Error deleting parents:', deleteError);
          } else {
            console.log(`Successfully deleted ${withoutChildren.length} unused parent records`);
          }
        }
      }
      
      // Handle parents without user_id that have children
      if (withChildren.length > 0) {
        console.log('\nParents without user_id that have children need auth accounts.');
        console.log('These should be fixed by running the fix_parent_auth.js script for each parent.');
        
        const shouldList = await question('List these parents? (yes/no): ');
        if (shouldList.toLowerCase() === 'yes' || shouldList.toLowerCase() === 'y') {
          console.log('\nParents without user_id that have children:');
          withChildren.forEach((parent, index) => {
            console.log(`${index + 1}. ${parent.name} (${parent.email || parent.phone_number})`);
          });
        }
      }
    }
    
    // 6. Handle parents without children
    if (parentsWithoutChildren.length > 0) {
      console.log('\n=== PARENTS WITHOUT CHILDREN ===');
      console.log('Parents without children may be unused accounts.');
      
      const shouldDelete = await question('Delete parents without children? (yes/no): ');
      
      if (shouldDelete.toLowerCase() === 'yes' || shouldDelete.toLowerCase() === 'y') {
        console.log('Deleting parents without children...');
        
        const parentIds = parentsWithoutChildren.map(p => p.id);
        const { error: deleteError } = await supabase
          .from('parents')
          .delete()
          .in('id', parentIds);
          
        if (deleteError) {
          console.error('Error deleting parents:', deleteError);
        } else {
          console.log(`Successfully deleted ${parentsWithoutChildren.length} unused parent records`);
        }
      }
    }
    
    console.log('\nParent records cleanup completed.');
    
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    rl.close();
  }
}

cleanupParentRecords()
  .then(() => console.log('\nFinished parent records cleanup'))
  .catch(err => {
    console.error('Error running script:', err);
    rl.close();
  }); 