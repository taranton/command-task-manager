package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/qrt/command/internal/model"
)

type CommentRepository struct {
	db *pgxpool.Pool
}

func NewCommentRepository(db *pgxpool.Pool) *CommentRepository {
	return &CommentRepository{db: db}
}

func (r *CommentRepository) Create(ctx context.Context, c *model.Comment) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO command_comments (entity_type, entity_id, author_id, body)
		VALUES ($1, $2, $3, $4)
		RETURNING id, is_edited, created_at, updated_at
	`, c.EntityType, c.EntityID, c.AuthorID, c.Body,
	).Scan(&c.ID, &c.IsEdited, &c.CreatedAt, &c.UpdatedAt)
}

func (r *CommentRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Comment, error) {
	var c model.Comment
	err := r.db.QueryRow(ctx, `
		SELECT c.id, c.entity_type, c.entity_id, c.author_id, c.body, c.is_edited, c.created_at, c.updated_at,
		       u.full_name, u.avatar_url
		FROM command_comments c
		LEFT JOIN users u ON c.author_id = u.id
		WHERE c.id = $1
	`, id).Scan(
		&c.ID, &c.EntityType, &c.EntityID, &c.AuthorID, &c.Body, &c.IsEdited, &c.CreatedAt, &c.UpdatedAt,
		&c.AuthorName, &c.AuthorAvatar,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &c, err
}

func (r *CommentRepository) ListByEntity(ctx context.Context, entityType model.EntityType, entityID uuid.UUID) ([]model.Comment, error) {
	rows, err := r.db.Query(ctx, `
		SELECT c.id, c.entity_type, c.entity_id, c.author_id, c.body, c.is_edited, c.created_at, c.updated_at,
		       u.full_name, u.avatar_url
		FROM command_comments c
		LEFT JOIN users u ON c.author_id = u.id
		WHERE c.entity_type = $1 AND c.entity_id = $2
		ORDER BY c.created_at ASC
	`, entityType, entityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var comments []model.Comment
	for rows.Next() {
		var c model.Comment
		if err := rows.Scan(
			&c.ID, &c.EntityType, &c.EntityID, &c.AuthorID, &c.Body, &c.IsEdited, &c.CreatedAt, &c.UpdatedAt,
			&c.AuthorName, &c.AuthorAvatar,
		); err != nil {
			return nil, err
		}
		comments = append(comments, c)
	}
	return comments, rows.Err()
}

func (r *CommentRepository) Update(ctx context.Context, id uuid.UUID, body string) error {
	_, err := r.db.Exec(ctx,
		"UPDATE command_comments SET body = $1, is_edited = true, updated_at = NOW() WHERE id = $2",
		body, id)
	return err
}

func (r *CommentRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, "DELETE FROM command_comments WHERE id = $1", id)
	return err
}

// CountByEntity returns comment count for an entity (used on cards)
func (r *CommentRepository) CountByEntity(ctx context.Context, entityType model.EntityType, entityID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(ctx,
		"SELECT COUNT(*) FROM command_comments WHERE entity_type = $1 AND entity_id = $2",
		entityType, entityID).Scan(&count)
	return count, err
}
