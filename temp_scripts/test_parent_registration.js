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

// Extract Supabase anon key using regex
const supabaseKeyMatch = configContent.match(/supabaseAnonKey:.*?["']([^"']+)["']/);
if (!supabaseKeyMatch) {
  console.error('Could not find supabaseAnonKey in app.config.js');
  process.exit(1);
}
const SUPABASE_ANON_KEY = supabaseKeyMatch[1];

// Service role key must be provided as an environment variable for security
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

console.log('Using Supabase URL:', SUPABASE_URL);
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Test data
const testData = {
  fullName: 'Test Parent Script',
  email: 'testparentscript@example.com',
  phoneNumber: '+40760600601', // Different from the one you mentioned
  password: 'test123456'
};

async function testParentRegistration() {
  console.log('Starting parent registration test...');
  
  try {
    // 1. Check if phone or email already exists
    console.log('Checking if phone number or email already exists...');
    const { data: existingParent, error: checkError } = await supabase
      .from('parents')
      .select('id')
      .or(`phone_number.eq.${testData.phoneNumber},email.eq.${testData.email}`);
    
    if (checkError) {
      console.error('Error checking existing parent:', checkError);
      return;
    }
    
    if (existingParent && existingParent.length > 0) {
      console.log('Parent with this phone or email already exists. Deleting...');
      
      // Delete existing parent for testing
      const { error: deleteError } = await supabase
        .from('parents')
        .delete()
        .or(`phone_number.eq.${testData.phoneNumber},email.eq.${testData.email}`);
        
      if (deleteError) {
        console.error('Error deleting existing parent:', deleteError);
        return;
      }
    }
    
    // 2. Create Supabase Auth user
    console.log('Creating Supabase Auth user...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testData.email,
      password: testData.password,
      phone: testData.phoneNumber
    });
    
    if (authError) {
      console.error('Error creating auth user:', authError);
      return;
    }
    
    if (!authData.user) {
      console.error('No user returned from auth signup');
      return;
    }
    
    const userId = authData.user.id;
    console.log('Created auth user with ID:', userId);
    
    // 3. Create parent record
    console.log('Creating parent record...');
    const { data: parent, error: createError } = await supabase
      .from('parents')
      .insert([{
        name: testData.fullName,
        email: testData.email,
        phone_number: testData.phoneNumber,
        password: testData.password,
        is_active: true,
        phone_verified: true,
        user_id: userId
      }])
      .select('*')
      .single();
      
    if (createError) {
      console.error('Error creating parent:', createError);
      return;
    }
    
    console.log('Successfully created parent:');
    console.log(JSON.stringify(parent, null, 2));
    
    // 4. Verify the parent has the user_id
    if (parent.user_id === userId) {
      console.log('✅ SUCCESS: Parent record has the correct user_id');
    } else {
      console.log('❌ ERROR: Parent record does not have the correct user_id');
      console.log(`Expected: ${userId}, Actual: ${parent.user_id || 'null'}`);
    }
    
  } catch (err) {
    console.error('Unexpected error during test:', err);
  }
}

testParentRegistration()
  .then(() => console.log('Test completed'))
  .catch(err => console.error('Error running test:', err)); 