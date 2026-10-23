-- Remove 'text' from task_type enum
-- NOTE: Will fail if any existing rows have type='text'. Clean up data first if needed.

ALTER TYPE task_type RENAME TO task_type_old;
CREATE TYPE task_type AS ENUM('photo', 'video');
ALTER TABLE tasks ALTER COLUMN type TYPE task_type USING type::text::task_type;
DROP TYPE task_type_old;
