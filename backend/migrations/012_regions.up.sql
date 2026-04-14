-- Regions: isolate data by geographic region
-- Each user belongs to one region
-- Boards, stories, tasks are scoped to their region via the board's region

CREATE TABLE IF NOT EXISTS regions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    code        VARCHAR(20) UNIQUE NOT NULL,    -- e.g. 'EU', 'US', 'MENA'
    description TEXT,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regions_code ON regions(code);

-- Add region_id to users and teams (boards)
ALTER TABLE users ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);

CREATE INDEX IF NOT EXISTS idx_users_region ON users(region_id);
CREATE INDEX IF NOT EXISTS idx_teams_region ON teams(region_id);

-- Seed default region
INSERT INTO regions (id, name, code, description) VALUES
    ('f0000000-0000-0000-0000-000000000001', 'Europe', 'EU', 'European region (Sussex, Kraków)'),
    ('f0000000-0000-0000-0000-000000000002', 'North America', 'US', 'US region (Texas)'),
    ('f0000000-0000-0000-0000-000000000003', 'Middle East', 'MENA', 'Middle East & North Africa (Dubai)')
ON CONFLICT DO NOTHING;

-- Assign existing users and boards to EU region by default
UPDATE users SET region_id = 'f0000000-0000-0000-0000-000000000001' WHERE region_id IS NULL;
UPDATE teams SET region_id = 'f0000000-0000-0000-0000-000000000001' WHERE region_id IS NULL;
