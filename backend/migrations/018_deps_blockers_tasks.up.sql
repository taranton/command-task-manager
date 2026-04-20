-- Link dependencies and external blockers to specific tasks (optional).
-- When the referenced task transitions to 'done', the dep/blocker auto-resolves.

ALTER TABLE command_story_deps
    ADD COLUMN IF NOT EXISTS to_task UUID REFERENCES tasks(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_story_deps_to_task ON command_story_deps(to_task);

ALTER TABLE command_external_blockers
    ADD COLUMN IF NOT EXISTS blocking_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_blockers_blocking_task ON command_external_blockers(blocking_task_id);
