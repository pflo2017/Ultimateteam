require('dotenv').config();

console.log('Checking environment variables:');
console.log('EXPO_PUBLIC_SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL ? 'Available' : 'Missing');
console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'Available' : 'Missing');
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? 'Available' : 'Missing');

// List all environment variables (masked for security)
console.log('\nAll environment variables:');
Object.keys(process.env).forEach(key => {
  if (key.includes('SUPABASE') || key.includes('EXPO')) {
    const value = process.env[key];
    const maskedValue = value ? `${value.substring(0, 3)}...${value.substring(value.length - 3)}` : 'undefined';
    console.log(`${key}: ${maskedValue}`);
  }
}); 