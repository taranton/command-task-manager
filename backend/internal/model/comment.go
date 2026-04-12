package model

import (
	"time"

	"github.com/google/uuid"
)

type EntityType string

const (
	EntityTypeStory   EntityType = "story"
	EntityTypeTask    EntityType = "task"
	EntityTypeSubtask EntityType = "subtask"
)

func (e EntityType) IsValid() bool {
	switch e {
	case EntityTypeStory, EntityTypeTask, EntityTypeSubtask:
		return true
	}
	return false
}

type Comment struct {
	ID         uuid.UUID  `json:"id" db:"id"`
	EntityType EntityType `json:"entity_type" db:"entity_type"`
	EntityID   uuid.UUID  `json:"entity_id" db:"entity_id"`
	AuthorID   uuid.UUID  `json:"author_id" db:"author_id"`
	Body       string     `json:"body" db:"body"`
	IsEdited   bool       `json:"is_edited" db:"is_edited"`
	CreatedAt  time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at" db:"updated_at"`

	// Joined
	AuthorName   string  `json:"author_name,omitempty" db:"author_name"`
	AuthorAvatar *string `json:"author_avatar,omitempty" db:"author_avatar"`
}

type CreateCommentInput struct {
	Body string `json:"body" validate:"required"`
}

type UpdateCommentInput struct {
	Body string `json:"body" validate:"required"`
}
