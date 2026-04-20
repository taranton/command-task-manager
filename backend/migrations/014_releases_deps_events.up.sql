-- Phase 4: Releases, Story Dependencies, External Blockers, Timeline Events

-- ---- Releases ----
CREATE TABLE IF NOT EXISTS command_releases (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    release_date DATE NOT NULL,
    label        VARCHAR(255) NOT NULL,
    release_type VARCHAR(20) NOT NULL DEFAULT 'minor'
                 CHECK (release_type IN ('major', 'minor', 'patch')),
    region_id    UUID REFERENCES regions(id) ON DELETE SET NULL,
    office       VARCHAR(100),                       -- free-text for UI color grouping
    description  TEXT,
    created_by   UUID REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_releases_date ON command_releases(release_date);
CREATE INDEX IF NOT EXISTS idx_releases_region ON command_releases(region_id);

CREATE TABLE IF NOT EXISTS command_release_stories (
    release_id UUID NOT NULL REFERENCES command_releases(id) ON DELETE CASCADE,
    story_id   UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    PRIMARY KEY (release_id, story_id)
);

-- ---- Story dependencies (directed: from depends on to) ----
CREATE TABLE IF NOT EXISTS command_story_deps (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_story UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    to_story   UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    reason     TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (from_story, to_story),
    CHECK (from_story <> to_story)
);
CREATE INDEX IF NOT EXISTS idx_story_deps_from ON command_story_deps(from_story);
CREATE INDEX IF NOT EXISTS idx_story_deps_to   ON command_story_deps(to_story);

-- ---- External blockers on stories ----
CREATE TABLE IF NOT EXISTS command_external_blockers (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id           UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    blocker_description TEXT NOT NULL,
    severity           VARCHAR(20) NOT NULL DEFAULT 'high'
                       CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    since_date         DATE NOT NULL,
    resolved_at        TIMESTAMPTZ,
    created_by         UUID REFERENCES users(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blockers_story ON command_external_blockers(story_id);
CREATE INDEX IF NOT EXISTS idx_blockers_unresolved ON command_external_blockers(story_id) WHERE resolved_at IS NULL;

-- ---- Timeline events (for sparkline markers + release calendar context) ----
CREATE TABLE IF NOT EXISTS command_timeline_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_date    DATE NOT NULL,
    kind          VARCHAR(20) NOT NULL
                  CHECK (kind IN ('release', 'incident', 'hire', 'launch', 'milestone')),
    label         VARCHAR(255) NOT NULL,
    affected_kpis TEXT[] DEFAULT '{}',      -- which KPIs the event should mark on
    region_id     UUID REFERENCES regions(id) ON DELETE SET NULL,
    description   TEXT,
    created_by    UUID REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_date ON command_timeline_events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_region ON command_timeline_events(region_id);
