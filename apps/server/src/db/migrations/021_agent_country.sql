-- Add country field to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS country TEXT;
