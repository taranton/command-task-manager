UPDATE tasks SET team_id = NULL;
UPDATE stories SET team_id = NULL;
UPDATE users SET team_id = NULL;
DELETE FROM teams;
