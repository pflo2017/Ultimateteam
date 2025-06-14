import { createClient } from '@supabase/supabase-js';

// Use the same Supabase project as the mobile app
const supabaseUrl = 'https://ulltpjezntzgiawchmaj.supabase.co';
// We'll need to use a different API key for the admin dashboard
// This should be an "anon" key with limited permissions controlled by RLS policies
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbHRwamV6bnR6Z2lhd2NobWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NjUxNTYzOTYsImV4cCI6MTk4MDczMjM5Nn0.Wvl-8aP7E6fFxsKdGsKEHrNIQrfvYIzCUX1ZPu5vJeA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to get authenticated user
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Helper function to check if user is a master admin
export const isMasterAdmin = async () => {
  const user = await getCurrentUser();
  if (!user) return false;
  
  const { data, error } = await supabase
    .from('master_admins')
    .select('id')
    .eq('user_id', user.id)
    .single();
    
  return !!data && !error;
};

// Helper function to check if user is a super admin
export const isSuperAdmin = async () => {
  const user = await getCurrentUser();
  if (!user) return false;
  
  const { data, error } = await supabase
    .from('master_admins')
    .select('is_super_admin')
    .eq('user_id', user.id)
    .single();
    
  return data?.is_super_admin === true && !error;
}; 