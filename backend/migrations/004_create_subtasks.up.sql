CREATE TABLE subtasks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title         VARCHAR(500) NOT NULL,
    description   TEXT,
    status        VARCHAR(50) NOT NULL DEFAULT 'backlog'
                  CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'closed')),
    progress      SMALLINT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    assignee_id   UUID REFERENCES users(id),
    start_date    DATE,
    deadline      DATE,
    position      VARCHAR(255) NOT NULL,
    created_by    UUID REFERENCES users(id),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subtasks_task ON subtasks(task_id);
CREATE INDEX idx_subtasks_assignee ON subtasks(assignee_id);
CREATE INDEX idx_subtasks_status ON subtasks(status);
