-- Board Members: many-to-many relationship between users and teams (boards)
-- A user can belong to multiple boards now

CREATE TABLE IF NOT EXISTS board_members (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id  UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role      VARCHAR(50) NOT NULL DEFAULT 'member'
              CHECK (role IN ('team_lead', 'member', 'trainee')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(board_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_board_members_board ON board_members(board_id);
CREATE INDEX IF NOT EXISTS idx_board_members_user ON board_members(user_id);

-- Migrate existing users.team_id → board_members
INSERT INTO board_members (board_id, user_id, role)
SELECT team_id, id, role
FROM users
WHERE team_id IS NOT NULL AND role IN ('team_lead', 'member', 'trainee')
ON CONFLICT (board_id, user_id) DO NOTHING;
