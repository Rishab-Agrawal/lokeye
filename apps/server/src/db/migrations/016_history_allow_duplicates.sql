-- Allow multiple history entries per worker+task so rejection history is preserved
-- when the same worker re-does the same task.

DROP INDEX idx_worker_task_history_unique;
