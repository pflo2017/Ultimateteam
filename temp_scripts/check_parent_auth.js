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
if (!supabaseAnonKey) supabaseAnonKey = 'process.env.SUPABASE_SERVICE_KEY || "REMOVED_FOR_SECURITY"';

// For admin operations, we need the service role key
// This is not ideal for security, but for this script it's acceptable
const supabaseServiceKey = 'process.env.SUPABASE_SERVICE_KEY || "REMOVED_FOR_SECURITY"';

console.log('Using Supabase URL:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkParentAuth() {
  try {
    // Parent details to check
    const parentPhone = '+40740404404';
    const parentEmail = 'test11@gmail.com';
    
    console.log(`Checking parent account with phone: ${parentPhone}, email: ${parentEmail}`);
    
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
    console.log('Phone:', parentData.phone_number);
    console.log('Email:', parentData.email);
    console.log('User ID:', parentData.user_id || 'Not set');
    
    // 2. Check if there's an auth account for this parent
    if (parentData.user_id) {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
        parentData.user_id
      );
      
      if (userError) {
        console.error('Error fetching auth user:', userError);
      } else if (userData && userData.user) {
        console.log('\nAuth user found:');
        console.log('Auth ID:', userData.user.id);
        console.log('Auth Email:', userData.user.email);
        console.log('Auth Phone:', userData.user.phone || 'Not set');
        console.log('Last Sign In:', userData.user.last_sign_in_at);
        console.log('\nAuth status: ✅ Parent has proper authentication');
      } else {
        console.log('\nAuth status: ❌ No auth user found with ID', parentData.user_id);
      }
    } else {
      console.log('\nAuth status: ❌ Parent has no user_id set');
      
      // Try to find auth user by email
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
        console.log('\nFound potential matching auth user:');
        console.log('Auth ID:', matchingUser.id);
        console.log('Auth Email:', matchingUser.email);
        console.log('Auth Phone:', matchingUser.phone || 'Not set');
        
        console.log('\nWould you like to link this auth user to the parent? (Run fix_parent_auth.js)');
      } else {
        console.log('\nNo matching auth user found by email or phone');
      }
    }
    
  } catch (error) {
    console.error('Error checking parent auth:', error);
  }
}

checkParentAuth(); 