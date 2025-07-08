-- Migration: Add payment_method column to monthly_payments
-- Adds a payment_method ENUM and column to track how each payment was made

-- 1. Create ENUM type if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type') THEN
    CREATE TYPE payment_method_type AS ENUM ('cash', 'bank_transfer', 'card', 'other');
  END IF;
END$$;

-- 2. Add the column to the table
ALTER TABLE monthly_payments
  ADD COLUMN IF NOT EXISTS payment_method payment_method_type;

-- 3. (Optional) Add a comment for clarity
COMMENT ON COLUMN monthly_payments.payment_method IS 'How the payment was made (cash, bank_transfer, card, other)'; 