-- Track when workers were last notified about a pending task
ALTER TABLE tasks ADD COLUMN last_notified_at TIMESTAMPTZ;
