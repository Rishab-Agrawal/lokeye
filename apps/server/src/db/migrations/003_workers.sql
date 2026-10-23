CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone TEXT UNIQUE NOT NULL,
  display_name TEXT,
  upi_vpa TEXT,
  expo_push_token TEXT,
  last_location GEOGRAPHY(POINT, 4326),
  last_location_at TIMESTAMPTZ,
  razorpay_contact_id TEXT,
  razorpay_fund_account_id TEXT,
  total_earned INTEGER NOT NULL DEFAULT 0,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_task_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial index for location-based queries
CREATE INDEX idx_workers_location ON workers USING GIST (last_location);

-- Index for active workers with recent location
CREATE INDEX idx_workers_active_location ON workers (is_active, last_location_at)
  WHERE is_active = true AND last_location IS NOT NULL;

-- Index for phone lookup (auth)
CREATE INDEX idx_workers_phone ON workers (phone);
