package model

import (
	"time"

	"github.com/google/uuid"
)

// ---- Story Status ----

type StoryStatus string

const (
	StoryStatusBacklog StoryStatus = "backlog"
	StoryStatusActive  StoryStatus = "active"
	StoryStatusDone    StoryStatus = "done"
	StoryStatusClosed  StoryStatus = "closed"
)

func (s StoryStatus) IsValid() bool {
	switch s {
	case StoryStatusBacklog, StoryStatusActive, StoryStatusDone, StoryStatusClosed:
		return true
	}
	return false
}

// ---- Priority (shared) ----

type Priority string

const (
	PriorityCritical Priority = "critical"
	PriorityHigh     Priority = "high"
	PriorityMedium   Priority = "medium"
	PriorityLow      Priority = "low"
)

func (p Priority) IsValid() bool {
	switch p {
	case PriorityCritical, PriorityHigh, PriorityMedium, PriorityLow:
		return true
	}
	return false
}

// ---- Story Entity ----

type Story struct {
	ID           uuid.UUID   `json:"id" db:"id"`
	Title        string      `json:"title" db:"title"`
	Description  *string     `json:"description,omitempty" db:"description"`
	Status       StoryStatus `json:"status" db:"status"`
	Progress     int         `json:"progress" db:"progress"`
	Priority     Priority    `json:"priority" db:"priority"`
	ProjectID    *string     `json:"project_id,omitempty" db:"project_id"`
	Tags         []string    `json:"tags" db:"tags"`
	AssignedLead *uuid.UUID  `json:"assigned_lead,omitempty" db:"assigned_lead"`
	TeamID       *uuid.UUID  `json:"team_id,omitempty" db:"team_id"`
	StartDate    *time.Time  `json:"start_date,omitempty" db:"start_date"`
	Deadline     *time.Time  `json:"deadline,omitempty" db:"deadline"`
	SortOrder    int         `json:"sort_order" db:"sort_order"`
	CreatedBy    uuid.UUID   `json:"created_by" db:"created_by"`
	CreatedAt    time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at" db:"updated_at"`
	DeletedAt    *time.Time  `json:"deleted_at,omitempty" db:"deleted_at"`

	// Joined fields
	Tasks              []Task `json:"tasks,omitempty"`
	TaskCount          int    `json:"task_count" db:"task_count"`
	CompletedTaskCount int    `json:"completed_tasks_count" db:"completed_tasks_count"`
}

type CreateStoryInput struct {
	Title        string   `json:"title" validate:"required,max=255"`
	Description  *string  `json:"description,omitempty"`
	Priority     Priority `json:"priority" validate:"required"`
	ProjectID    *string  `json:"project_id,omitempty"`
	Tags         []string `json:"tags,omitempty"`
	AssignedLead *string  `json:"assigned_lead,omitempty"`
	StartDate    *string  `json:"start_date,omitempty"`
	Deadline     *string  `json:"deadline,omitempty"`
}

type UpdateStoryInput struct {
	Title        *string      `json:"title,omitempty"`
	Description  *string      `json:"description,omitempty"`
	Status       *StoryStatus `json:"status,omitempty"`
	Priority     *Priority    `json:"priority,omitempty"`
	ProjectID    *string      `json:"project_id,omitempty"`
	Tags         *[]string    `json:"tags,omitempty"`
	AssignedLead *string      `json:"assigned_lead,omitempty"`
	StartDate    *string      `json:"start_date,omitempty"`
	Deadline     *string      `json:"deadline,omitempty"`
}

type StoryFilter struct {
	Status    *StoryStatus `json:"status,omitempty"`
	Priority  *Priority    `json:"priority,omitempty"`
	ProjectID *string      `json:"project_id,omitempty"`
	TeamID    *uuid.UUID   `json:"team_id,omitempty"`
	RegionID  *uuid.UUID   `json:"region_id,omitempty"`
	Limit     int          `json:"limit"`
	Offset    int          `json:"offset"`
}

// ---- Cascade Result ----

type CascadeResult struct {
	TaskUpdated  *Task  `json:"task_updated,omitempty"`
	StoryUpdated *Story `json:"story_updated,omitempty"`
}
