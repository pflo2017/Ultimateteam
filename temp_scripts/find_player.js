require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findPlayer() {
  console.log('Searching for player "Child 10"...');
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .ilike('name', '%Child 10%');
  
  if (error) {
    console.error('Error searching for player:', error);
  } else {
    console.log('Found players:', JSON.stringify(data, null, 2));
  }
}

findPlayer(); 