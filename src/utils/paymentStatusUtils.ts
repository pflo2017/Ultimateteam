import { supabase } from '../lib/supabase';

// Define the standard payment status values
export type PaymentStatus = 'paid' | 'not_paid';

// Call Supabase RPC to run payment status transitions
export const checkAndUpdatePaymentStatuses = async () => {
  try {
    const { data, error } = await supabase
      .rpc('run_status_transitions');
    
    if (error) {
      console.error('Error running status transitions:', error);
      return false;
    }
    
    console.log('Status transitions completed successfully');
    return true;
  } catch (err) {
    console.error('Exception running status transitions:', err);
    return false;
  }
};

// Get human-readable text for payment status
export const getPaymentStatusText = (status: string): string => {
  if (!status) return 'Not Paid';
  const normalizedStatus = status.toLowerCase();
  return normalizedStatus === 'paid' ? 'Paid' : 'Not Paid';
};

// Get color for payment status
export const getPaymentStatusColor = (status: string): string => {
  return status?.toLowerCase() === 'paid' ? '#4CAF50' : '#F44336';
};

// Get payment history for a player
export const getPlayerPaymentHistory = async (playerId: string, year: number) => {
  try {
    const { data, error } = await supabase
      .from('player_status_history')
      .select('*')
      .eq('player_id', playerId)
      .order('changed_at', { ascending: false })
      .limit(20);
      
    if (error) {
      console.error('Error fetching player payment history:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Exception fetching payment history:', err);
    return [];
  }
}; 