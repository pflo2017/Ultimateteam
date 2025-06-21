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

async function listParentsWithoutChildren() {
  try {
    console.log('Fetching parent records...');
    
    // Get all parents
    const { data: allParents, error: fetchError } = await supabase
      .from('parents')
      .select('*')
      .is('user_id', null);
      
    if (fetchError) {
      console.error('Error fetching parents:', fetchError);
      return;
    }
    
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
    
    // Filter parents without children
    const parentsWithoutChildren = allParents.filter(parent => !parentIdsWithChildren.has(parent.id));
    
    // Display parents without children
    console.log(`\nFound ${parentsWithoutChildren.length} parents without children and without user_id`);
    
    if (parentsWithoutChildren.length > 0) {
      console.log('\n=== PARENTS WITHOUT CHILDREN ===');
      console.log('Name | Phone Number | Email | Created Date');
      console.log('-----|--------------|-------|------------');
      
      parentsWithoutChildren.forEach((parent, index) => {
        console.log(`${index + 1}. ${parent.name} | ${parent.phone_number} | ${parent.email || 'None'} | ${parent.created_at.split('T')[0]}`);
      });
      
      // Create a CSV-like format for easy copying
      console.log('\n=== CSV FORMAT ===');
      console.log('Name,Phone Number,Email,Created Date');
      parentsWithoutChildren.forEach(parent => {
        console.log(`"${parent.name}","${parent.phone_number}","${parent.email || ''}","${parent.created_at.split('T')[0]}"`);
      });
      
      // List just the phone numbers
      console.log('\n=== PHONE NUMBERS ONLY ===');
      parentsWithoutChildren.forEach(parent => {
        console.log(parent.phone_number);
      });
    }
    
  } catch (err) {
    console.error('Error listing parents:', err);
  }
}

listParentsWithoutChildren()
  .then(() => console.log('\nFinished listing parents without children'))
  .catch(err => console.error('Error running script:', err)); 