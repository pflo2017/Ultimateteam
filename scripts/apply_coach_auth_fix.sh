#!/bin/bash

# Script to apply the coach authentication flow fix to the database
echo "Applying coach authentication flow fix..."

# Check for required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "Error: Required environment variables not set."
  echo "Please set SUPABASE_URL and SUPABASE_SERVICE_KEY before running this script."
  exit 1
fi

# Extract database URL from SUPABASE_URL for direct PostgreSQL connection
DB_URL=$(echo $SUPABASE_URL | sed 's/https:\/\///' | sed 's/\.supabase\.co//')
PG_CONNECTION="postgres://postgres:${SUPABASE_SERVICE_KEY}@db.${DB_URL}.supabase.co:5432/postgres"

# Apply the SQL migration
echo "Applying SQL migration from supabase/migrations/20240701_fix_coach_auth_detection.sql"
psql "$PG_CONNECTION" -f supabase/migrations/20240701_fix_coach_auth_detection.sql

if [ $? -eq 0 ]; then
  echo "✅ Successfully applied coach auth fix migration!"
else
  echo "❌ Failed to apply coach auth fix migration."
  exit 1
fi

echo "✅ Coach authentication flow fix completed successfully!"
echo "You can now restart your app to test the fix."

# Create a script to fix all coaches with missing user_ids
echo "Creating script to fix coach records..."
cat > scripts/fix_coach_records.js << 'EOL'
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY/SUPABASE_KEY must be set in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to normalize phone numbers for comparison
function normalizePhoneNumber(phone) {
  if (!phone) return '';
  
  // Remove spaces and other non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');
  
  // Replace +0 with +4 for Romanian numbers
  if (normalized.startsWith('+0')) {
    normalized = '+4' + normalized.substring(2);
  }
  
  return normalized;
}

async function fixCoachRecords() {
  console.log('Running fix_coach_user_ids function...');
  
  try {
    // Call the database function to fix coach records
    const { data, error } = await supabase.rpc('fix_coach_user_ids');
    
    if (error) {
      console.error('Error running fix_coach_user_ids:', error);
      return;
    }
    
    console.log('Results from fix_coach_user_ids:');
    console.table(data);
    
    // Count successes
    const successes = data.filter(row => row.success).length;
    console.log(`Successfully linked ${successes} out of ${data.length} coaches`);
    
    // Check if specific coach needs fixing
    const phoneToCheck = process.env.COACH_PHONE_TO_CHECK || '+40730303303';
    
    // Manual check for specific coach
    const { data: specificCoach, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, phone_number, user_id')
      .eq('phone_number', phoneToCheck)
      .single();
      
    if (coachError) {
      console.log('Error fetching specific coach:', coachError);
    } else {
      console.log('Specific coach check:', specificCoach);
      
      if (specificCoach && !specificCoach.user_id) {
        console.log('Attempting to manually link specific coach...');
        
        // Find auth user with this phone
        const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
        
        if (authError) {
          console.error('Error listing auth users:', authError);
          return;
        }
        
        // Find matching auth user
        const authUser = authData?.users?.find(u => 
          u.phone === specificCoach.phone_number ||
          u.phone === normalizePhoneNumber(specificCoach.phone_number)
        );
        
        if (authUser) {
          const userId = authUser.id;
          console.log(`Found auth user ${userId}, linking to coach...`);
          
          const { error: updateError } = await supabase
            .from('coaches')
            .update({ user_id: userId })
            .eq('id', specificCoach.id);
            
          if (updateError) {
            console.error('Error updating coach:', updateError);
          } else {
            console.log('Successfully linked specific coach!');
          }
        } else {
          console.log('No auth user found for specific coach');
        }
      }
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

fixCoachRecords();
EOL

echo "Coach auth fix script created. Run 'node scripts/fix_coach_records.js' to fix coach records."
echo "Make sure to set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables first."
echo "Done!" 