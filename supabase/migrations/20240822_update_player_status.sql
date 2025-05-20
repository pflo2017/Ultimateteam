-- First drop the existing constraint on payment_status
ALTER TABLE public.players
DROP CONSTRAINT IF EXISTS players_payment_status_check;

-- Add a new constraint that accepts all the status values used in the UI
ALTER TABLE public.players
ADD CONSTRAINT players_payment_status_check 
CHECK (payment_status IN ('paid', 'pending', 'missed', 'unpaid', 'on_trial', 'trial_ended', 'select_status'));

-- Update the payment statuses that need conversion
UPDATE public.players
SET payment_status = 'unpaid'
WHERE payment_status = 'pending';

-- Grant permissions
GRANT ALL ON public.players TO anon, authenticated, service_role; 