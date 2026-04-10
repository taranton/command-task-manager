-- Seed teams
INSERT INTO teams (id, name, description, office, lead_id) VALUES
    ('e0000000-0000-0000-0000-000000000001', 'EU Development', 'European development team', 'Sussex', 'a0000000-0000-0000-0000-000000000002'),
    ('e0000000-0000-0000-0000-000000000002', 'US Operations', 'US operations team', 'Texas', NULL),
    ('e0000000-0000-0000-0000-000000000003', 'Design', 'Design and UX team', 'Kraków', NULL);

-- Assign users to teams
UPDATE users SET team_id = 'e0000000-0000-0000-0000-000000000001' WHERE id = 'a0000000-0000-0000-0000-000000000002'; -- Alex TeamLead
UPDATE users SET team_id = 'e0000000-0000-0000-0000-000000000001' WHERE id = 'a0000000-0000-0000-0000-000000000003'; -- Maria Member
UPDATE users SET team_id = 'e0000000-0000-0000-0000-000000000001' WHERE id = 'a0000000-0000-0000-0000-000000000004'; -- Ivan Trainee
-- admin (C-Level) has no team — sees everything

-- Assign existing tasks/stories to team
UPDATE stories SET team_id = 'e0000000-0000-0000-0000-000000000001';
UPDATE tasks SET team_id = 'e0000000-0000-0000-0000-000000000001';
