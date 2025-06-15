import { createClient } from '@supabase/supabase-js';

// Use the same Supabase project as the mobile app
const supabaseUrl = 'https://ulltpjezntzgiawchmaj.supabase.co';
// We'll need to use a different API key for the admin dashboard
// This should be an "anon" key with limited permissions controlled by RLS policies
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbHRwamV6bnR6Z2lhd2NobWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzMzczNDIsImV4cCI6MjA2MDkxMzM0Mn0.HZLgLWTSNEdTbE9HEaAQ92HkHe7k_gx4Pj2meQyZxfE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to get authenticated user
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Helper function to check if user is a master admin
export const isMasterAdmin = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log('No authenticated user found');
      return false;
    }
    
    console.log('Checking if user is master admin:', user.id);
    
    // Try to get the master admin record
    const { data, error } = await supabase
      .from('master_admins')
      .select('*')
      .eq('user_id', user.id);
      
    console.log('Master admin check result:', { data, error });
    
    // Return true if we found at least one record and no error
    return Array.isArray(data) && data.length > 0 && !error;
  } catch (error) {
    console.error('Error checking master admin status:', error);
    return false;
  }
};

// Helper function to check if user is a super admin
export const isSuperAdmin = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log('No authenticated user found');
      return false;
    }
    
    console.log('Checking if user is super admin:', user.id);
    
    // Try to get the master admin record with super admin flag
    const { data, error } = await supabase
      .from('master_admins')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_super_admin', true);
      
    console.log('Super admin check result:', { data, error });
    
    // Return true if we found at least one record and no error
    return Array.isArray(data) && data.length > 0 && !error;
  } catch (error) {
    console.error('Error checking super admin status:', error);
    return false;
  }
}; 