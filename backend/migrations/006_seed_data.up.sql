-- Seed users (password for all: "password123")
-- bcrypt hash of "password123"
INSERT INTO users (id, email, full_name, password_hash, role) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'admin@qrt.com', 'Valeri Admin', '$2a$10$eWmiqzHN.S4WdQrnmzhIau0T5fuBjAX6eVmmj4gUNFvzdLZcqhPOS', 'clevel'),
    ('a0000000-0000-0000-0000-000000000002', 'lead@qrt.com', 'Alex TeamLead', '$2a$10$eWmiqzHN.S4WdQrnmzhIau0T5fuBjAX6eVmmj4gUNFvzdLZcqhPOS', 'team_lead'),
    ('a0000000-0000-0000-0000-000000000003', 'member@qrt.com', 'Maria Member', '$2a$10$eWmiqzHN.S4WdQrnmzhIau0T5fuBjAX6eVmmj4gUNFvzdLZcqhPOS', 'member'),
    ('a0000000-0000-0000-0000-000000000004', 'trainee@qrt.com', 'Ivan Trainee', '$2a$10$eWmiqzHN.S4WdQrnmzhIau0T5fuBjAX6eVmmj4gUNFvzdLZcqhPOS', 'trainee');

-- Seed stories
INSERT INTO stories (id, title, description, status, priority, created_by) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'QRT Portal Authentication', 'Implement SSO and MFA for the QRT platform', 'in_progress', 'high', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000002', 'Command Module MVP', 'Build the task management module Phase 1', 'todo', 'critical', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000003', 'Mobile App Optimization', 'Improve performance on mobile devices', 'backlog', 'medium', 'a0000000-0000-0000-0000-000000000002');

-- Seed tasks
INSERT INTO tasks (id, story_id, title, description, status, priority, assignee_id, position, deadline, created_by) VALUES
    ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Set up OAuth2 provider', 'Configure OAuth2 with Azure AD', 'done', 'high', 'a0000000-0000-0000-0000-000000000003', 'U', '2026-04-15', 'a0000000-0000-0000-0000-000000000002'),
    ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Implement login flow', 'Frontend login with token management', 'in_progress', 'high', 'a0000000-0000-0000-0000-000000000003', 'a', '2026-04-18', 'a0000000-0000-0000-0000-000000000002'),
    ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Add MFA support', 'TOTP-based multi-factor authentication', 'todo', 'medium', 'a0000000-0000-0000-0000-000000000004', 'n', '2026-04-25', 'a0000000-0000-0000-0000-000000000002'),
    ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'Design database schema', 'PostgreSQL schema for task tracker', 'in_review', 'critical', 'a0000000-0000-0000-0000-000000000002', 'U', '2026-04-12', 'a0000000-0000-0000-0000-000000000001'),
    ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'Build REST API', 'CRUD endpoints for stories, tasks, subtasks', 'in_progress', 'critical', 'a0000000-0000-0000-0000-000000000002', 'a', '2026-04-20', 'a0000000-0000-0000-0000-000000000001'),
    ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002', 'Create Kanban board UI', 'React Kanban with drag-and-drop', 'todo', 'high', 'a0000000-0000-0000-0000-000000000003', 'n', '2026-04-22', 'a0000000-0000-0000-0000-000000000001'),
    ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000003', 'Audit bundle size', 'Analyze and reduce JS bundle', 'backlog', 'medium', 'a0000000-0000-0000-0000-000000000003', 'U', '2026-05-01', 'a0000000-0000-0000-0000-000000000002'),
    ('c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000003', 'Optimize images', 'Implement lazy loading and WebP', 'backlog', 'low', 'a0000000-0000-0000-0000-000000000004', 'a', '2026-05-05', 'a0000000-0000-0000-0000-000000000002');

-- Seed subtasks
INSERT INTO subtasks (id, task_id, title, status, assignee_id, position, created_by) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Create login form component', 'done', 'a0000000-0000-0000-0000-000000000003', 'U', 'a0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'Implement token refresh logic', 'in_progress', 'a0000000-0000-0000-0000-000000000003', 'a', 'a0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'Add error handling', 'todo', 'a0000000-0000-0000-0000-000000000003', 'n', 'a0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', 'Define entity relationships', 'done', 'a0000000-0000-0000-0000-000000000002', 'U', 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000004', 'Write migration files', 'done', 'a0000000-0000-0000-0000-000000000002', 'a', 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000004', 'Add RLS policies', 'in_progress', 'a0000000-0000-0000-0000-000000000002', 'n', 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000005', 'Story endpoints', 'done', 'a0000000-0000-0000-0000-000000000002', 'U', 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000005', 'Task endpoints', 'in_progress', 'a0000000-0000-0000-0000-000000000002', 'a', 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000005', 'Subtask endpoints', 'todo', 'a0000000-0000-0000-0000-000000000002', 'n', 'a0000000-0000-0000-0000-000000000001');
