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
const supabaseServiceKey = 'process.env.SUPABASE_SERVICE_KEY || "REMOVED_FOR_SECURITY"';

console.log('Using Supabase URL:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkParentAuth() {
  try {
    // Parent details to check
    const parentPhone = '+40760600600';
    
    console.log(`Checking parent account with phone: ${parentPhone}`);
    
    // 1. Check if parent exists in the parents table
    const { data: parentData, error: parentError } = await supabase
      .from('parents')
      .select('*')
      .eq('phone_number', parentPhone)
      .maybeSingle();
    
    if (parentError) {
      console.error('Error fetching parent data:', parentError);
      return;
    }
    
    if (!parentData) {
      console.error('No parent found with the provided phone number');
      return;
    }
    
    console.log('Parent found in database:');
    console.log('ID:', parentData.id);
    console.log('Name:', parentData.name);
    console.log('Phone:', parentData.phone_number);
    console.log('Email:', parentData.email);
    console.log('User ID:', parentData.user_id || 'Not set');
    
    // 2. Check if there's an auth account for this parent by email
    console.log('\nChecking for auth accounts with matching email or phone...');
    
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return;
    }
    
    // Look for matching users by email or phone
    const matchingUsers = users.filter(u => 
      (parentData.email && u.email === parentData.email) || 
      (u.phone && u.phone.includes(parentData.phone_number.replace('+', '')))
    );
    
    if (matchingUsers.length > 0) {
      console.log(`Found ${matchingUsers.length} matching auth users:`);
      matchingUsers.forEach((user, index) => {
        console.log(`\nMatching user #${index + 1}:`);
        console.log('Auth ID:', user.id);
        console.log('Auth Email:', user.email);
        console.log('Auth Phone:', user.phone || 'Not set');
        console.log('Created at:', user.created_at);
        console.log('Last Sign In:', user.last_sign_in_at);
      });
      
      // If parent has no user_id but we found a matching auth user, suggest fixing
      if (!parentData.user_id && matchingUsers.length > 0) {
        console.log('\nSuggested fix: Link this parent to auth user ID', matchingUsers[0].id);
        console.log('Run: node fix_parent_auth.js');
      }
    } else {
      console.log('No matching auth users found');
      
      // Check if there's any auth account with this phone number
      const phoneWithoutPlus = parentData.phone_number.replace('+', '');
      const anyPhoneMatch = users.find(u => u.phone && u.phone.includes(phoneWithoutPlus));
      
      if (anyPhoneMatch) {
        console.log('\nFound a potential phone number match with different formatting:');
        console.log('Auth ID:', anyPhoneMatch.id);
        console.log('Auth Phone:', anyPhoneMatch.phone);
        console.log('Auth Email:', anyPhoneMatch.email);
      }
    }
    
  } catch (error) {
    console.error('Error checking parent auth:', error);
  }
}

checkParentAuth(); 