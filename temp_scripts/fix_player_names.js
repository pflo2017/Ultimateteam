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

async function fixPlayerNames() {
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
    
    console.log('=== PARENT INFO ===');
    console.log(`ID: ${targetParent.id}`);
    console.log(`Name: ${targetParent.name}`);
    
    // 2. Get the children from parent_children table
    const { data: children, error: childrenError } = await supabase
      .from('parent_children')
      .select('*')
      .eq('parent_id', targetParent.id);
    
    if (childrenError) {
      console.error('Error fetching children:', childrenError);
    }
    
    // 3. First, check the structure of the parent_children table to understand required fields
    const { data: sampleChild, error: sampleError } = await supabase
      .from('parent_children')
      .select('*')
      .limit(1)
      .maybeSingle();
    
    if (sampleError) {
      console.error('Error fetching sample child:', sampleError);
    } else if (sampleChild) {
      console.log('\n=== SAMPLE CHILD STRUCTURE ===');
      console.log(Object.keys(sampleChild).join(', '));
    }
    
    // If no children in parent_children table, we need to create them
    if (!children || children.length === 0) {
      console.log('\nNo children found in parent_children table. Creating children records...');
      
      // 4. Get players associated with this parent
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('parent_id', targetParent.id);
      
      if (playersError) {
        console.error('Error fetching players:', playersError);
        return;
      }
      
      if (!players || players.length === 0) {
        console.log('No players found for this parent');
        return;
      }
      
      console.log(`Found ${players.length} players associated with this parent`);
      
      // Get the team details to determine appropriate birth dates
      let birthYear = 2010; // Default birth year if we can't determine from team
      
      if (players[0].team_id) {
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('*')
          .eq('id', players[0].team_id)
          .maybeSingle();
        
        if (!teamError && teamData) {
          console.log(`Team found: ${teamData.name}`);
          // Try to extract birth year from team name or age_group
          if (teamData.name) {
            const yearMatch = teamData.name.match(/\b(20\d{2})\b/);
            if (yearMatch) {
              birthYear = parseInt(yearMatch[1]);
              console.log(`Extracted birth year from team name: ${birthYear}`);
            }
          }
        }
      }
      
      // Create child names based on parent name
      const childrenToCreate = [];
      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        const childName = `${targetParent.name.split(' ')[0]} Child ${i + 1}`;
        
        // Generate a birth date based on the birth year
        // Use January 1st plus the index to make them unique
        const birthDate = `${birthYear}-01-${String(i + 1).padStart(2, '0')}`;
        
        childrenToCreate.push({
          parent_id: targetParent.id,
          full_name: childName,
          team_id: player.team_id,
          birth_date: birthDate,
          medical_visa_status: 'pending' // Add required field
        });
      }
      
      // Create children records
      const { data: createdChildren, error: createError } = await supabase
        .from('parent_children')
        .insert(childrenToCreate)
        .select();
      
      if (createError) {
        console.error('Error creating children:', createError);
        return;
      }
      
      console.log('\n=== CREATED CHILDREN ===');
      createdChildren.forEach(child => {
        console.log(`- ID: ${child.id}`);
        console.log(`  Name: ${child.full_name}`);
        console.log(`  Birth Date: ${child.birth_date}`);
        console.log(`  Medical Visa: ${child.medical_visa_status}`);
        console.log(`  Team ID: ${child.team_id || 'Not set'}`);
      });
      
      // 5. Update player names with the created children names
      for (let i = 0; i < players.length && i < createdChildren.length; i++) {
        const player = players[i];
        const child = createdChildren[i];
        
        console.log(`\nUpdating player ${player.id} with name: ${child.full_name}`);
        
        const { error: updateError } = await supabase
          .from('players')
          .update({ full_name: child.full_name })
          .eq('id', player.id);
        
        if (updateError) {
          console.error(`Error updating player ${player.id}:`, updateError);
        } else {
          console.log(`✅ Successfully updated player name`);
        }
      }
    } else {
      // Children already exist, update player names with these children
      console.log(`\nFound ${children.length} children in parent_children table`);
      
      // Get players associated with this parent
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('parent_id', targetParent.id);
      
      if (playersError) {
        console.error('Error fetching players:', playersError);
        return;
      }
      
      if (!players || players.length === 0) {
        console.log('No players found for this parent');
        return;
      }
      
      console.log(`Found ${players.length} players associated with this parent`);
      
      // Update player names with child names
      for (let i = 0; i < players.length && i < children.length; i++) {
        const player = players[i];
        const child = children[i];
        
        console.log(`\nUpdating player ${player.id} with name: ${child.full_name}`);
        
        const { error: updateError } = await supabase
          .from('players')
          .update({ full_name: child.full_name })
          .eq('id', player.id);
        
        if (updateError) {
          console.error(`Error updating player ${player.id}:`, updateError);
        } else {
          console.log(`✅ Successfully updated player name`);
        }
      }
    }
    
    // 6. Verify the updates
    const { data: updatedPlayers, error: verifyError } = await supabase
      .from('players')
      .select('*')
      .eq('parent_id', targetParent.id);
    
    if (verifyError) {
      console.error('Error verifying player updates:', verifyError);
    } else {
      console.log('\n=== UPDATED PLAYERS ===');
      updatedPlayers.forEach(player => {
        console.log(`- ID: ${player.id}`);
        console.log(`  Name: ${player.full_name || 'undefined'}`);
        console.log(`  Team ID: ${player.team_id || 'Not set'}`);
      });
    }
    
    console.log('\n✅ Player name fix process complete');
    
  } catch (error) {
    console.error('Error fixing player names:', error);
  }
}

fixPlayerNames()
  .then(() => console.log('\nFix complete'))
  .catch(err => console.error('Error running fix:', err)); 