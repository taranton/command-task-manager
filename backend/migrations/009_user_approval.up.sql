-- Add approval status to users
ALTER TABLE users ADD COLUMN approved BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN approved_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN approved_at TIMESTAMPTZ;

-- Mark existing seed users as approved
UPDATE users SET approved = true;

-- Allow non-approved users to exist but not login (handled in auth service)
