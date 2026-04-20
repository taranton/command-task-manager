-- =============================================================================
-- Demo seed — rich local data to exercise C-Level widgets
-- =============================================================================
-- Run: PGPASSWORD=command psql -h localhost -U command -d command -f backend/scripts/demo-seed.sql
--
-- Idempotent: can be re-run. Uses fixed UUIDs (d*) for all demo rows so reruns
-- update rather than duplicate. Existing seed data (a/b/c/e/f prefixes) is left
-- alone.
--
-- Creates: 4 regions (updated with offices), 10 boards across 10 offices,
-- 15 stories, ~40 tasks, 12 story-deps (mix of story-level + task-linked),
-- 7 blockers (mix external/internal), 6 releases, 5 timeline events.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. REGIONS — ensure all 4 macro-regions exist with offices populated.
-- ---------------------------------------------------------------------------
INSERT INTO regions (id, name, code, description, offices) VALUES
    ('f0000000-0000-0000-0000-000000000001', 'Europe',          'EU',    'European region',                   ARRAY['Sussex','Kraków','Berlin']),
    ('f0000000-0000-0000-0000-000000000002', 'United States',   'US',    'North America',                     ARRAY['Texas','San Francisco','New York']),
    ('f0000000-0000-0000-0000-000000000003', 'Middle East',     'MENA',  'Middle East & North Africa',        ARRAY['Dubai','Tel Aviv']),
    ('f0000000-0000-0000-0000-00000000000a', 'Asia Pacific',    'APAC',  'Asia Pacific (Tokyo, Singapore)',   ARRAY['Tokyo','Singapore'])
ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name, description = EXCLUDED.description, offices = EXCLUDED.offices;

-- ---------------------------------------------------------------------------
-- 2. TEAMS (boards) — 10 boards spread across offices & regions
-- ---------------------------------------------------------------------------
INSERT INTO teams (id, name, description, office, region_id) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'Platform Core',      'Shared services & infra',        'Sussex',        'f0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0000-000000000002', 'Web Experience',     'Customer web portal',             'Kraków',        'f0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0000-000000000003', 'Data & Insights',    'BI and reporting',                'Berlin',        'f0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0000-000000000004', 'Trading Tools',      'Trading desk apps',               'Texas',         'f0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0000-000000000005', 'Security & IAM',     'Auth, RBAC, compliance',          'San Francisco', 'f0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0000-000000000006', 'Analytics Platform', 'Event pipeline',                   'New York',      'f0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0000-000000000007', 'Mobile Operations',  'iOS + Android',                    'Dubai',         'f0000000-0000-0000-0000-000000000003'),
    ('d0000000-0000-0000-0000-000000000008', 'Customer Support',   'Help desk & triage',               'Tel Aviv',      'f0000000-0000-0000-0000-000000000003'),
    ('d0000000-0000-0000-0000-000000000009', 'Integrations',       'Third-party APIs',                 'Singapore',     'f0000000-0000-0000-0000-00000000000a'),
    ('d0000000-0000-0000-0000-00000000000a', 'Enterprise Sales',   'Deal flow ops',                    'Tokyo',         'f0000000-0000-0000-0000-00000000000a')
ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name, description = EXCLUDED.description, office = EXCLUDED.office, region_id = EXCLUDED.region_id;

-- ---------------------------------------------------------------------------
-- 3. BOARD MEMBERS — spread 4 existing users across all boards with roles
-- ---------------------------------------------------------------------------
INSERT INTO board_members (board_id, user_id, role) VALUES
    -- Alex (TeamLead) leads 4 boards
    ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'team_lead'),
    ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'team_lead'),
    ('d0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'team_lead'),
    ('d0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002', 'team_lead'),
    -- Maria (Member) in 5 boards
    ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'team_lead'),
    ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'member'),
    ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', 'member'),
    ('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'member'),
    ('d0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000003', 'member'),
    -- Ivan (Trainee) in 3 boards
    ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'trainee'),
    ('d0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000004', 'team_lead'),
    ('d0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000004', 'trainee'),
    -- Admin (C-Level) visible everywhere — add to 2 boards for variety
    ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'member'),
    ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'team_lead')
ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- ---------------------------------------------------------------------------
-- 4. STORIES — 15 stories across boards, mixed priorities and statuses
-- ---------------------------------------------------------------------------
INSERT INTO stories (id, title, description, status, progress, priority, team_id, start_date, deadline, sort_order, created_by, tags) VALUES
    ('d0000000-0000-0000-0001-000000000001', 'SSO enforcement across sub-domains',   'Unified auth across all QRT properties',  'active',  30, 'critical', 'd0000000-0000-0000-0000-000000000005', CURRENT_DATE - 21, CURRENT_DATE + 7,  1000,  'a0000000-0000-0000-0000-000000000001', ARRAY['security','auth']),
    ('d0000000-0000-0000-0001-000000000002', 'Platform v3 — GA launch',               'Command module general availability',      'active',  72, 'critical', 'd0000000-0000-0000-0000-000000000001', CURRENT_DATE - 45, CURRENT_DATE + 14, 2000,  'a0000000-0000-0000-0000-000000000001', ARRAY['platform','launch']),
    ('d0000000-0000-0000-0001-000000000003', 'Gantt + Roadmap view v2',               'Better timeline rendering, zoom, pan',     'active',  45, 'high',     'd0000000-0000-0000-0000-000000000002', CURRENT_DATE - 14, CURRENT_DATE + 18, 3000,  'a0000000-0000-0000-0000-000000000002', ARRAY['ui','roadmap']),
    ('d0000000-0000-0000-0001-000000000004', 'Materialized KPI views + Redis cache',  'Pre-compute velocity, cycle, etc.',        'active',  82, 'high',     'd0000000-0000-0000-0000-000000000003', CURRENT_DATE - 30, CURRENT_DATE + 3,  4000,  'a0000000-0000-0000-0000-000000000001', ARRAY['data','perf']),
    ('d0000000-0000-0000-0001-000000000005', 'Mobile triage + FAB',                   'Quick-capture on phone',                   'active',  64, 'medium',   'd0000000-0000-0000-0000-000000000007', CURRENT_DATE - 20, CURRENT_DATE + 9,  5000,  'a0000000-0000-0000-0000-000000000002', ARRAY['mobile','ux']),
    ('d0000000-0000-0000-0001-000000000006', 'WhatsApp & Telegram deadline alerts',   'Outbound push to messengers',              'backlog', 0,  'low',      'd0000000-0000-0000-0000-000000000007', NULL,              CURRENT_DATE + 60, 6000,  'a0000000-0000-0000-0000-000000000002', ARRAY['mobile','notifications']),
    ('d0000000-0000-0000-0001-000000000007', 'Morning Inbox Summary automation',      'Daily digest of overnight events',         'active',  58, 'high',     'd0000000-0000-0000-0000-000000000006', CURRENT_DATE - 10, CURRENT_DATE + 12, 7000,  'a0000000-0000-0000-0000-000000000003', ARRAY['notifications']),
    ('d0000000-0000-0000-0001-000000000008', 'RLS audit + field-level permissions',   'Row-level security hardening',             'active',  51, 'high',     'd0000000-0000-0000-0000-000000000005', CURRENT_DATE - 25, CURRENT_DATE + 5,  8000,  'a0000000-0000-0000-0000-000000000002', ARRAY['security']),
    ('d0000000-0000-0000-0001-000000000009', 'Teams call → action items',             'Meeting transcript → tasks',               'backlog', 8,  'medium',   'd0000000-0000-0000-0000-000000000004', NULL,              CURRENT_DATE + 45, 9000,  'a0000000-0000-0000-0000-000000000002', ARRAY['ai','integrations']),
    ('d0000000-0000-0000-0001-00000000000a', 'Velocity / throughput dashboard',       'Aggregated KPIs per region',               'active',  90, 'medium',   'd0000000-0000-0000-0000-000000000003', CURRENT_DATE - 35, CURRENT_DATE - 2,  10000, 'a0000000-0000-0000-0000-000000000003', ARRAY['dashboard']),
    ('d0000000-0000-0000-0001-00000000000b', 'Infra hardening: TLS 1.3 rollout',      'Strict transport + HSTS',                  'active',  62, 'high',     'd0000000-0000-0000-0000-000000000001', CURRENT_DATE - 18, CURRENT_DATE + 6,  11000, 'a0000000-0000-0000-0000-000000000001', ARRAY['infra','security']),
    ('d0000000-0000-0000-0001-00000000000c', 'Onboarding flow redesign',              'New welcome wizard',                       'active',  37, 'medium',   'd0000000-0000-0000-0000-000000000002', CURRENT_DATE - 12, CURRENT_DATE + 22, 12000, 'a0000000-0000-0000-0000-000000000003', ARRAY['ux','onboarding']),
    ('d0000000-0000-0000-0001-00000000000d', 'Customer escalation queue',             'SLA-driven ticket routing',                'active',  22, 'high',     'd0000000-0000-0000-0000-000000000008', CURRENT_DATE - 8,  CURRENT_DATE + 20, 13000, 'a0000000-0000-0000-0000-000000000004', ARRAY['support']),
    ('d0000000-0000-0000-0001-00000000000e', 'Enterprise pricing calculator',         'Sales tool for tiered plans',              'active',  44, 'medium',   'd0000000-0000-0000-0000-00000000000a', CURRENT_DATE - 22, CURRENT_DATE + 16, 14000, 'a0000000-0000-0000-0000-000000000003', ARRAY['sales']),
    ('d0000000-0000-0000-0001-00000000000f', 'Stripe + Paddle billing integration',   'Dual-vendor payments',                     'active',  18, 'critical', 'd0000000-0000-0000-0000-000000000009', CURRENT_DATE - 6,  CURRENT_DATE + 10, 15000, 'a0000000-0000-0000-0000-000000000002', ARRAY['integrations','billing'])
ON CONFLICT (id) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status, progress = EXCLUDED.progress,
        priority = EXCLUDED.priority, team_id = EXCLUDED.team_id, start_date = EXCLUDED.start_date,
        deadline = EXCLUDED.deadline, tags = EXCLUDED.tags, archived_at = NULL, deleted_at = NULL;

-- ---------------------------------------------------------------------------
-- 5. TASKS — ~40 tasks spread across stories, varied statuses/deadlines
-- ---------------------------------------------------------------------------
-- Helper: delete prior demo tasks so counts stay stable across re-runs
DELETE FROM tasks WHERE id::text LIKE 'd0000000-0000-0000-0002-%';

INSERT INTO tasks (id, story_id, title, status, priority, progress, assignee_id, team_id, deadline, sort_order, created_by) VALUES
    -- SSO enforcement (critical, overdue risk)
    ('d0000000-0000-0000-0002-000000000001', 'd0000000-0000-0000-0001-000000000001', 'SAML metadata endpoint',         'done',        'critical', 100, 'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000005', CURRENT_DATE - 3,  1000, 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0002-000000000002', 'd0000000-0000-0000-0001-000000000001', 'MFA enforcement toggle',         'in_progress', 'critical', 40,  'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000005', CURRENT_DATE + 2,  2000, 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0002-000000000003', 'd0000000-0000-0000-0001-000000000001', 'Session refresh policy',         'to_do',       'high',     0,   'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', CURRENT_DATE + 5,  3000, 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0002-000000000004', 'd0000000-0000-0000-0001-000000000001', 'Audit log sink',                 'backlog',     'medium',   0,   NULL,                                     'd0000000-0000-0000-0000-000000000005', CURRENT_DATE + 10, 4000, 'a0000000-0000-0000-0000-000000000001'),
    -- Platform v3
    ('d0000000-0000-0000-0002-000000000005', 'd0000000-0000-0000-0001-000000000002', 'Port export to Command schema',  'done',        'high',     100, 'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', CURRENT_DATE - 8,  1000, 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0002-000000000006', 'd0000000-0000-0000-0001-000000000002', 'Migrate legacy board IDs',       'done',        'high',     100, 'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', CURRENT_DATE - 5,  2000, 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0002-000000000007', 'd0000000-0000-0000-0001-000000000002', 'Dual-write during cutover',      'in_review',   'high',     75,  'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', CURRENT_DATE + 1,  3000, 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0002-000000000008', 'd0000000-0000-0000-0001-000000000002', 'Decommission old webhooks',      'in_progress', 'medium',   50,  'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', CURRENT_DATE + 6,  4000, 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0002-000000000009', 'd0000000-0000-0000-0001-000000000002', 'Stakeholder sign-off: Ops',      'to_do',       'high',     0,   'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', CURRENT_DATE + 12, 5000, 'a0000000-0000-0000-0000-000000000001'),
    -- Gantt v2
    ('d0000000-0000-0000-0002-00000000000a', 'd0000000-0000-0000-0001-000000000003', 'Dependency links model',         'done',        'medium',   100, 'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', CURRENT_DATE - 7,  1000, 'a0000000-0000-0000-0000-000000000003'),
    ('d0000000-0000-0000-0002-00000000000b', 'd0000000-0000-0000-0001-000000000003', 'Zoom + pan SVG engine',          'in_progress', 'high',     60,  'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', CURRENT_DATE + 4,  2000, 'a0000000-0000-0000-0000-000000000003'),
    ('d0000000-0000-0000-0002-00000000000c', 'd0000000-0000-0000-0001-000000000003', 'Swimlane grouping',              'to_do',       'medium',   0,   'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', CURRENT_DATE + 10, 3000, 'a0000000-0000-0000-0000-000000000003'),
    ('d0000000-0000-0000-0002-00000000000d', 'd0000000-0000-0000-0001-000000000003', 'Perf pass: 2k tasks',            'backlog',     'low',      0,   NULL,                                     'd0000000-0000-0000-0000-000000000002', CURRENT_DATE + 20, 4000, 'a0000000-0000-0000-0000-000000000003'),
    -- Materialized KPIs
    ('d0000000-0000-0000-0002-00000000000e', 'd0000000-0000-0000-0001-000000000004', 'Materialized views (velocity)',  'done',        'high',     100, 'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', CURRENT_DATE - 12, 1000, 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0002-00000000000f', 'd0000000-0000-0000-0001-000000000004', 'Redis cache layer',              'done',        'high',     100, 'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', CURRENT_DATE - 6,  2000, 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0002-000000000010', 'd0000000-0000-0000-0001-000000000004', 'Cache invalidation events',      'in_review',   'high',     80,  'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', CURRENT_DATE - 1,  3000, 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0002-000000000011', 'd0000000-0000-0000-0001-000000000004', 'Fallback on cache miss',         'to_do',       'medium',   0,   'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', CURRENT_DATE + 4,  4000, 'a0000000-0000-0000-0000-000000000001'),
    -- Mobile triage
    ('d0000000-0000-0000-0002-000000000012', 'd0000000-0000-0000-0001-000000000005', 'FAB component + shortcut',       'done',        'medium',   100, 'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000007', CURRENT_DATE - 9,  1000, 'a0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0002-000000000013', 'd0000000-0000-0000-0001-000000000005', 'Swipe-right → In Review',        'in_progress', 'medium',   70,  'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000007', CURRENT_DATE + 3,  2000, 'a0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0002-000000000014', 'd0000000-0000-0000-0001-000000000005', 'Offline queue + retry',          'in_progress', 'high',     45,  'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000007', CURRENT_DATE + 7,  3000, 'a0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0002-000000000015', 'd0000000-0000-0000-0001-000000000005', 'Haptics polish',                 'backlog',     'low',      0,   NULL,                                     'd0000000-0000-0000-0000-000000000007', CURRENT_DATE + 14, 4000, 'a0000000-0000-0000-0000-000000000002'),
    -- RLS audit
    ('d0000000-0000-0000-0002-000000000016', 'd0000000-0000-0000-0001-000000000008', 'Inventory sensitive fields',     'done',        'high',     100, 'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000005', CURRENT_DATE - 10, 1000, 'a0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0002-000000000017', 'd0000000-0000-0000-0001-000000000008', 'Row-level policies v2',          'in_progress', 'high',     60,  'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000005', CURRENT_DATE + 2,  2000, 'a0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0002-000000000018', 'd0000000-0000-0000-0001-000000000008', 'Field-level API masking',        'to_do',       'medium',   0,   'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', CURRENT_DATE + 8,  3000, 'a0000000-0000-0000-0000-000000000002'),
    -- Velocity dashboard (nearly done)
    ('d0000000-0000-0000-0002-000000000019', 'd0000000-0000-0000-0001-00000000000a', 'Cycle time rollup',              'done',        'medium',   100, 'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', CURRENT_DATE - 14, 1000, 'a0000000-0000-0000-0000-000000000003'),
    ('d0000000-0000-0000-0002-00000000001a', 'd0000000-0000-0000-0001-00000000000a', 'Throughput chart',               'done',        'medium',   100, 'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', CURRENT_DATE - 8,  2000, 'a0000000-0000-0000-0000-000000000003'),
    ('d0000000-0000-0000-0002-00000000001b', 'd0000000-0000-0000-0001-00000000000a', 'Export to PDF',                  'in_review',   'low',      90,  'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', CURRENT_DATE,      3000, 'a0000000-0000-0000-0000-000000000003'),
    -- Infra TLS
    ('d0000000-0000-0000-0002-00000000001c', 'd0000000-0000-0000-0001-00000000000b', 'Cert rotation automation',       'done',        'high',     100, 'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', CURRENT_DATE - 11, 1000, 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0002-00000000001d', 'd0000000-0000-0000-0001-00000000000b', 'Nginx → TLS 1.3 only',           'in_progress', 'high',     55,  'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', CURRENT_DATE + 3,  2000, 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0002-00000000001e', 'd0000000-0000-0000-0001-00000000000b', 'Canary rollout',                 'to_do',       'medium',   0,   'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', CURRENT_DATE + 6,  3000, 'a0000000-0000-0000-0000-000000000001'),
    -- Morning Inbox
    ('d0000000-0000-0000-0002-00000000001f', 'd0000000-0000-0000-0001-000000000007', 'Draft digest template',          'done',        'medium',   100, 'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000006', CURRENT_DATE - 5,  1000, 'a0000000-0000-0000-0000-000000000003'),
    ('d0000000-0000-0000-0002-000000000020', 'd0000000-0000-0000-0001-000000000007', 'Wire up overnight cron',         'in_progress', 'medium',   60,  'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000006', CURRENT_DATE + 5,  2000, 'a0000000-0000-0000-0000-000000000003'),
    ('d0000000-0000-0000-0002-000000000021', 'd0000000-0000-0000-0001-000000000007', 'Push via Teams channel',         'to_do',       'low',      0,   'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000006', CURRENT_DATE + 11, 3000, 'a0000000-0000-0000-0000-000000000003'),
    -- Customer escalation queue
    ('d0000000-0000-0000-0002-000000000022', 'd0000000-0000-0000-0001-00000000000d', 'SLA timer + reminders',          'in_progress', 'high',     40,  'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000008', CURRENT_DATE + 7,  1000, 'a0000000-0000-0000-0000-000000000004'),
    ('d0000000-0000-0000-0002-000000000023', 'd0000000-0000-0000-0001-00000000000d', 'Priority-based routing rules',   'to_do',       'high',     0,   'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000008', CURRENT_DATE + 12, 2000, 'a0000000-0000-0000-0000-000000000004'),
    -- Enterprise pricing
    ('d0000000-0000-0000-0002-000000000024', 'd0000000-0000-0000-0001-00000000000e', 'Tier catalog model',             'done',        'medium',   100, 'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-00000000000a', CURRENT_DATE - 4,  1000, 'a0000000-0000-0000-0000-000000000003'),
    ('d0000000-0000-0000-0002-000000000025', 'd0000000-0000-0000-0001-00000000000e', 'Discount engine',                'in_progress', 'medium',   45,  'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-00000000000a', CURRENT_DATE + 5,  2000, 'a0000000-0000-0000-0000-000000000003'),
    ('d0000000-0000-0000-0002-000000000026', 'd0000000-0000-0000-0001-00000000000e', 'Preview export to PDF',          'backlog',     'low',      0,   NULL,                                     'd0000000-0000-0000-0000-00000000000a', CURRENT_DATE + 13, 3000, 'a0000000-0000-0000-0000-000000000003'),
    -- Stripe + Paddle billing
    ('d0000000-0000-0000-0002-000000000027', 'd0000000-0000-0000-0001-00000000000f', 'Webhook handler (both vendors)', 'in_progress', 'critical', 30,  'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000009', CURRENT_DATE + 2,  1000, 'a0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0002-000000000028', 'd0000000-0000-0000-0001-00000000000f', 'Invoice reconciliation',         'to_do',       'high',     0,   'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', CURRENT_DATE + 6,  2000, 'a0000000-0000-0000-0000-000000000002'),
    -- Onboarding
    ('d0000000-0000-0000-0002-000000000029', 'd0000000-0000-0000-0001-00000000000c', 'New welcome flow screens',       'in_progress', 'medium',   50,  'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', CURRENT_DATE + 8,  1000, 'a0000000-0000-0000-0000-000000000003'),
    ('d0000000-0000-0000-0002-00000000002a', 'd0000000-0000-0000-0001-00000000000c', 'Sample data seeding',            'to_do',       'medium',   0,   'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', CURRENT_DATE + 15, 2000, 'a0000000-0000-0000-0000-000000000003');

-- ---------------------------------------------------------------------------
-- 6. STORY DEPENDENCIES — mix of story→story and task-linked
-- ---------------------------------------------------------------------------
DELETE FROM command_story_deps WHERE from_story::text LIKE 'd0000000-0000-0000-0001-%' OR to_story::text LIKE 'd0000000-0000-0000-0001-%';

INSERT INTO command_story_deps (from_story, to_story, to_task, reason, created_by) VALUES
    -- Platform v3 depends on SSO rollout (cross-region: EU Sussex → US SF)
    ('d0000000-0000-0000-0001-000000000002', 'd0000000-0000-0000-0001-000000000001', 'd0000000-0000-0000-0002-000000000002', 'Platform v3 needs MFA toggle shipped',                'a0000000-0000-0000-0000-000000000001'),
    -- Gantt v2 depends on materialized KPI views (task-linked)
    ('d0000000-0000-0000-0001-000000000003', 'd0000000-0000-0000-0001-000000000004', 'd0000000-0000-0000-0002-00000000000e', 'Gantt reads from velocity view',                      'a0000000-0000-0000-0000-000000000003'),
    -- Velocity dashboard depends on materialized KPI
    ('d0000000-0000-0000-0001-00000000000a', 'd0000000-0000-0000-0001-000000000004', NULL,                                     'Whole KPI pipeline must be done',                    'a0000000-0000-0000-0000-000000000003'),
    -- Mobile triage depends on Platform v3 (cross region)
    ('d0000000-0000-0000-0001-000000000005', 'd0000000-0000-0000-0001-000000000002', NULL,                                     'Mobile uses Command API contract',                    'a0000000-0000-0000-0000-000000000002'),
    -- WhatsApp alerts depends on Mobile triage
    ('d0000000-0000-0000-0001-000000000006', 'd0000000-0000-0000-0001-000000000005', NULL,                                     'Needs triage infra before push channel',              'a0000000-0000-0000-0000-000000000002'),
    -- Morning Inbox depends on Velocity dashboard
    ('d0000000-0000-0000-0001-000000000007', 'd0000000-0000-0000-0001-00000000000a', 'd0000000-0000-0000-0002-00000000001a', 'Digest embeds throughput chart',                       'a0000000-0000-0000-0000-000000000003'),
    -- RLS depends on SSO (task-linked to MFA)
    ('d0000000-0000-0000-0001-000000000008', 'd0000000-0000-0000-0001-000000000001', 'd0000000-0000-0000-0002-000000000002', 'Field masking uses SSO groups',                       'a0000000-0000-0000-0000-000000000002'),
    -- Infra TLS depends on SSO
    ('d0000000-0000-0000-0001-00000000000b', 'd0000000-0000-0000-0001-000000000001', NULL,                                     'TLS rollout paired with SSO cutover',                 'a0000000-0000-0000-0000-000000000001'),
    -- Onboarding depends on Platform v3
    ('d0000000-0000-0000-0001-00000000000c', 'd0000000-0000-0000-0001-000000000002', NULL,                                     'Highlights new Command flow in welcome',              'a0000000-0000-0000-0000-000000000003'),
    -- Customer escalation depends on Platform v3 (cross-region MENA → EU)
    ('d0000000-0000-0000-0001-00000000000d', 'd0000000-0000-0000-0001-000000000002', NULL,                                     'Queue uses v3 task API',                              'a0000000-0000-0000-0000-000000000004'),
    -- Stripe billing depends on Enterprise pricing (APAC ↔ APAC, task-linked)
    ('d0000000-0000-0000-0001-00000000000f', 'd0000000-0000-0000-0001-00000000000e', 'd0000000-0000-0000-0002-000000000025', 'Billing consumes discount engine output',             'a0000000-0000-0000-0000-000000000002'),
    -- Teams call action items depends on Morning Inbox
    ('d0000000-0000-0000-0001-000000000009', 'd0000000-0000-0000-0001-000000000007', NULL,                                     'Reuses digest scheduling infra',                      'a0000000-0000-0000-0000-000000000002');

-- ---------------------------------------------------------------------------
-- 7. BLOCKERS — mix of external (text) and internal (task-linked)
-- ---------------------------------------------------------------------------
DELETE FROM command_external_blockers WHERE story_id::text LIKE 'd0000000-0000-0000-0001-%';

INSERT INTO command_external_blockers (story_id, blocking_task_id, blocker_description, severity, since_date, created_by) VALUES
    -- External, critical: SSO story blocked by legal
    ('d0000000-0000-0000-0001-000000000001', NULL,                                     'Legal compliance review on session storage',      'critical', CURRENT_DATE - 6,  'a0000000-0000-0000-0000-000000000001'),
    -- External, high: Teams call story — API access
    ('d0000000-0000-0000-0001-000000000009', NULL,                                     'Waiting on Microsoft Teams API v2 access',         'high',     CURRENT_DATE - 11, 'a0000000-0000-0000-0000-000000000002'),
    -- External, medium: WhatsApp verification
    ('d0000000-0000-0000-0001-000000000006', NULL,                                     'WhatsApp Business provider verification',          'medium',   CURRENT_DATE - 4,  'a0000000-0000-0000-0000-000000000002'),
    -- Internal: Billing blocked by Discount engine task (already in-progress → auto-resolves when done)
    ('d0000000-0000-0000-0001-00000000000f', 'd0000000-0000-0000-0002-000000000025', 'Cannot compute final price without discount engine','high',     CURRENT_DATE - 3,  'a0000000-0000-0000-0000-000000000002'),
    -- Internal: Gantt blocked by Zoom/pan task
    ('d0000000-0000-0000-0001-000000000003', 'd0000000-0000-0000-0002-00000000000b', 'Other gantt features wait on zoom/pan engine',     'medium',   CURRENT_DATE - 2,  'a0000000-0000-0000-0000-000000000003'),
    -- External, high: Customer escalation — legal SLA review
    ('d0000000-0000-0000-0001-00000000000d', NULL,                                     'Legal reviewing SLA penalty clauses',              'high',     CURRENT_DATE - 5,  'a0000000-0000-0000-0000-000000000004'),
    -- Already resolved one (historical record shows up in "all blockers" list)
    ('d0000000-0000-0000-0001-00000000000b', NULL,                                     'Vendor cert delivery delay',                       'low',      CURRENT_DATE - 14, 'a0000000-0000-0000-0000-000000000001');
-- Mark the last one as resolved
UPDATE command_external_blockers
    SET resolved_at = NOW() - INTERVAL '3 days'
WHERE story_id = 'd0000000-0000-0000-0001-00000000000b'
  AND blocker_description = 'Vendor cert delivery delay';

-- ---------------------------------------------------------------------------
-- 8. RELEASES — 6 planned across 10 weeks
-- ---------------------------------------------------------------------------
INSERT INTO command_releases (id, release_date, label, release_type, region_id, office, description, created_by) VALUES
    ('d0000000-0000-0000-0003-000000000001', CURRENT_DATE + 4,  'v2.16',             'minor', 'f0000000-0000-0000-0000-000000000001', 'Sussex',        'Bugfix + perf',                 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0003-000000000002', CURRENT_DATE + 11, 'SSO GA',            'major', 'f0000000-0000-0000-0000-000000000002', 'San Francisco', 'SSO enforcement everywhere',    'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0003-000000000003', CURRENT_DATE + 18, 'v2.17',             'minor', 'f0000000-0000-0000-0000-000000000001', 'Sussex',        'Platform v3 preview',           'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0003-000000000004', CURRENT_DATE + 22, 'Mobile Beta',       'major', 'f0000000-0000-0000-0000-000000000003', 'Dubai',         'Mobile triage rollout',         'a0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0003-000000000005', CURRENT_DATE + 39, 'Gantt GA',          'major', 'f0000000-0000-0000-0000-000000000001', 'Kraków',        'Gantt v2 general availability', 'a0000000-0000-0000-0000-000000000003'),
    ('d0000000-0000-0000-0003-000000000006', CURRENT_DATE + 60, 'v3.0 — Platform',   'major', 'f0000000-0000-0000-0000-000000000001', 'Sussex',        'Command module GA',             'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE SET release_date = EXCLUDED.release_date, label = EXCLUDED.label, release_type = EXCLUDED.release_type,
    region_id = EXCLUDED.region_id, office = EXCLUDED.office, description = EXCLUDED.description;

-- Link a few stories to releases
DELETE FROM command_release_stories WHERE release_id::text LIKE 'd0000000-0000-0000-0003-%';
INSERT INTO command_release_stories (release_id, story_id) VALUES
    ('d0000000-0000-0000-0003-000000000002', 'd0000000-0000-0000-0001-000000000001'),   -- SSO GA → SSO story
    ('d0000000-0000-0000-0003-000000000002', 'd0000000-0000-0000-0001-000000000008'),   -- SSO GA → RLS audit
    ('d0000000-0000-0000-0003-000000000004', 'd0000000-0000-0000-0001-000000000005'),   -- Mobile Beta → Mobile triage
    ('d0000000-0000-0000-0003-000000000005', 'd0000000-0000-0000-0001-000000000003'),   -- Gantt GA → Gantt v2
    ('d0000000-0000-0000-0003-000000000006', 'd0000000-0000-0000-0001-000000000002'),   -- v3.0 → Platform v3
    ('d0000000-0000-0000-0003-000000000006', 'd0000000-0000-0000-0001-000000000004'),   -- v3.0 → Materialized KPIs
    ('d0000000-0000-0000-0003-000000000006', 'd0000000-0000-0000-0001-00000000000b')    -- v3.0 → TLS rollout
ON CONFLICT (release_id, story_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9. TIMELINE EVENTS — past events mark the KPI sparklines
-- ---------------------------------------------------------------------------
DELETE FROM command_timeline_events WHERE id::text LIKE 'd0000000-0000-0000-0004-%';

INSERT INTO command_timeline_events (id, event_date, kind, label, affected_kpis, region_id, description, created_by) VALUES
    ('d0000000-0000-0000-0004-000000000001', CURRENT_DATE - 12, 'release',  'v2.14 ship',            ARRAY['velocity','completion'],                NULL,                                     'Stable release',                  'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0004-000000000002', CURRENT_DATE - 9,  'incident', 'API outage 47m',        ARRAY['cycle','utilization'],                  NULL,                                     'Upstream provider downtime',      'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0004-000000000003', CURRENT_DATE - 6,  'hire',     'Kraków +2 engineers',   ARRAY['utilization','velocity'],               'f0000000-0000-0000-0000-000000000001', 'Two new hires onboarded',         'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0004-000000000004', CURRENT_DATE - 3,  'release',  'v2.15 ship',            ARRAY['velocity','completion'],                NULL,                                     'Bugfix release',                  'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0004-000000000005', CURRENT_DATE - 1,  'incident', 'SSO regression',        ARRAY['overdue'],                              'f0000000-0000-0000-0000-000000000002', 'Rolled back MFA toggle',          'a0000000-0000-0000-0000-000000000001');

-- =============================================================================
-- Done. Summary:
-- 4 regions · 10 boards across 10 offices · 15 active/backlog stories ·
-- ~40 tasks · 12 dependencies (6 task-linked) · 7 blockers (2 internal, 1 resolved) ·
-- 6 upcoming releases · 5 timeline events.
-- =============================================================================
