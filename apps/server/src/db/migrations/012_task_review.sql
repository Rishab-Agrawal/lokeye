-- Phase 5: Task Review System

-- Add rejection tracking to tasks
ALTER TABLE tasks ADD COLUMN rejection_reason TEXT;
ALTER TABLE tasks ADD COLUMN rejection_count INTEGER NOT NULL DEFAULT 0;

-- Add review stats to agents for rejection rate tracking
ALTER TABLE agents ADD COLUMN total_reviews INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN total_rejections INTEGER NOT NULL DEFAULT 0;

-- Index for submitted tasks awaiting review (used by auto-approve cron)
CREATE INDEX idx_tasks_submitted_at ON tasks (submitted_at)
  WHERE status = 'submitted';
