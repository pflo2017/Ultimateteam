import React, { useEffect } from 'react';
import { checkAndUpdatePaymentStatuses } from './utils/paymentStatusUtils';

// Add this inside the App component function, before the return statement
// Check and update payment statuses on app startup
useEffect(() => {
  const updateStatuses = async () => {
    await checkAndUpdatePaymentStatuses();
  };
  
  updateStatuses();
}, []); 