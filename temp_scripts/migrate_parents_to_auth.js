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

async function migrateParents() {
  // 1. Fetch all parents
  const { data: parents, error } = await supabase
    .from('parents')
    .select('id, phone_number, password, email');

  if (error) {
    console.error('Error fetching parents:', error);
    return;
  }

  for (const parent of parents) {
    try {
      // 2. Create Supabase Auth user for each parent
      const { data, error: createError } = await supabase.auth.admin.createUser({
        phone: parent.phone_number,
        password: parent.password,
        email: parent.email || undefined,
        phone_confirm: true,
      });

      if (createError) {
        if (createError.message && createError.message.includes('User already registered')) {
          console.log(`Parent ${parent.phone_number} already exists in Auth, skipping.`);
        } else {
          console.error(`Error creating user for ${parent.phone_number}:`, createError);
        }
      } else {
        console.log(`Created Auth user for parent: ${parent.phone_number}`);
      }
    } catch (err) {
      console.error(`Unexpected error for ${parent.phone_number}:`, err);
    }
  }
}

migrateParents(); 