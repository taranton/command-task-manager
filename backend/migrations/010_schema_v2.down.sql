-- Reverse migration 010

-- Drop new tables
DROP TABLE IF EXISTS command_attachments;
DROP TABLE IF EXISTS command_comments;
DROP TABLE IF EXISTS command_changelog;

-- Subtasks: restore position, restore old statuses
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS position VARCHAR(255) NOT NULL DEFAULT 'U';
UPDATE subtasks SET position = LPAD(sort_order::text, 10, '0');
ALTER TABLE subtasks DROP COLUMN IF EXISTS sort_order;
UPDATE subtasks SET status = 'backlog' WHERE status = 'to_do';
ALTER TABLE subtasks DROP CONSTRAINT IF EXISTS subtasks_status_check;
ALTER TABLE subtasks ADD CONSTRAINT subtasks_status_check
    CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'closed'));

-- Tasks: restore position, restore old statuses
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position VARCHAR(255) NOT NULL DEFAULT 'U';
UPDATE tasks SET position = LPAD(sort_order::text, 10, '0');
ALTER TABLE tasks DROP COLUMN IF EXISTS sort_order;
ALTER TABLE tasks DROP COLUMN IF EXISTS estimated_hours;
ALTER TABLE tasks DROP COLUMN IF EXISTS deleted_at;
DROP INDEX IF EXISTS idx_tasks_sort_order;
DROP INDEX IF EXISTS idx_tasks_deleted_at;
UPDATE tasks SET status = 'todo' WHERE status = 'to_do';
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'closed'));

-- Stories: restore old statuses, drop new columns
ALTER TABLE stories DROP COLUMN IF EXISTS tags;
ALTER TABLE stories DROP COLUMN IF EXISTS assigned_lead;
ALTER TABLE stories DROP COLUMN IF EXISTS start_date;
ALTER TABLE stories DROP COLUMN IF EXISTS deadline;
ALTER TABLE stories DROP COLUMN IF EXISTS sort_order;
ALTER TABLE stories DROP COLUMN IF EXISTS deleted_at;
DROP INDEX IF EXISTS idx_stories_deleted_at;
DROP INDEX IF EXISTS idx_stories_assigned_lead;
UPDATE stories SET status = 'in_progress' WHERE status = 'active';
ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_status_check;
ALTER TABLE stories ADD CONSTRAINT stories_status_check
    CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'closed'));
