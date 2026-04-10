DROP POLICY IF EXISTS tasks_full_access ON tasks;
DROP POLICY IF EXISTS tasks_member_access ON tasks;
DROP POLICY IF EXISTS tasks_trainee_read ON tasks;
DROP POLICY IF EXISTS subtasks_full_access ON subtasks;
DROP POLICY IF EXISTS subtasks_member_access ON subtasks;
DROP POLICY IF EXISTS subtasks_trainee_read ON subtasks;

ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks DISABLE ROW LEVEL SECURITY;
