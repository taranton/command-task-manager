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
		INSERT INTO stories (title, description, status, priority, project_id, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at
	`, s.Title, s.Description, s.Status, s.Priority, s.ProjectID, s.CreatedBy,
	).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
}

func (r *StoryRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Story, error) {
	var s model.Story
	err := r.db.QueryRow(ctx, `
		SELECT s.id, s.title, s.description, s.status, s.progress, s.priority,
		       s.project_id, s.created_by, s.created_at, s.updated_at,
		       COALESCE((SELECT COUNT(*) FROM tasks WHERE story_id = s.id), 0) as task_count
		FROM stories s
		WHERE s.id = $1
	`, id).Scan(
		&s.ID, &s.Title, &s.Description, &s.Status, &s.Progress, &s.Priority,
		&s.ProjectID, &s.CreatedBy, &s.CreatedAt, &s.UpdatedAt, &s.TaskCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &s, err
}

func (r *StoryRepository) List(ctx context.Context, filter model.StoryFilter) ([]model.Story, int, error) {
	var conditions []string
	var args []interface{}
	argIdx := 1

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

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Count
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM stories s %s", where)
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// List
	if filter.Limit == 0 {
		filter.Limit = 50
	}
	query := fmt.Sprintf(`
		SELECT s.id, s.title, s.description, s.status, s.progress, s.priority,
		       s.project_id, s.created_by, s.created_at, s.updated_at,
		       COALESCE((SELECT COUNT(*) FROM tasks WHERE story_id = s.id), 0) as task_count
		FROM stories s
		%s
		ORDER BY s.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
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
			&s.ProjectID, &s.CreatedBy, &s.CreatedAt, &s.UpdatedAt, &s.TaskCount,
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

	if len(sets) == 0 {
		return r.GetByID(ctx, id)
	}

	sets = append(sets, "updated_at = NOW()")
	query := fmt.Sprintf(`
		UPDATE stories SET %s WHERE id = $%d
		RETURNING id, title, description, status, progress, priority, project_id, created_by, created_at, updated_at
	`, strings.Join(sets, ", "), argIdx)
	args = append(args, id)

	var s model.Story
	err := r.db.QueryRow(ctx, query, args...).Scan(
		&s.ID, &s.Title, &s.Description, &s.Status, &s.Progress, &s.Priority,
		&s.ProjectID, &s.CreatedBy, &s.CreatedAt, &s.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &s, err
}

func (r *StoryRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, "DELETE FROM stories WHERE id = $1", id)
	return err
}
