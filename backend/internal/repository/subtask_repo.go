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

type SubtaskRepository struct {
	db *pgxpool.Pool
}

func NewSubtaskRepository(db *pgxpool.Pool) *SubtaskRepository {
	return &SubtaskRepository{db: db}
}

func (r *SubtaskRepository) Create(ctx context.Context, s *model.Subtask) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO subtasks (task_id, title, description, status, assignee_id, start_date, deadline, position, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at
	`, s.TaskID, s.Title, s.Description, s.Status, s.AssigneeID,
		s.StartDate, s.Deadline, s.Position, s.CreatedBy,
	).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
}

func (r *SubtaskRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Subtask, error) {
	var s model.Subtask
	err := r.db.QueryRow(ctx, `
		SELECT id, task_id, title, description, status, progress, assignee_id,
		       start_date, deadline, position, created_by, created_at, updated_at
		FROM subtasks WHERE id = $1
	`, id).Scan(
		&s.ID, &s.TaskID, &s.Title, &s.Description, &s.Status, &s.Progress,
		&s.AssigneeID, &s.StartDate, &s.Deadline, &s.Position, &s.CreatedBy,
		&s.CreatedAt, &s.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &s, err
}

func (r *SubtaskRepository) ListByTask(ctx context.Context, taskID uuid.UUID) ([]model.Subtask, error) {
	rows, err := r.db.Query(ctx, `
		SELECT s.id, s.task_id, s.title, s.description, s.status, s.progress,
		       s.assignee_id, s.start_date, s.deadline, s.position, s.created_by, s.created_at, s.updated_at,
		       u.full_name, u.avatar_url
		FROM subtasks s
		LEFT JOIN users u ON s.assignee_id = u.id
		WHERE s.task_id = $1
		ORDER BY s.position ASC
	`, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subtasks []model.Subtask
	for rows.Next() {
		var s model.Subtask
		var assigneeName, assigneeAvatar *string

		if err := rows.Scan(
			&s.ID, &s.TaskID, &s.Title, &s.Description, &s.Status, &s.Progress,
			&s.AssigneeID, &s.StartDate, &s.Deadline, &s.Position, &s.CreatedBy,
			&s.CreatedAt, &s.UpdatedAt,
			&assigneeName, &assigneeAvatar,
		); err != nil {
			return nil, err
		}

		if s.AssigneeID != nil && assigneeName != nil {
			s.Assignee = &model.User{
				ID:        *s.AssigneeID,
				FullName:  *assigneeName,
				AvatarURL: assigneeAvatar,
			}
		}

		subtasks = append(subtasks, s)
	}
	return subtasks, rows.Err()
}

func (r *SubtaskRepository) Update(ctx context.Context, id uuid.UUID, input model.UpdateSubtaskInput) (*model.Subtask, error) {
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
	query := fmt.Sprintf("UPDATE subtasks SET %s WHERE id = $%d", strings.Join(sets, ", "), argIdx)
	args = append(args, id)

	_, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	return r.GetByID(ctx, id)
}

func (r *SubtaskRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status model.Status) error {
	_, err := r.db.Exec(ctx, "UPDATE subtasks SET status = $1, updated_at = NOW() WHERE id = $2", status, id)
	return err
}

func (r *SubtaskRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, "DELETE FROM subtasks WHERE id = $1", id)
	return err
}

func (r *SubtaskRepository) GetLastPosition(ctx context.Context, taskID uuid.UUID) (string, error) {
	var pos *string
	err := r.db.QueryRow(ctx, `
		SELECT position FROM subtasks WHERE task_id = $1 ORDER BY position DESC LIMIT 1
	`, taskID).Scan(&pos)
	if errors.Is(err, pgx.ErrNoRows) || pos == nil {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return *pos, nil
}
