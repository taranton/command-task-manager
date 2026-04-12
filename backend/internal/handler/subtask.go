package handler

import (
	"net/http"

	"github.com/qrt/command/internal/middleware"
	"github.com/qrt/command/internal/model"
	"github.com/qrt/command/internal/service"
	"github.com/qrt/command/internal/ws"
)

type SubtaskHandler struct {
	taskService *service.TaskService
	hub         *ws.Hub
}

func NewSubtaskHandler(taskService *service.TaskService, hub *ws.Hub) *SubtaskHandler {
	return &SubtaskHandler{taskService: taskService, hub: hub}
}

func (h *SubtaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	taskID, err := paramUUID(r, "taskId")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid task id")
		return
	}
	var input model.CreateSubtaskInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if input.Title == "" {
		respondError(w, http.StatusBadRequest, "title is required")
		return
	}
	userID := middleware.GetUserID(r.Context())
	subtask, err := h.taskService.CreateSubtask(r.Context(), taskID, input, userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create subtask")
		return
	}
	h.hub.Broadcast(ws.Message{Type: "subtask.created", Payload: subtask})
	respondJSON(w, http.StatusCreated, subtask)
}

func (h *SubtaskHandler) List(w http.ResponseWriter, r *http.Request) {
	taskID, err := paramUUID(r, "taskId")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid task id")
		return
	}
	subtasks, err := h.taskService.ListSubtasks(r.Context(), taskID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list subtasks")
		return
	}
	if subtasks == nil {
		subtasks = []model.Subtask{}
	}
	respondJSON(w, http.StatusOK, subtasks)
}

func (h *SubtaskHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid subtask id")
		return
	}
	var input model.UpdateSubtaskInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	subtask, err := h.taskService.UpdateSubtask(r.Context(), id, input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update subtask")
		return
	}
	if subtask == nil {
		respondError(w, http.StatusNotFound, "subtask not found")
		return
	}
	h.hub.Broadcast(ws.Message{Type: "subtask.updated", Payload: subtask})
	respondJSON(w, http.StatusOK, subtask)
}

func (h *SubtaskHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid subtask id")
		return
	}
	var input model.UpdateSubtaskStatusInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	cascade, err := h.taskService.UpdateSubtaskStatus(r.Context(), id, input.Status)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update status")
		return
	}

	h.hub.Broadcast(ws.Message{
		Type:    "subtask.updated",
		Payload: map[string]interface{}{"id": id.String(), "status": input.Status},
	})

	// Broadcast cascade changes
	if cascade != nil {
		if cascade.TaskUpdated != nil {
			h.hub.Broadcast(ws.Message{Type: "task.updated", Payload: cascade.TaskUpdated})
		}
		if cascade.StoryUpdated != nil {
			h.hub.Broadcast(ws.Message{Type: "story.updated", Payload: cascade.StoryUpdated})
		}
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"id": id, "status": input.Status, "cascade": cascade,
	})
}

func (h *SubtaskHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid subtask id")
		return
	}
	if err := h.taskService.DeleteSubtask(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete subtask")
		return
	}
	h.hub.Broadcast(ws.Message{Type: "subtask.deleted", Payload: map[string]interface{}{"id": id.String()}})
	w.WriteHeader(http.StatusNoContent)
}

func (h *SubtaskHandler) UpdateSortOrder(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid subtask id")
		return
	}
	var input struct {
		SortOrder int `json:"sort_order"`
	}
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.taskService.UpdateSubtaskSortOrder(r.Context(), id, input.SortOrder); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update sort order")
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"id": id, "sort_order": input.SortOrder})
}
