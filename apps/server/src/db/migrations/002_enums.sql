-- Task type enum
CREATE TYPE task_type AS ENUM ('photo', 'video', 'text');

-- Task status enum
CREATE TYPE task_status AS ENUM (
  'pending', 'assigned', 'in_progress', 'submitted',
  'completed', 'expired', 'cancelled'
);

-- Payment status enum
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'paid', 'failed');

-- Credit transaction type enum
CREATE TYPE credit_txn_type AS ENUM ('topup', 'task_hold', 'task_release', 'task_charge');
