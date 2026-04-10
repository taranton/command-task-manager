-- Row-Level Security for task visibility based on user role
-- RLS is enforced when app sets session variables via SET LOCAL

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;

-- C-Level and Team Leads see everything
CREATE POLICY tasks_full_access ON tasks
    FOR ALL
    USING (
        current_setting('app.user_role', true) IN ('clevel', 'team_lead')
    );

-- Members see tasks they created or are assigned to
CREATE POLICY tasks_member_access ON tasks
    FOR ALL
    USING (
        current_setting('app.user_role', true) = 'member'
        AND (
            assignee_id = current_setting('app.user_id', true)::uuid
            OR created_by = current_setting('app.user_id', true)::uuid
        )
    );

-- Trainees can only view tasks assigned to them
CREATE POLICY tasks_trainee_read ON tasks
    FOR SELECT
    USING (
        current_setting('app.user_role', true) = 'trainee'
        AND assignee_id = current_setting('app.user_id', true)::uuid
    );

-- Subtask policies follow parent task visibility
CREATE POLICY subtasks_full_access ON subtasks
    FOR ALL
    USING (
        current_setting('app.user_role', true) IN ('clevel', 'team_lead')
    );

CREATE POLICY subtasks_member_access ON subtasks
    FOR ALL
    USING (
        current_setting('app.user_role', true) = 'member'
        AND (
            assignee_id = current_setting('app.user_id', true)::uuid
            OR created_by = current_setting('app.user_id', true)::uuid
            OR task_id IN (
                SELECT id FROM tasks
                WHERE assignee_id = current_setting('app.user_id', true)::uuid
                   OR created_by = current_setting('app.user_id', true)::uuid
            )
        )
    );

CREATE POLICY subtasks_trainee_read ON subtasks
    FOR SELECT
    USING (
        current_setting('app.user_role', true) = 'trainee'
        AND assignee_id = current_setting('app.user_id', true)::uuid
    );
