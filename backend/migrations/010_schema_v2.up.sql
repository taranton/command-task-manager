-- ============================================================
-- Migration 010: Schema V2 — Updated spec alignment
-- Story statuses: backlog, active, done, closed
-- Task statuses: backlog, to_do, in_progress, in_review, done
-- Subtask statuses: to_do, in_progress, done
-- position VARCHAR → sort_order INTEGER
-- New fields + new tables (comments, attachments, changelog)
-- ============================================================

-- ---- 1. STORIES ----

-- 1a. Drop old CHECK first
ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_status_check;

-- 1b. Migrate status data
UPDATE stories SET status = 'active' WHERE status IN ('todo', 'in_progress', 'in_review');

-- 1c. Add new CHECK
ALTER TABLE stories ADD CONSTRAINT stories_status_check
    CHECK (status IN ('backlog', 'active', 'done', 'closed'));

-- 1c. Add new columns
ALTER TABLE stories ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE stories ADD COLUMN IF NOT EXISTS assigned_lead UUID REFERENCES users(id);
ALTER TABLE stories ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 1d. Indexes
CREATE INDEX IF NOT EXISTS idx_stories_deleted_at ON stories(deleted_at);
CREATE INDEX IF NOT EXISTS idx_stories_assigned_lead ON stories(assigned_lead);

-- ---- 2. TASKS ----

-- 2a. Drop old CHECK first
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- 2b. Migrate status data
UPDATE tasks SET status = 'to_do' WHERE status = 'todo';

-- 2c-check. Add new CHECK
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('backlog', 'to_do', 'in_progress', 'in_review', 'done'));

-- 2c. Add new columns
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(6,1);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2d. Migrate position → sort_order
UPDATE tasks t SET sort_order = sub.rn * 1000
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY story_id ORDER BY position) AS rn
    FROM tasks
) sub
WHERE t.id = sub.id;

-- 2e. Drop position column
DROP INDEX IF EXISTS idx_tasks_position;
ALTER TABLE tasks DROP COLUMN IF EXISTS position;

-- 2f. Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks(sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);

-- ---- 3. SUBTASKS ----

-- 3a. Drop old CHECK first
ALTER TABLE subtasks DROP CONSTRAINT IF EXISTS subtasks_status_check;

-- 3b. Migrate status data
UPDATE subtasks SET status = 'to_do' WHERE status IN ('backlog', 'todo');
UPDATE subtasks SET status = 'done' WHERE status = 'in_review';

-- 3c-check. Add new CHECK
ALTER TABLE subtasks ADD CONSTRAINT subtasks_status_check
    CHECK (status IN ('to_do', 'in_progress', 'done'));

-- 3c. Add sort_order
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- 3d. Migrate position → sort_order
UPDATE subtasks s SET sort_order = sub.rn * 1000
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY task_id ORDER BY position) AS rn
    FROM subtasks
) sub
WHERE s.id = sub.id;

-- 3e. Drop position column
ALTER TABLE subtasks DROP COLUMN IF EXISTS position;

-- ---- 4. NEW TABLES ----

CREATE TABLE IF NOT EXISTS command_comments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type   VARCHAR(20) NOT NULL CHECK (entity_type IN ('story', 'task', 'subtask')),
    entity_id     UUID NOT NULL,
    author_id     UUID NOT NULL REFERENCES users(id),
    body          TEXT NOT NULL,
    is_edited     BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_entity ON command_comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON command_comments(author_id);

CREATE TABLE IF NOT EXISTS command_attachments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id    UUID NOT NULL REFERENCES command_comments(id) ON DELETE CASCADE,
    file_name     VARCHAR(500) NOT NULL,
    file_size     BIGINT,
    mime_type     VARCHAR(255),
    storage_path  TEXT NOT NULL,
    uploaded_by   UUID NOT NULL REFERENCES users(id),
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_comment ON command_attachments(comment_id);

CREATE TABLE IF NOT EXISTS command_changelog (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type   VARCHAR(20) NOT NULL CHECK (entity_type IN ('story', 'task', 'subtask')),
    entity_id     UUID NOT NULL,
    action        VARCHAR(50) NOT NULL,
    field         VARCHAR(100),
    old_value     TEXT,
    new_value     TEXT,
    changed_by    UUID REFERENCES users(id),
    changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_changelog_entity ON command_changelog(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_changelog_changed_at ON command_changelog(changed_at);
