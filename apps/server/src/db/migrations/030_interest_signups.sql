CREATE TABLE interest_signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_interest_signups_email ON interest_signups (email);

ALTER TABLE interest_signups ENABLE ROW LEVEL SECURITY;
