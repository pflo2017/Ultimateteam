import React, { useEffect, useState } from 'react';
import { checkAndUpdatePaymentStatuses } from './utils/paymentStatusUtils';
import SuspendedClubBanner from './components/SuspendedClubBanner';
import { getUserClubId } from './services/activitiesService';
import { supabase } from './lib/supabase';

// Add this inside the App component function, before the return statement
// Check and update payment statuses on app startup
useEffect(() => {
  const updateStatuses = async () => {
    await checkAndUpdatePaymentStatuses();
  };
  
  updateStatuses();
}, []);

function App() {
  const [isSuspended, setIsSuspended] = useState(false);
  const [checkedSuspension, setCheckedSuspension] = useState(false);
  const [clubName, setClubName] = useState<string | undefined>(undefined);

  useEffect(() => {
    const checkSuspension = async () => {
      try {
        const clubId = await getUserClubId();
        if (!clubId) {
          setCheckedSuspension(true);
          return;
        }
        const { data, error } = await supabase
          .from('clubs')
          .select('is_suspended, name')
          .eq('id', clubId)
          .single();
        if (error) {
          setCheckedSuspension(true);
          return;
        }
        setIsSuspended(data?.is_suspended === true);
        setClubName(data?.name);
      } catch (e) {
        setCheckedSuspension(true);
      } finally {
        setCheckedSuspension(true);
      }
    };
    checkSuspension();
  }, []);

  if (!checkedSuspension) return null;

  return (
    <>
      {isSuspended && (
        <SuspendedClubBanner supportEmail="support@example.com" clubName={clubName} />
      )}
      {/* ...existing app content... */}
    </>
  );
}

export default App; 