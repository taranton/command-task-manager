package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/qrt/command/internal/model"
)

type TaskRepository struct {
	db *pgxpool.Pool
}

func NewTaskRepository(db *pgxpool.Pool) *TaskRepository {
	return &TaskRepository{db: db}
}

func (r *TaskRepository) Create(ctx context.Context, t *model.Task) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO tasks (story_id, title, description, status, priority, assignee_id, start_date, deadline, position, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at, updated_at
	`, t.StoryID, t.Title, t.Description, t.Status, t.Priority, t.AssigneeID,
		t.StartDate, t.Deadline, t.Position, t.CreatedBy,
	).Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt)
}

func (r *TaskRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Task, error) {
	var t model.Task
	var assigneeName, assigneeAvatar *string

	err := r.db.QueryRow(ctx, `
		SELECT t.id, t.story_id, t.title, t.description, t.status, t.progress, t.priority,
		       t.assignee_id, t.start_date, t.deadline, t.position, t.created_by, t.created_at, t.updated_at,
		       u.full_name, u.avatar_url,
		       COALESCE((SELECT COUNT(*) FROM subtasks WHERE task_id = t.id), 0) as subtask_count,
		       COALESCE((SELECT COUNT(*) FROM subtasks WHERE task_id = t.id AND status = 'done'), 0) as subtask_done,
		       s.title as story_title
		FROM tasks t
		LEFT JOIN users u ON t.assignee_id = u.id
		LEFT JOIN stories s ON t.story_id = s.id
		WHERE t.id = $1
	`, id).Scan(
		&t.ID, &t.StoryID, &t.Title, &t.Description, &t.Status, &t.Progress, &t.Priority,
		&t.AssigneeID, &t.StartDate, &t.Deadline, &t.Position, &t.CreatedBy, &t.CreatedAt, &t.UpdatedAt,
		&assigneeName, &assigneeAvatar,
		&t.SubtaskCount, &t.SubtaskDone, &t.StoryTitle,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if t.AssigneeID != nil && assigneeName != nil {
		t.Assignee = &model.User{
			ID:        *t.AssigneeID,
			FullName:  *assigneeName,
			AvatarURL: assigneeAvatar,
		}
	}

	return &t, nil
}

func (r *TaskRepository) ListByStory(ctx context.Context, storyID uuid.UUID) ([]model.Task, error) {
	return r.list(ctx, &model.TaskFilter{StoryID: &storyID, Limit: 200})
}

func (r *TaskRepository) ListByAssignee(ctx context.Context, assigneeID uuid.UUID) ([]model.Task, error) {
	return r.list(ctx, &model.TaskFilter{AssigneeID: &assigneeID, Limit: 200})
}

func (r *TaskRepository) ListForBoard(ctx context.Context, filter model.TaskFilter) ([]model.Task, error) {
	return r.list(ctx, &filter)
}

func (r *TaskRepository) list(ctx context.Context, filter *model.TaskFilter) ([]model.Task, error) {
	var conditions []string
	var args []interface{}
	argIdx := 1

	if filter.StoryID != nil {
		conditions = append(conditions, fmt.Sprintf("t.story_id = $%d", argIdx))
		args = append(args, *filter.StoryID)
		argIdx++
	}
	if filter.AssigneeID != nil {
		conditions = append(conditions, fmt.Sprintf("t.assignee_id = $%d", argIdx))
		args = append(args, *filter.AssigneeID)
		argIdx++
	}
	if filter.Status != nil {
		conditions = append(conditions, fmt.Sprintf("t.status = $%d", argIdx))
		args = append(args, *filter.Status)
		argIdx++
	}
	if filter.Priority != nil {
		conditions = append(conditions, fmt.Sprintf("t.priority = $%d", argIdx))
		args = append(args, *filter.Priority)
		argIdx++
	}
	if filter.TeamID != nil {
		conditions = append(conditions, fmt.Sprintf("t.team_id = $%d", argIdx))
		args = append(args, *filter.TeamID)
		argIdx++
	}

	// Exclude closed from board by default
	conditions = append(conditions, "t.status != 'closed'")

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	if filter.Limit == 0 {
		filter.Limit = 100
	}

	query := fmt.Sprintf(`
		SELECT t.id, t.story_id, t.title, t.description, t.status, t.progress, t.priority,
		       t.assignee_id, t.start_date, t.deadline, t.position, t.created_by, t.created_at, t.updated_at,
		       u.full_name, u.avatar_url,
		       COALESCE((SELECT COUNT(*) FROM subtasks WHERE task_id = t.id), 0) as subtask_count,
		       COALESCE((SELECT COUNT(*) FROM subtasks WHERE task_id = t.id AND status = 'done'), 0) as subtask_done,
		       s.title as story_title
		FROM tasks t
		LEFT JOIN users u ON t.assignee_id = u.id
		LEFT JOIN stories s ON t.story_id = s.id
		%s
		ORDER BY t.position ASC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, filter.Limit, filter.Offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []model.Task
	for rows.Next() {
		var t model.Task
		var assigneeName, assigneeAvatar *string

		if err := rows.Scan(
			&t.ID, &t.StoryID, &t.Title, &t.Description, &t.Status, &t.Progress, &t.Priority,
			&t.AssigneeID, &t.StartDate, &t.Deadline, &t.Position, &t.CreatedBy, &t.CreatedAt, &t.UpdatedAt,
			&assigneeName, &assigneeAvatar,
			&t.SubtaskCount, &t.SubtaskDone, &t.StoryTitle,
		); err != nil {
			return nil, err
		}

		if t.AssigneeID != nil && assigneeName != nil {
			t.Assignee = &model.User{
				ID:        *t.AssigneeID,
				FullName:  *assigneeName,
				AvatarURL: assigneeAvatar,
			}
		}

		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}

func (r *TaskRepository) Update(ctx context.Context, id uuid.UUID, input model.UpdateTaskInput) (*model.Task, error) {
	var sets []string
	var args []interface{}
	argIdx := 1

	if input.Title != nil {
		sets = append(sets, fmt.Sprintf("title = $%d", argIdx))
		args = append(args, *input.Title)
		argIdx++
	}
	if input.Description != nil {
		sets = append(sets, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *input.Description)
		argIdx++
	}
	if input.Status != nil {
		sets = append(sets, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *input.Status)
		argIdx++
	}
	if input.Priority != nil {
		sets = append(sets, fmt.Sprintf("priority = $%d", argIdx))
		args = append(args, *input.Priority)
		argIdx++
	}
	if input.AssigneeID != nil {
		sets = append(sets, fmt.Sprintf("assignee_id = $%d", argIdx))
		args = append(args, *input.AssigneeID)
		argIdx++
	}
	if input.StartDate != nil {
		sets = append(sets, fmt.Sprintf("start_date = $%d", argIdx))
		args = append(args, *input.StartDate)
		argIdx++
	}
	if input.Deadline != nil {
		sets = append(sets, fmt.Sprintf("deadline = $%d", argIdx))
		args = append(args, *input.Deadline)
		argIdx++
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, id)
	}

	sets = append(sets, "updated_at = NOW()")
	query := fmt.Sprintf("UPDATE tasks SET %s WHERE id = $%d", strings.Join(sets, ", "), argIdx)
	args = append(args, id)

	_, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	return r.GetByID(ctx, id)
}

func (r *TaskRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status model.Status) error {
	_, err := r.db.Exec(ctx, "UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2", status, id)
	return err
}

func (r *TaskRepository) UpdatePosition(ctx context.Context, id uuid.UUID, position string) error {
	_, err := r.db.Exec(ctx, "UPDATE tasks SET position = $1, updated_at = NOW() WHERE id = $2", position, id)
	return err
}

func (r *TaskRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, "DELETE FROM tasks WHERE id = $1", id)
	return err
}

// GetLastPosition returns the position of the last task in a story, used for new task positioning
func (r *TaskRepository) GetLastPosition(ctx context.Context, storyID uuid.UUID) (string, error) {
	var pos *string
	err := r.db.QueryRow(ctx, `
		SELECT position FROM tasks WHERE story_id = $1 ORDER BY position DESC LIMIT 1
	`, storyID).Scan(&pos)
	if errors.Is(err, pgx.ErrNoRows) || pos == nil {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return *pos, nil
}
