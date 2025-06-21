const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try to find the Supabase URL and anon key from app.json or environment variables
let supabaseUrl, supabaseAnonKey;

try {
  // First try to read from app.json
  const appJsonPath = path.join(__dirname, 'app.json');
  if (fs.existsSync(appJsonPath)) {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    supabaseUrl = appJson?.expo?.extra?.supabaseUrl;
    supabaseAnonKey = appJson?.expo?.extra?.supabaseAnonKey;
  }
  
  // If not found, try app.config.js
  if (!supabaseUrl || !supabaseAnonKey) {
    const appConfigPath = path.join(__dirname, 'app.config.js');
    if (fs.existsSync(appConfigPath)) {
      // We can't require directly as it might use process.env
      const configContent = fs.readFileSync(appConfigPath, 'utf8');
      
      // Extract using regex
      const urlMatch = configContent.match(/supabaseUrl:\s*["']([^"']+)["']/);
      const keyMatch = configContent.match(/supabaseAnonKey:\s*["']([^"']+)["']/);
      
      if (urlMatch) supabaseUrl = urlMatch[1];
      if (keyMatch) supabaseAnonKey = keyMatch[1];
    }
  }
  
  // If still not found, try environment variables
  if (!supabaseUrl) supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseAnonKey) supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  
} catch (error) {
  console.error('Error reading configuration:', error);
}

// Hardcoded values as last resort
if (!supabaseUrl) supabaseUrl = 'https://ulltpjezntzgiawchmaj.supabase.co';
if (!supabaseAnonKey) supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbHRwamV6bnR6Z2lhd2NobWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzMzczNDIsImV4cCI6MjA2MDkxMzM0Mn0.HZLgLWTSNEdTbE9HEaAQ92HkHe7k_gx4Pj2meQyZxfE';

// For admin operations, we need the service role key
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbHRwamV6bnR6Z2lhd2NobWFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTMzNzM0MiwiZXhwIjoyMDYwOTEzMzQyfQ.5MPohDgqv5b4U77jLnEZ-zeYVlazThOjNNKVzrcrfoI';

console.log('Using Supabase URL:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixParentAuth() {
  try {
    // Parent details to fix
    const parentPhone = '+40740404404';
    const parentEmail = 'test11@gmail.com';
    
    console.log(`Fixing parent account with phone: ${parentPhone}, email: ${parentEmail}`);
    
    // 1. Check if parent exists in the parents table
    const { data: parentData, error: parentError } = await supabase
      .from('parents')
      .select('*')
      .or(`phone_number.eq.${parentPhone},email.eq.${parentEmail}`)
      .maybeSingle();
    
    if (parentError) {
      console.error('Error fetching parent data:', parentError);
      return;
    }
    
    if (!parentData) {
      console.error('No parent found with the provided phone number or email');
      return;
    }
    
    console.log('Parent found in database:');
    console.log('ID:', parentData.id);
    console.log('Name:', parentData.name);
    console.log('Email:', parentData.email);
    
    // 2. Check if parent already has a user_id
    if (parentData.user_id) {
      console.log('Parent already has user_id:', parentData.user_id);
      
      // Verify if this user_id exists in auth
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
        parentData.user_id
      );
      
      if (userError) {
        console.error('Error fetching auth user:', userError);
      } else if (userData && userData.user) {
        console.log('Auth user exists and is linked correctly.');
        return;
      } else {
        console.log('User ID is set but no corresponding auth user found. Will attempt to fix.');
      }
    }
    
    // 3. Try to find an auth user by email or phone
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return;
    }
    
    const matchingUser = users.find(u => 
      u.email === parentData.email || 
      u.phone === parentData.phone_number
    );
    
    if (matchingUser) {
      console.log('Found matching auth user:', matchingUser.id);
      
      // 4. Update the parent record with the auth user ID
      const { error: updateError } = await supabase
        .from('parents')
        .update({ user_id: matchingUser.id })
        .eq('id', parentData.id);
      
      if (updateError) {
        console.error('Error updating parent user_id:', updateError);
      } else {
        console.log('✅ Successfully updated parent with user_id:', matchingUser.id);
      }
    } else {
      console.log('No matching auth user found. Creating new auth user...');
      
      // 5. Create a new auth user if none exists
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: parentData.email,
        phone: parentData.phone_number,
        password: 'tempPassword123', // You should use a secure password or generate one
        email_confirm: true,
        phone_confirm: true
      });
      
      if (createError) {
        console.error('Error creating auth user:', createError);
        return;
      }
      
      console.log('Created new auth user:', newUser.user.id);
      
      // 6. Update the parent record with the new auth user ID
      const { error: updateError } = await supabase
        .from('parents')
        .update({ user_id: newUser.user.id })
        .eq('id', parentData.id);
      
      if (updateError) {
        console.error('Error updating parent user_id:', updateError);
      } else {
        console.log('✅ Successfully updated parent with new user_id:', newUser.user.id);
      }
    }
    
  } catch (error) {
    console.error('Error fixing parent auth:', error);
  }
}

fixParentAuth(); 