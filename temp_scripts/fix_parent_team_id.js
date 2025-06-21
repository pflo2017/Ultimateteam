const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try to find the Supabase URL and service key
let supabaseUrl;
const supabaseServiceKey = 'process.env.SUPABASE_SERVICE_KEY || "REMOVED_FOR_SECURITY"';

try {
  // First try app.config.js
  const appConfigPath = path.join(__dirname, 'app.config.js');
  if (fs.existsSync(appConfigPath)) {
    const configContent = fs.readFileSync(appConfigPath, 'utf8');
    
    // Extract using regex
    const urlMatch = configContent.match(/supabaseUrl:\s*["']([^"']+)["']/);
    if (urlMatch) supabaseUrl = urlMatch[1];
  }
  
  // If still not found, try environment variables
  if (!supabaseUrl) supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  
} catch (error) {
  console.error('Error reading configuration:', error);
}

// Hardcoded values as last resort
if (!supabaseUrl) supabaseUrl = 'https://ulltpjezntzgiawchmaj.supabase.co';

console.log('Using Supabase URL:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixParentTeamId() {
  try {
    // 1. Get the parent with phone +40750500500
    const { data: targetParent, error: targetParentError } = await supabase
      .from('parents')
      .select('*')
      .eq('phone_number', '+40750500500')
      .maybeSingle();
    
    if (targetParentError) {
      console.error('Error fetching target parent:', targetParentError);
      return;
    }
    
    if (!targetParent) {
      console.log('No parent found with phone number +40750500500');
      return;
    }
    
    console.log('=== PARENT BEFORE UPDATE ===');
    console.log(`ID: ${targetParent.id}`);
    console.log(`Name: ${targetParent.name}`);
    console.log(`Email: ${targetParent.email}`);
    console.log(`Phone: ${targetParent.phone_number}`);
    console.log(`User ID: ${targetParent.user_id || 'Not set'}`);
    console.log(`Team ID: ${targetParent.team_id || 'Not set'}`);
    
    // 2. Update the parent record to remove team_id
    const { data: updatedParent, error: updateError } = await supabase
      .from('parents')
      .update({ team_id: null })
      .eq('id', targetParent.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating parent:', updateError);
      return;
    }
    
    console.log('\n=== PARENT AFTER UPDATE ===');
    console.log(`ID: ${updatedParent.id}`);
    console.log(`Name: ${updatedParent.name}`);
    console.log(`Email: ${updatedParent.email}`);
    console.log(`Phone: ${updatedParent.phone_number}`);
    console.log(`User ID: ${updatedParent.user_id || 'Not set'}`);
    console.log(`Team ID: ${updatedParent.team_id || 'Not set'}`);
    
    // 3. Check if there are players associated with this parent
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('parent_id', targetParent.id);
    
    if (playersError) {
      console.error('Error fetching players:', playersError);
    } else if (players && players.length > 0) {
      console.log(`\n=== PLAYERS (${players.length}) ===`);
      for (const player of players) {
        console.log(`- ID: ${player.id}`);
        console.log(`  Name: ${player.full_name || 'undefined'}`);
        console.log(`  Team ID: ${player.team_id || 'Not set'}`);
        
        // If player has no name, update it
        if (!player.full_name) {
          // Get child name from parent_children if available
          const { data: childData, error: childError } = await supabase
            .from('parent_children')
            .select('full_name')
            .eq('parent_id', targetParent.id)
            .maybeSingle();
          
          if (!childError && childData && childData.full_name) {
            // Update player name from child record
            const { error: playerUpdateError } = await supabase
              .from('players')
              .update({ full_name: childData.full_name })
              .eq('id', player.id);
            
            if (playerUpdateError) {
              console.error(`Error updating player ${player.id}:`, playerUpdateError);
            } else {
              console.log(`  Updated player name to: ${childData.full_name}`);
            }
          }
        }
      }
    } else {
      console.log('\nNo players found for this parent');
    }
    
    console.log('\n✅ Successfully fixed parent record');
    
  } catch (error) {
    console.error('Error fixing parent:', error);
  }
}

fixParentTeamId()
  .then(() => console.log('\nFix complete'))
  .catch(err => console.error('Error running fix:', err)); 