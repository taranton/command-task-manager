package model

import (
	"time"

	"github.com/google/uuid"
)

type Team struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	ExternalID  *string    `json:"external_id,omitempty" db:"external_id"`
	Name        string     `json:"name" db:"name"`
	Description *string    `json:"description,omitempty" db:"description"`
	Office      *string    `json:"office,omitempty" db:"office"`
	RegionID    *uuid.UUID `json:"region_id,omitempty" db:"region_id"`
	LeadID      *uuid.UUID `json:"lead_id,omitempty" db:"lead_id"`
	IsActive    bool       `json:"is_active" db:"is_active"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`

	// Joined
	Lead        *User      `json:"lead,omitempty"`
	MemberCount int        `json:"member_count" db:"member_count"`
}
