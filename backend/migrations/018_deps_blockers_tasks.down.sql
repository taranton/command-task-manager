DROP INDEX IF EXISTS idx_blockers_blocking_task;
DROP INDEX IF EXISTS idx_story_deps_to_task;
ALTER TABLE command_external_blockers DROP COLUMN IF EXISTS blocking_task_id;
ALTER TABLE command_story_deps DROP COLUMN IF EXISTS to_task;
