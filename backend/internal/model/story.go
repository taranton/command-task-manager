package model

import (
	"time"

	"github.com/google/uuid"
)

type Status string

const (
	StatusBacklog    Status = "backlog"
	StatusTodo       Status = "todo"
	StatusInProgress Status = "in_progress"
	StatusInReview   Status = "in_review"
	StatusDone       Status = "done"
	StatusClosed     Status = "closed"
)

func (s Status) IsValid() bool {
	switch s {
	case StatusBacklog, StatusTodo, StatusInProgress, StatusInReview, StatusDone, StatusClosed:
		return true
	}
	return false
}

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

type Story struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Title       string    `json:"title" db:"title"`
	Description *string   `json:"description,omitempty" db:"description"`
	Status      Status    `json:"status" db:"status"`
	Progress    int       `json:"progress" db:"progress"`
	Priority    Priority  `json:"priority" db:"priority"`
	ProjectID   *string    `json:"project_id,omitempty" db:"project_id"`
	TeamID      *uuid.UUID `json:"team_id,omitempty" db:"team_id"`
	CreatedBy   uuid.UUID `json:"created_by" db:"created_by"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
	Tasks       []Task    `json:"tasks,omitempty"`
	TaskCount   int       `json:"task_count" db:"task_count"`
}

type CreateStoryInput struct {
	Title       string   `json:"title" validate:"required,max=500"`
	Description *string  `json:"description,omitempty"`
	Priority    Priority `json:"priority" validate:"required"`
	ProjectID   *string  `json:"project_id,omitempty"`
}

type UpdateStoryInput struct {
	Title       *string   `json:"title,omitempty"`
	Description *string   `json:"description,omitempty"`
	Status      *Status   `json:"status,omitempty"`
	Priority    *Priority `json:"priority,omitempty"`
	ProjectID   *string   `json:"project_id,omitempty"`
}

type StoryFilter struct {
	Status    *Status  `json:"status,omitempty"`
	Priority  *Priority `json:"priority,omitempty"`
	ProjectID *string  `json:"project_id,omitempty"`
	Limit     int      `json:"limit"`
	Offset    int      `json:"offset"`
}
