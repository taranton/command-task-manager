package handler

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/qrt/command/internal/middleware"
	"github.com/qrt/command/internal/model"
	"github.com/qrt/command/internal/service"
)

type BoardHandler struct {
	taskService  *service.TaskService
	storyService *service.StoryService
	db           *pgxpool.Pool
}

func NewBoardHandler(taskService *service.TaskService, storyService *service.StoryService, db *pgxpool.Pool) *BoardHandler {
	return &BoardHandler{
		taskService:  taskService,
		storyService: storyService,
		db:           db,
	}
}

func (h *BoardHandler) GetBoard(w http.ResponseWriter, r *http.Request) {
	filter := model.TaskFilter{
		Limit: 500,
	}

	if v := r.URL.Query().Get("story"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			filter.StoryID = &id
		}
	}
	if v := r.URL.Query().Get("assignee"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			filter.AssigneeID = &id
		}
	}
	if v := r.URL.Query().Get("priority"); v != "" {
		p := model.Priority(v)
		filter.Priority = &p
	}
	if v := r.URL.Query().Get("team"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			filter.TeamID = &id
		}
	}

	// Region filter: explicit param or auto from user's region
	if v := r.URL.Query().Get("region"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			filter.RegionID = &id
		}
	} else {
		// Auto-apply user's region unless C-Level
		userRole := middleware.GetUserRole(r.Context())
		if userRole != string(model.RoleCLevel) {
			userID := middleware.GetUserID(r.Context())
			var regionID *uuid.UUID
			h.db.QueryRow(r.Context(), "SELECT region_id FROM users WHERE id = $1", userID).Scan(&regionID)
			if regionID != nil {
				filter.RegionID = regionID
			}
		}
	}

	board, err := h.taskService.GetBoard(r.Context(), filter)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to get board")
		return
	}

	respondJSON(w, http.StatusOK, board)
}
