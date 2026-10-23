CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id),
  worker_id UUID NOT NULL REFERENCES workers(id),
  amount_rupees INTEGER NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  razorpay_payout_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_task ON payments (task_id);
CREATE INDEX idx_payments_worker ON payments (worker_id);
CREATE INDEX idx_payments_status ON payments (status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_payments_razorpay ON payments (razorpay_payout_id) WHERE razorpay_payout_id IS NOT NULL;
