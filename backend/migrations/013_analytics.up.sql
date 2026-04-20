-- Analytics: daily snapshots. Computed by a nightly job (and at server start).
-- region_id = NULL means "all regions" (global rollup).

CREATE TABLE IF NOT EXISTS command_daily_snapshots (
    snapshot_date    DATE NOT NULL,
    region_id        UUID REFERENCES regions(id) ON DELETE CASCADE,
    total_tasks      INT NOT NULL DEFAULT 0,
    done_tasks       INT NOT NULL DEFAULT 0,
    overdue_tasks    INT NOT NULL DEFAULT 0,
    in_progress_tasks INT NOT NULL DEFAULT 0,
    in_review_tasks  INT NOT NULL DEFAULT 0,
    backlog_tasks    INT NOT NULL DEFAULT 0,
    to_do_tasks      INT NOT NULL DEFAULT 0,
    done_in_day      INT NOT NULL DEFAULT 0,
    cycle_time_avg_days NUMERIC(6,2),
    active_users     INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Can't use (snapshot_date, region_id) as PK because NULL region_id breaks it.
-- Two unique indexes instead: one covers real regions, one covers NULL (global).
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_snapshots_region
    ON command_daily_snapshots (snapshot_date, region_id) WHERE region_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_snapshots_global
    ON command_daily_snapshots (snapshot_date) WHERE region_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_daily_snapshots_region ON command_daily_snapshots(region_id);
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_date ON command_daily_snapshots(snapshot_date DESC);
