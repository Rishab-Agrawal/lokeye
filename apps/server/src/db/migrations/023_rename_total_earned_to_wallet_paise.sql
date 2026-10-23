-- Rename human wallet column for clarity.
-- Existing meaning remains unchanged: this is the withdrawable wallet balance.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'humans'
      AND column_name = 'total_earned'
  ) THEN
    ALTER TABLE humans RENAME COLUMN total_earned TO wallet_rupees;
  END IF;
END $$;
