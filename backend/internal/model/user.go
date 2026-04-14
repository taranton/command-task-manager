package model

import (
	"time"

	"github.com/google/uuid"
)

type Role string

const (
	RoleCLevel   Role = "clevel"
	RoleTeamLead Role = "team_lead"
	RoleMember   Role = "member"
	RoleTrainee  Role = "trainee"
)

type User struct {
	ID         uuid.UUID `json:"id" db:"id"`
	ExternalID *string   `json:"external_id,omitempty" db:"external_id"`
	Email      string    `json:"email" db:"email"`
	FullName   string    `json:"full_name" db:"full_name"`
	Password   string    `json:"-" db:"password_hash"`
	Role       Role      `json:"role" db:"role"`
	AvatarURL  *string    `json:"avatar_url,omitempty" db:"avatar_url"`
	TeamID     *uuid.UUID `json:"team_id,omitempty" db:"team_id"`
	RegionID   *uuid.UUID `json:"region_id,omitempty" db:"region_id"`
	IsActive   bool       `json:"is_active" db:"is_active"`
	Approved   bool       `json:"approved" db:"approved"`
	ApprovedBy *uuid.UUID `json:"approved_by,omitempty" db:"approved_by"`
	ApprovedAt *time.Time `json:"approved_at,omitempty" db:"approved_at"`
	CreatedAt  time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time   `json:"updated_at" db:"updated_at"`

	// Joined
	Boards []UserBoard `json:"boards,omitempty"`
}

type UserBoard struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	Role string    `json:"role"`
}

func (r Role) IsValid() bool {
	switch r {
	case RoleCLevel, RoleTeamLead, RoleMember, RoleTrainee:
		return true
	}
	return false
}

func (r Role) CanManageTasks() bool {
	return r == RoleCLevel || r == RoleTeamLead
}

func (r Role) CanViewAllTasks() bool {
	return r == RoleCLevel || r == RoleTeamLead
}

func (r Role) CanCreateTasks() bool {
	return r != RoleTrainee
}
