package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ChangeLogger struct {
	db *pgxpool.Pool
}

func NewChangeLogger(db *pgxpool.Pool) *ChangeLogger {
	return &ChangeLogger{db: db}
}

// LogChange records a change in the command_changelog table
func (cl *ChangeLogger) LogChange(ctx context.Context, entityType string, entityID uuid.UUID, action string, field string, oldValue, newValue interface{}, changedBy uuid.UUID) {
	var oldStr, newStr *string
	if oldValue != nil {
		s := fmt.Sprintf("%v", oldValue)
		oldStr = &s
	}
	if newValue != nil {
		s := fmt.Sprintf("%v", newValue)
		newStr = &s
	}

	cl.db.Exec(ctx, `
		INSERT INTO command_changelog (entity_type, entity_id, action, field, old_value, new_value, changed_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, entityType, entityID, action, field, oldStr, newStr, changedBy)
}

// LogCreated logs entity creation
func (cl *ChangeLogger) LogCreated(ctx context.Context, entityType string, entityID uuid.UUID, changedBy uuid.UUID) {
	cl.LogChange(ctx, entityType, entityID, "created", "", nil, nil, changedBy)
}

// LogDeleted logs entity deletion
func (cl *ChangeLogger) LogDeleted(ctx context.Context, entityType string, entityID uuid.UUID, changedBy uuid.UUID) {
	cl.LogChange(ctx, entityType, entityID, "deleted", "", nil, nil, changedBy)
}

// LogStatusChange logs a status transition
func (cl *ChangeLogger) LogStatusChange(ctx context.Context, entityType string, entityID uuid.UUID, oldStatus, newStatus interface{}, changedBy uuid.UUID) {
	cl.LogChange(ctx, entityType, entityID, "status_changed", "status", oldStatus, newStatus, changedBy)
}

// LogReassigned logs assignee change
func (cl *ChangeLogger) LogReassigned(ctx context.Context, entityType string, entityID uuid.UUID, oldAssignee, newAssignee interface{}, changedBy uuid.UUID) {
	cl.LogChange(ctx, entityType, entityID, "reassigned", "assignee_id", oldAssignee, newAssignee, changedBy)
}
