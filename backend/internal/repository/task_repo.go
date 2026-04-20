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
		INSERT INTO tasks (story_id, title, description, status, priority, assignee_id,
		                   start_date, deadline, estimated_hours, sort_order, team_id, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, progress, created_at, updated_at
	`, t.StoryID, t.Title, t.Description, t.Status, t.Priority, t.AssigneeID,
		t.StartDate, t.Deadline, t.EstimatedHours, t.SortOrder, t.TeamID, t.CreatedBy,
	).Scan(&t.ID, &t.Progress, &t.CreatedAt, &t.UpdatedAt)
}

const taskSelectCols = `t.id, t.story_id, t.title, t.description, t.status, t.progress, t.priority,
	t.assignee_id, t.start_date, t.deadline, t.estimated_hours, t.sort_order, t.team_id,
	t.created_by, t.created_at, t.updated_at`

const taskJoinCols = `u.full_name, u.avatar_url,
	COALESCE((SELECT COUNT(*) FROM subtasks WHERE task_id = t.id), 0) as subtask_count,
	COALESCE((SELECT COUNT(*) FROM subtasks WHERE task_id = t.id AND status = 'done'), 0) as subtask_done,
	s.title as story_title`

func scanTask(row pgx.Row, t *model.Task) error {
	var assigneeName, assigneeAvatar *string
	err := row.Scan(
		&t.ID, &t.StoryID, &t.Title, &t.Description, &t.Status, &t.Progress, &t.Priority,
		&t.AssigneeID, &t.StartDate, &t.Deadline, &t.EstimatedHours, &t.SortOrder, &t.TeamID,
		&t.CreatedBy, &t.CreatedAt, &t.UpdatedAt,
		&assigneeName, &assigneeAvatar,
		&t.SubtaskCount, &t.SubtaskDone, &t.StoryTitle,
	)
	if err != nil {
		return err
	}
	if t.AssigneeID != nil && assigneeName != nil {
		t.Assignee = &model.User{ID: *t.AssigneeID, FullName: *assigneeName, AvatarURL: assigneeAvatar}
	}
	return nil
}

func (r *TaskRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Task, error) {
	var t model.Task
	err := scanTask(r.db.QueryRow(ctx, `
		SELECT `+taskSelectCols+`, `+taskJoinCols+`
		FROM tasks t
		LEFT JOIN users u ON t.assignee_id = u.id
		LEFT JOIN stories s ON t.story_id = s.id
		WHERE t.id = $1 AND t.deleted_at IS NULL
	`, id), &t)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &t, err
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

// GetAllByStory returns ALL non-deleted tasks for cascade calculations (no limit)
func (r *TaskRepository) GetAllByStory(ctx context.Context, storyID uuid.UUID) ([]model.Task, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, status, progress FROM tasks
		WHERE story_id = $1 AND deleted_at IS NULL
	`, storyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []model.Task
	for rows.Next() {
		var t model.Task
		if err := rows.Scan(&t.ID, &t.Status, &t.Progress); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}

func (r *TaskRepository) list(ctx context.Context, filter *model.TaskFilter) ([]model.Task, error) {
	var conditions []string
	var args []interface{}
	argIdx := 1

	conditions = append(conditions, "t.deleted_at IS NULL")
	// Exclude tasks belonging to archived stories from board/list views.
	conditions = append(conditions, "NOT EXISTS (SELECT 1 FROM stories s2 WHERE s2.id = t.story_id AND s2.archived_at IS NOT NULL)")

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
	if filter.RegionID != nil {
		// Filter by region: tasks whose board (team) belongs to the region
		conditions = append(conditions, fmt.Sprintf("t.team_id IN (SELECT id FROM teams WHERE region_id = $%d)", argIdx))
		args = append(args, *filter.RegionID)
		argIdx++
	}

	where := "WHERE " + strings.Join(conditions, " AND ")

	if filter.Limit == 0 {
		filter.Limit = 100
	}

	query := fmt.Sprintf(`
		SELECT %s, %s
		FROM tasks t
		LEFT JOIN users u ON t.assignee_id = u.id
		LEFT JOIN stories s ON t.story_id = s.id
		%s
		ORDER BY t.sort_order ASC
		LIMIT $%d OFFSET $%d
	`, taskSelectCols, taskJoinCols, where, argIdx, argIdx+1)
	args = append(args, filter.Limit, filter.Offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []model.Task
	for rows.Next() {
		var t model.Task
		if err := scanTask(rows, &t); err != nil {
			return nil, err
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
	if input.EstimatedHours != nil {
		sets = append(sets, fmt.Sprintf("estimated_hours = $%d", argIdx))
		args = append(args, *input.EstimatedHours)
		argIdx++
	}
	if input.StoryID != nil {
		sets = append(sets, fmt.Sprintf("story_id = $%d", argIdx))
		args = append(args, *input.StoryID)
		argIdx++
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, id)
	}

	sets = append(sets, "updated_at = NOW()")
	query := fmt.Sprintf("UPDATE tasks SET %s WHERE id = $%d AND deleted_at IS NULL", strings.Join(sets, ", "), argIdx)
	args = append(args, id)

	_, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id)
}

func (r *TaskRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status model.TaskStatus) error {
	_, err := r.db.Exec(ctx, "UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2", status, id)
	return err
}

func (r *TaskRepository) UpdateProgress(ctx context.Context, id uuid.UUID, progress int) error {
	_, err := r.db.Exec(ctx, "UPDATE tasks SET progress = $1, updated_at = NOW() WHERE id = $2", progress, id)
	return err
}

func (r *TaskRepository) UpdateSortOrder(ctx context.Context, id uuid.UUID, sortOrder int) error {
	_, err := r.db.Exec(ctx, "UPDATE tasks SET sort_order = $1, updated_at = NOW() WHERE id = $2", sortOrder, id)
	return err
}

func (r *TaskRepository) Delete(ctx context.Context, id uuid.UUID) error {
	// Soft delete
	_, err := r.db.Exec(ctx, "UPDATE tasks SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1", id)
	return err
}

func (r *TaskRepository) GetMaxSortOrder(ctx context.Context, storyID uuid.UUID) (int, error) {
	var maxOrder *int
	err := r.db.QueryRow(ctx, `
		SELECT MAX(sort_order) FROM tasks WHERE story_id = $1 AND deleted_at IS NULL
	`, storyID).Scan(&maxOrder)
	if err != nil || maxOrder == nil {
		return 0, err
	}
	return *maxOrder, nil
}
