-- Teams table
CREATE TABLE teams (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id   VARCHAR(255) UNIQUE,          -- For future People/HR sync
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    office        VARCHAR(100),                  -- Sussex, Kraków, Texas, Dubai
    lead_id       UUID REFERENCES users(id),     -- Team Lead
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teams_lead ON teams(lead_id);
CREATE INDEX idx_teams_office ON teams(office);

-- Add team_id to users
ALTER TABLE users ADD COLUMN team_id UUID REFERENCES teams(id);
CREATE INDEX idx_users_team ON users(team_id);

-- Add team_id to tasks (which team owns this task)
ALTER TABLE tasks ADD COLUMN team_id UUID REFERENCES teams(id);
CREATE INDEX idx_tasks_team ON tasks(team_id);

-- Add team_id to stories
ALTER TABLE stories ADD COLUMN team_id UUID REFERENCES teams(id);
CREATE INDEX idx_stories_team ON stories(team_id);
