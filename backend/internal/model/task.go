package model

import (
	"time"

	"github.com/google/uuid"
)

// ---- Task Status ----

type TaskStatus string

const (
	TaskStatusBacklog    TaskStatus = "backlog"
	TaskStatusToDo       TaskStatus = "to_do"
	TaskStatusInProgress TaskStatus = "in_progress"
	TaskStatusInReview   TaskStatus = "in_review"
	TaskStatusDone       TaskStatus = "done"
)

func (s TaskStatus) IsValid() bool {
	switch s {
	case TaskStatusBacklog, TaskStatusToDo, TaskStatusInProgress, TaskStatusInReview, TaskStatusDone:
		return true
	}
	return false
}

func (s TaskStatus) IsBeyondBacklog() bool {
	return s != TaskStatusBacklog
}

// TaskStatusOrder for Kanban columns
var TaskStatusOrder = []TaskStatus{
	TaskStatusBacklog,
	TaskStatusToDo,
	TaskStatusInProgress,
	TaskStatusInReview,
	TaskStatusDone,
}

// ---- Task Entity ----

type Task struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	StoryID        uuid.UUID  `json:"story_id" db:"story_id"`
	Title          string     `json:"title" db:"title"`
	Description    *string    `json:"description,omitempty" db:"description"`
	Status         TaskStatus `json:"status" db:"status"`
	Progress       int        `json:"progress" db:"progress"`
	Priority       Priority   `json:"priority" db:"priority"`
	AssigneeID     *uuid.UUID `json:"assignee_id,omitempty" db:"assignee_id"`
	StartDate      *time.Time `json:"start_date,omitempty" db:"start_date"`
	Deadline       *time.Time `json:"deadline,omitempty" db:"deadline"`
	EstimatedHours *float64   `json:"estimated_hours,omitempty" db:"estimated_hours"`
	SortOrder      int        `json:"sort_order" db:"sort_order"`
	TeamID         *uuid.UUID `json:"team_id,omitempty" db:"team_id"`
	CreatedBy      uuid.UUID  `json:"created_by" db:"created_by"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`

	// Joined fields
	Assignee     *User     `json:"assignee,omitempty"`
	Subtasks     []Subtask `json:"subtasks,omitempty"`
	SubtaskCount int       `json:"subtask_count" db:"subtask_count"`
	SubtaskDone  int       `json:"subtask_done" db:"subtask_done"`
	StoryTitle   string    `json:"story_title,omitempty" db:"story_title"`
}

type CreateTaskInput struct {
	Title          string     `json:"title" validate:"required,max=255"`
	Description    *string    `json:"description,omitempty"`
	Priority       Priority   `json:"priority" validate:"required"`
	AssigneeID     *uuid.UUID `json:"assignee_id,omitempty"`
	StartDate      *string    `json:"start_date,omitempty"`
	Deadline       *string    `json:"deadline,omitempty"`
	EstimatedHours *float64   `json:"estimated_hours,omitempty"`
}

type UpdateTaskInput struct {
	Title          *string     `json:"title,omitempty"`
	Description    *string     `json:"description,omitempty"`
	Status         *TaskStatus `json:"status,omitempty"`
	Priority       *Priority   `json:"priority,omitempty"`
	AssigneeID     *uuid.UUID  `json:"assignee_id,omitempty"`
	StoryID        *uuid.UUID  `json:"story_id,omitempty"`
	StartDate      *string     `json:"start_date,omitempty"`
	Deadline       *string     `json:"deadline,omitempty"`
	EstimatedHours *float64    `json:"estimated_hours,omitempty"`
}

type UpdateStatusInput struct {
	Status TaskStatus `json:"status" validate:"required"`
}

type UpdateSortOrderInput struct {
	SortOrder int         `json:"sort_order" validate:"required"`
	Status    *TaskStatus `json:"status,omitempty"`
}

type TaskFilter struct {
	StoryID    *uuid.UUID  `json:"story_id,omitempty"`
	AssigneeID *uuid.UUID  `json:"assignee_id,omitempty"`
	TeamID     *uuid.UUID  `json:"team_id,omitempty"`
	Status     *TaskStatus `json:"status,omitempty"`
	Priority   *Priority   `json:"priority,omitempty"`
	Limit      int         `json:"limit"`
	Offset     int         `json:"offset"`
}

// BoardColumn represents a Kanban column with tasks grouped by status
type BoardColumn struct {
	Status TaskStatus `json:"status"`
	Tasks  []Task     `json:"tasks"`
	Count  int        `json:"count"`
}

// Board represents the full Kanban board
type Board struct {
	Columns []BoardColumn `json:"columns"`
}
