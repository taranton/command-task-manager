#!/bin/bash
set -e

echo "=== Command Task Manager — Deploy ==="
echo ""

cd /opt/command-task-manager

# 1. Pull latest code
echo "1. Pulling latest code..."
git pull

# 2. Database migration
echo "2. Running database migration..."

DB="command"
PG="sudo -u postgres psql -d $DB -c"

# Stories: drop old constraint, migrate data, add new constraint + columns
$PG "ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_status_check;" 2>/dev/null || true
$PG "UPDATE stories SET status = 'active' WHERE status IN ('todo', 'in_progress', 'in_review');" 2>/dev/null || true
$PG "ALTER TABLE stories ADD CONSTRAINT stories_status_check CHECK (status IN ('backlog', 'active', 'done', 'closed'));" 2>/dev/null || true
$PG "ALTER TABLE stories ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';"
$PG "ALTER TABLE stories ADD COLUMN IF NOT EXISTS assigned_lead UUID REFERENCES users(id);"
$PG "ALTER TABLE stories ADD COLUMN IF NOT EXISTS start_date DATE;"
$PG "ALTER TABLE stories ADD COLUMN IF NOT EXISTS deadline DATE;"
$PG "ALTER TABLE stories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;"
$PG "ALTER TABLE stories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;"
echo "   Stories ✓"

# Tasks: drop old constraint, migrate data, add new constraint + columns, position → sort_order
$PG "ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;" 2>/dev/null || true
$PG "UPDATE tasks SET status = 'to_do' WHERE status = 'todo';" 2>/dev/null || true
$PG "ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('backlog', 'to_do', 'in_progress', 'in_review', 'done'));" 2>/dev/null || true
$PG "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(6,1);"
$PG "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;"
$PG "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;"
# Migrate position → sort_order (only if position column exists)
$PG "UPDATE tasks t SET sort_order = sub.rn * 1000 FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY story_id ORDER BY position) AS rn FROM tasks) sub WHERE t.id = sub.id;" 2>/dev/null || true
$PG "DROP INDEX IF EXISTS idx_tasks_position;" 2>/dev/null || true
$PG "ALTER TABLE tasks DROP COLUMN IF EXISTS position;"
echo "   Tasks ✓"

# Subtasks: same pattern
$PG "ALTER TABLE subtasks DROP CONSTRAINT IF EXISTS subtasks_status_check;" 2>/dev/null || true
$PG "UPDATE subtasks SET status = 'to_do' WHERE status IN ('backlog', 'todo');" 2>/dev/null || true
$PG "UPDATE subtasks SET status = 'done' WHERE status = 'in_review';" 2>/dev/null || true
$PG "ALTER TABLE subtasks ADD CONSTRAINT subtasks_status_check CHECK (status IN ('to_do', 'in_progress', 'done'));" 2>/dev/null || true
$PG "ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;"
$PG "UPDATE subtasks s SET sort_order = sub.rn * 1000 FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY task_id ORDER BY position) AS rn FROM subtasks) sub WHERE s.id = sub.id;" 2>/dev/null || true
$PG "ALTER TABLE subtasks DROP COLUMN IF EXISTS position;"
echo "   Subtasks ✓"

# New tables (comments, attachments, changelog) — idempotent
sudo -u postgres psql -d $DB <<'SQL'
CREATE TABLE IF NOT EXISTS command_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('story', 'task', 'subtask')),
    entity_id UUID NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    is_edited BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_entity ON command_comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON command_comments(author_id);

CREATE TABLE IF NOT EXISTS command_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES command_comments(id) ON DELETE CASCADE,
    file_name VARCHAR(500) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(255),
    storage_path TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attachments_comment ON command_attachments(comment_id);

CREATE TABLE IF NOT EXISTS command_changelog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('story', 'task', 'subtask')),
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    field VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_changelog_entity ON command_changelog(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_changelog_changed_at ON command_changelog(changed_at);
SQL
echo "   New tables ✓"

# Indexes
$PG "CREATE INDEX IF NOT EXISTS idx_stories_deleted_at ON stories(deleted_at);" 2>/dev/null || true
$PG "CREATE INDEX IF NOT EXISTS idx_stories_assigned_lead ON stories(assigned_lead);" 2>/dev/null || true
$PG "CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks(sort_order);" 2>/dev/null || true
$PG "CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);" 2>/dev/null || true
echo "   Indexes ✓"

# Grant permissions to app user
$PG "GRANT ALL ON command_comments TO command;" 2>/dev/null || true
$PG "GRANT ALL ON command_changelog TO command;" 2>/dev/null || true
$PG "GRANT ALL ON command_attachments TO command;" 2>/dev/null || true
echo "   Permissions ✓"

echo "   Migration complete!"

# 3. Build backend
echo "3. Building backend..."
cd backend
go build -o server ./cmd/server
cd ..
echo "   Backend ✓"

# 4. Build frontend
echo "4. Building frontend..."
cd frontend
npm run build
cd ..
echo "   Frontend ✓"

# 5. Restart services
echo "5. Restarting services..."
pm2 restart command-api command-web
sleep 2

# 6. Verify
echo "6. Verifying..."
curl -s http://localhost:8070/health
echo ""
pm2 status | grep command

echo ""
echo "=== Deploy complete! ==="
echo "Visit: https://command-test.qrtpower.com"
