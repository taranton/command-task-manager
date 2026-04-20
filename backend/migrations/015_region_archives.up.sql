-- Region archives: snapshot of everything in a region at delete time.
-- Delete now archives instead of blocking. Users/teams stay but lose region_id.

CREATE TABLE IF NOT EXISTS region_archives (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_id  UUID NOT NULL,                   -- the region's original UUID (may be reused later)
    name         VARCHAR(255) NOT NULL,
    code         VARCHAR(20) NOT NULL,
    description  TEXT,
    payload      JSONB NOT NULL,                  -- full snapshot: users, teams, stories, tasks, releases, events
    counts       JSONB NOT NULL,                  -- pre-computed counts for list view
    archived_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_by  UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_region_archives_archived_at ON region_archives(archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_region_archives_original ON region_archives(original_id);
