require('dotenv').config();

/**
 * Checks if required environment variables are set
 * This script helps ensure all necessary environment variables are available
 * before running any of the utility scripts
 */

const requiredVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY'
];

const missingVars = [];

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    missingVars.push(varName);
  }
}

if (missingVars.length > 0) {
  console.error('❌ Error: Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease set these variables in a .env file or in your environment.');
  console.error('See the README.md for more information on required environment variables.');
  process.exit(1);
} else {
  console.log('✅ All required environment variables are set.');
  console.log('You can now run the utility scripts.');
}

// Export a function to check environment variables in other scripts
module.exports = {
  checkEnv: () => {
    if (missingVars.length > 0) {
      console.error('❌ Error: Missing required environment variables.');
      process.exit(1);
    }
    return true;
  }
}; 