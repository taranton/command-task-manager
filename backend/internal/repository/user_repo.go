package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/qrt/command/internal/model"
)

type UserRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	var u model.User
	err := r.db.QueryRow(ctx, `
		SELECT id, external_id, email, full_name, password_hash, role, avatar_url, team_id, is_active, approved, approved_by, approved_at, created_at, updated_at
		FROM users WHERE id = $1 AND is_active = true
	`, id).Scan(
		&u.ID, &u.ExternalID, &u.Email, &u.FullName, &u.Password,
		&u.Role, &u.AvatarURL, &u.TeamID, &u.IsActive, &u.Approved, &u.ApprovedBy, &u.ApprovedAt, &u.CreatedAt, &u.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &u, err
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	var u model.User
	err := r.db.QueryRow(ctx, `
		SELECT id, external_id, email, full_name, password_hash, role, avatar_url, team_id, is_active, approved, approved_by, approved_at, created_at, updated_at
		FROM users WHERE email = $1 AND is_active = true
	`, email).Scan(
		&u.ID, &u.ExternalID, &u.Email, &u.FullName, &u.Password,
		&u.Role, &u.AvatarURL, &u.TeamID, &u.IsActive, &u.Approved, &u.ApprovedBy, &u.ApprovedAt, &u.CreatedAt, &u.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &u, err
}

func (r *UserRepository) List(ctx context.Context) ([]model.User, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, external_id, email, full_name, role, avatar_url, team_id, is_active, approved, created_at, updated_at
		FROM users WHERE is_active = true AND approved = true
		ORDER BY full_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(
			&u.ID, &u.ExternalID, &u.Email, &u.FullName,
			&u.Role, &u.AvatarURL, &u.TeamID, &u.IsActive, &u.Approved, &u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *UserRepository) Create(ctx context.Context, email, fullName, passwordHash string) (*model.User, error) {
	var u model.User
	err := r.db.QueryRow(ctx, `
		INSERT INTO users (email, full_name, password_hash, role, is_active, approved)
		VALUES ($1, $2, $3, 'member', true, false)
		RETURNING id, email, full_name, role, is_active, approved, created_at
	`, email, fullName, passwordHash).Scan(
		&u.ID, &u.Email, &u.FullName, &u.Role, &u.IsActive, &u.Approved, &u.CreatedAt,
	)
	return &u, err
}

// ListPending returns users awaiting approval
func (r *UserRepository) ListPending(ctx context.Context) ([]model.User, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, email, full_name, role, is_active, approved, created_at
		FROM users WHERE is_active = true AND approved = false
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(
			&u.ID, &u.Email, &u.FullName, &u.Role, &u.IsActive, &u.Approved, &u.CreatedAt,
		); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}
