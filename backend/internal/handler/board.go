package handler

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/qrt/command/internal/model"
	"github.com/qrt/command/internal/service"
)

type BoardHandler struct {
	taskService  *service.TaskService
	storyService *service.StoryService
}

func NewBoardHandler(taskService *service.TaskService, storyService *service.StoryService) *BoardHandler {
	return &BoardHandler{
		taskService:  taskService,
		storyService: storyService,
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

	board, err := h.taskService.GetBoard(r.Context(), filter)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to get board")
		return
	}

	respondJSON(w, http.StatusOK, board)
}
