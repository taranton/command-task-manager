package model

import (
	"time"

	"github.com/google/uuid"
)

// ---- Subtask Status ----

type SubtaskStatus string

const (
	SubtaskStatusToDo       SubtaskStatus = "to_do"
	SubtaskStatusInProgress SubtaskStatus = "in_progress"
	SubtaskStatusDone       SubtaskStatus = "done"
)

func (s SubtaskStatus) IsValid() bool {
	switch s {
	case SubtaskStatusToDo, SubtaskStatusInProgress, SubtaskStatusDone:
		return true
	}
	return false
}

// AutoProgress returns the automatic progress for a subtask status
func (s SubtaskStatus) AutoProgress(manualProgress int) int {
	switch s {
	case SubtaskStatusToDo:
		return 0
	case SubtaskStatusDone:
		return 100
	case SubtaskStatusInProgress:
		if manualProgress > 0 && manualProgress < 100 {
			return manualProgress
		}
		return 50 // default
	}
	return 0
}

// ---- Subtask Entity ----

type Subtask struct {
	ID          uuid.UUID     `json:"id" db:"id"`
	TaskID      uuid.UUID     `json:"task_id" db:"task_id"`
	Title       string        `json:"title" db:"title"`
	Description *string       `json:"description,omitempty" db:"description"`
	Status      SubtaskStatus `json:"status" db:"status"`
	Progress    int           `json:"progress" db:"progress"`
	AssigneeID  *uuid.UUID    `json:"assignee_id,omitempty" db:"assignee_id"`
	StartDate   *time.Time    `json:"start_date,omitempty" db:"start_date"`
	Deadline    *time.Time    `json:"deadline,omitempty" db:"deadline"`
	SortOrder   int           `json:"sort_order" db:"sort_order"`
	CreatedBy   uuid.UUID     `json:"created_by" db:"created_by"`
	CreatedAt   time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at" db:"updated_at"`

	// Joined fields
	Assignee *User `json:"assignee,omitempty"`
}

type CreateSubtaskInput struct {
	Title       string     `json:"title" validate:"required,max=255"`
	Description *string    `json:"description,omitempty"`
	AssigneeID  *uuid.UUID `json:"assignee_id,omitempty"`
	StartDate   *string    `json:"start_date,omitempty"`
	Deadline    *string    `json:"deadline,omitempty"`
}

type UpdateSubtaskInput struct {
	Title       *string        `json:"title,omitempty"`
	Description *string        `json:"description,omitempty"`
	Status      *SubtaskStatus `json:"status,omitempty"`
	Progress    *int           `json:"progress,omitempty"`
	AssigneeID  *uuid.UUID     `json:"assignee_id,omitempty"`
	StartDate   *string        `json:"start_date,omitempty"`
	Deadline    *string        `json:"deadline,omitempty"`
}

type UpdateSubtaskStatusInput struct {
	Status SubtaskStatus `json:"status" validate:"required"`
}
