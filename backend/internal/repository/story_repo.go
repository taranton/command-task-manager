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

type StoryRepository struct {
	db *pgxpool.Pool
}

func NewStoryRepository(db *pgxpool.Pool) *StoryRepository {
	return &StoryRepository{db: db}
}

func (r *StoryRepository) Create(ctx context.Context, s *model.Story) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO stories (title, description, status, priority, project_id, tags, assigned_lead, team_id, start_date, deadline, sort_order, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, progress, created_at, updated_at
	`, s.Title, s.Description, s.Status, s.Priority, s.ProjectID, s.Tags, s.AssignedLead, s.TeamID,
		s.StartDate, s.Deadline, s.SortOrder, s.CreatedBy,
	).Scan(&s.ID, &s.Progress, &s.CreatedAt, &s.UpdatedAt)
}

const storySelectCols = `s.id, s.title, s.description, s.status, s.progress, s.priority,
	s.project_id, s.tags, s.assigned_lead, s.team_id, s.start_date, s.deadline,
	s.sort_order, s.created_by, s.created_at, s.updated_at`

func scanStory(row pgx.Row, s *model.Story) error {
	return row.Scan(
		&s.ID, &s.Title, &s.Description, &s.Status, &s.Progress, &s.Priority,
		&s.ProjectID, &s.Tags, &s.AssignedLead, &s.TeamID, &s.StartDate, &s.Deadline,
		&s.SortOrder, &s.CreatedBy, &s.CreatedAt, &s.UpdatedAt,
		&s.TaskCount, &s.CompletedTaskCount,
	)
}

func (r *StoryRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Story, error) {
	var s model.Story
	err := scanStory(r.db.QueryRow(ctx, `
		SELECT `+storySelectCols+`,
		       COALESCE((SELECT COUNT(*) FROM tasks WHERE story_id = s.id AND deleted_at IS NULL), 0) as task_count,
		       COALESCE((SELECT COUNT(*) FROM tasks WHERE story_id = s.id AND deleted_at IS NULL AND status = 'done'), 0) as completed_tasks_count
		FROM stories s
		WHERE s.id = $1 AND s.deleted_at IS NULL
	`, id), &s)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &s, err
}

func (r *StoryRepository) List(ctx context.Context, filter model.StoryFilter) ([]model.Story, int, error) {
	var conditions []string
	var args []interface{}
	argIdx := 1

	conditions = append(conditions, "s.deleted_at IS NULL")

	if filter.Status != nil {
		conditions = append(conditions, fmt.Sprintf("s.status = $%d", argIdx))
		args = append(args, *filter.Status)
		argIdx++
	}
	if filter.Priority != nil {
		conditions = append(conditions, fmt.Sprintf("s.priority = $%d", argIdx))
		args = append(args, *filter.Priority)
		argIdx++
	}
	if filter.ProjectID != nil {
		conditions = append(conditions, fmt.Sprintf("s.project_id = $%d", argIdx))
		args = append(args, *filter.ProjectID)
		argIdx++
	}
	if filter.TeamID != nil {
		conditions = append(conditions, fmt.Sprintf("s.team_id = $%d", argIdx))
		args = append(args, *filter.TeamID)
		argIdx++
	}
	if filter.RegionID != nil {
		conditions = append(conditions, fmt.Sprintf("s.team_id IN (SELECT id FROM teams WHERE region_id = $%d)", argIdx))
		args = append(args, *filter.RegionID)
		argIdx++
	}

	where := "WHERE " + strings.Join(conditions, " AND ")

	var total int
	if err := r.db.QueryRow(ctx, "SELECT COUNT(*) FROM stories s "+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	if filter.Limit == 0 {
		filter.Limit = 50
	}
	query := fmt.Sprintf(`
		SELECT %s,
		       COALESCE((SELECT COUNT(*) FROM tasks WHERE story_id = s.id AND deleted_at IS NULL), 0) as task_count,
		       COALESCE((SELECT COUNT(*) FROM tasks WHERE story_id = s.id AND deleted_at IS NULL AND status = 'done'), 0) as completed_tasks_count
		FROM stories s
		%s
		ORDER BY s.sort_order ASC, s.created_at DESC
		LIMIT $%d OFFSET $%d
	`, storySelectCols, where, argIdx, argIdx+1)
	args = append(args, filter.Limit, filter.Offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var stories []model.Story
	for rows.Next() {
		var s model.Story
		if err := rows.Scan(
			&s.ID, &s.Title, &s.Description, &s.Status, &s.Progress, &s.Priority,
			&s.ProjectID, &s.Tags, &s.AssignedLead, &s.TeamID, &s.StartDate, &s.Deadline,
			&s.SortOrder, &s.CreatedBy, &s.CreatedAt, &s.UpdatedAt,
			&s.TaskCount, &s.CompletedTaskCount,
		); err != nil {
			return nil, 0, err
		}
		stories = append(stories, s)
	}
	return stories, total, rows.Err()
}

func (r *StoryRepository) Update(ctx context.Context, id uuid.UUID, input model.UpdateStoryInput) (*model.Story, error) {
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
	if input.ProjectID != nil {
		sets = append(sets, fmt.Sprintf("project_id = $%d", argIdx))
		args = append(args, *input.ProjectID)
		argIdx++
	}
	if input.Tags != nil {
		sets = append(sets, fmt.Sprintf("tags = $%d", argIdx))
		args = append(args, *input.Tags)
		argIdx++
	}
	if input.AssignedLead != nil {
		sets = append(sets, fmt.Sprintf("assigned_lead = $%d", argIdx))
		args = append(args, *input.AssignedLead)
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
	query := fmt.Sprintf("UPDATE stories SET %s WHERE id = $%d AND deleted_at IS NULL", strings.Join(sets, ", "), argIdx)
	args = append(args, id)

	_, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id)
}

func (r *StoryRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status model.StoryStatus) error {
	_, err := r.db.Exec(ctx, "UPDATE stories SET status = $1, updated_at = NOW() WHERE id = $2", status, id)
	return err
}

func (r *StoryRepository) UpdateProgress(ctx context.Context, id uuid.UUID, progress int) error {
	_, err := r.db.Exec(ctx, "UPDATE stories SET progress = $1, updated_at = NOW() WHERE id = $2", progress, id)
	return err
}

func (r *StoryRepository) Delete(ctx context.Context, id uuid.UUID) error {
	// Soft delete
	_, err := r.db.Exec(ctx, "UPDATE stories SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1", id)
	return err
}
