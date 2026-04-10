package model

import (
	"time"

	"github.com/google/uuid"
)

type Subtask struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	TaskID      uuid.UUID  `json:"task_id" db:"task_id"`
	Title       string     `json:"title" db:"title"`
	Description *string    `json:"description,omitempty" db:"description"`
	Status      Status     `json:"status" db:"status"`
	Progress    int        `json:"progress" db:"progress"`
	AssigneeID  *uuid.UUID `json:"assignee_id,omitempty" db:"assignee_id"`
	StartDate   *time.Time `json:"start_date,omitempty" db:"start_date"`
	Deadline    *time.Time `json:"deadline,omitempty" db:"deadline"`
	Position    string     `json:"position" db:"position"`
	CreatedBy   uuid.UUID  `json:"created_by" db:"created_by"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`

	// Joined fields
	Assignee *User `json:"assignee,omitempty"`
}

type CreateSubtaskInput struct {
	Title       string     `json:"title" validate:"required,max=500"`
	Description *string    `json:"description,omitempty"`
	AssigneeID  *uuid.UUID `json:"assignee_id,omitempty"`
	StartDate   *string    `json:"start_date,omitempty"`
	Deadline    *string    `json:"deadline,omitempty"`
}

type UpdateSubtaskInput struct {
	Title       *string    `json:"title,omitempty"`
	Description *string    `json:"description,omitempty"`
	Status      *Status    `json:"status,omitempty"`
	Priority    *Priority  `json:"priority,omitempty"`
	AssigneeID  *uuid.UUID `json:"assignee_id,omitempty"`
	StartDate   *string    `json:"start_date,omitempty"`
	Deadline    *string    `json:"deadline,omitempty"`
}
