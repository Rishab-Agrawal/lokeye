-- Remove Razorpay-related columns and the obsolete payments table
-- Razorpay was replaced by manual UPI withdrawals via Telegram

-- Drop Razorpay columns from whichever table name exists at this migration point.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workers'
  ) THEN
    ALTER TABLE workers DROP COLUMN IF EXISTS razorpay_contact_id;
    ALTER TABLE workers DROP COLUMN IF EXISTS razorpay_fund_account_id;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'humans'
  ) THEN
    ALTER TABLE humans DROP COLUMN IF EXISTS razorpay_contact_id;
    ALTER TABLE humans DROP COLUMN IF EXISTS razorpay_fund_account_id;
  END IF;
END $$;

-- Drop the payments table (replaced by withdrawal_requests)
DROP TABLE IF EXISTS payments;

-- Drop the payment_status enum
DROP TYPE IF EXISTS payment_status;
