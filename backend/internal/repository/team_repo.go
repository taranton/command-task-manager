package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/qrt/command/internal/model"
)

type TeamRepository struct {
	db *pgxpool.Pool
}

func NewTeamRepository(db *pgxpool.Pool) *TeamRepository {
	return &TeamRepository{db: db}
}

func (r *TeamRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Team, error) {
	var t model.Team
	var leadName *string
	err := r.db.QueryRow(ctx, `
		SELECT t.id, t.external_id, t.name, t.description, t.office, t.lead_id,
		       t.is_active, t.created_at, t.updated_at,
		       u.full_name,
		       COALESCE((SELECT COUNT(*) FROM users WHERE team_id = t.id AND is_active = true), 0) as member_count
		FROM teams t
		LEFT JOIN users u ON t.lead_id = u.id
		WHERE t.id = $1
	`, id).Scan(
		&t.ID, &t.ExternalID, &t.Name, &t.Description, &t.Office, &t.LeadID,
		&t.IsActive, &t.CreatedAt, &t.UpdatedAt,
		&leadName, &t.MemberCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if t.LeadID != nil && leadName != nil {
		t.Lead = &model.User{ID: *t.LeadID, FullName: *leadName}
	}
	return &t, nil
}

func (r *TeamRepository) List(ctx context.Context) ([]model.Team, error) {
	rows, err := r.db.Query(ctx, `
		SELECT t.id, t.external_id, t.name, t.description, t.office, t.lead_id,
		       t.is_active, t.created_at, t.updated_at,
		       u.full_name,
		       COALESCE((SELECT COUNT(*) FROM users WHERE team_id = t.id AND is_active = true), 0) as member_count
		FROM teams t
		LEFT JOIN users u ON t.lead_id = u.id
		WHERE t.is_active = true
		ORDER BY t.name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teams []model.Team
	for rows.Next() {
		var t model.Team
		var leadName *string
		if err := rows.Scan(
			&t.ID, &t.ExternalID, &t.Name, &t.Description, &t.Office, &t.LeadID,
			&t.IsActive, &t.CreatedAt, &t.UpdatedAt,
			&leadName, &t.MemberCount,
		); err != nil {
			return nil, err
		}
		if t.LeadID != nil && leadName != nil {
			t.Lead = &model.User{ID: *t.LeadID, FullName: *leadName}
		}
		teams = append(teams, t)
	}
	return teams, rows.Err()
}

// GetUserTeam returns the team for a given user
func (r *TeamRepository) GetUserTeam(ctx context.Context, userID uuid.UUID) (*model.Team, error) {
	var teamID *uuid.UUID
	err := r.db.QueryRow(ctx, "SELECT team_id FROM users WHERE id = $1", userID).Scan(&teamID)
	if err != nil || teamID == nil {
		return nil, err
	}
	return r.GetByID(ctx, *teamID)
}
