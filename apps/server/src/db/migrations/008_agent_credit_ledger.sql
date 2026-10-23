CREATE TABLE agent_credit_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  txn_type credit_txn_type NOT NULL,
  amount_rupees INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  task_id UUID REFERENCES tasks(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_ledger_agent ON agent_credit_ledger (agent_id, created_at DESC);
CREATE INDEX idx_credit_ledger_task ON agent_credit_ledger (task_id) WHERE task_id IS NOT NULL;
