DROP INDEX IF EXISTS idx_stories_archived_at;
ALTER TABLE stories DROP COLUMN IF EXISTS archived_at;
