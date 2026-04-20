-- Story archive: separate from soft-delete.
-- archived_at IS NOT NULL means the story is shelved (hidden from active views)
-- but preserved for restore. Tasks inside stay intact.
ALTER TABLE stories ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_stories_archived_at ON stories(archived_at);
