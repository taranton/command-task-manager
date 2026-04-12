package handler

import (
	"net/http"

	"github.com/qrt/command/internal/middleware"
	"github.com/qrt/command/internal/model"
	"github.com/qrt/command/internal/service"
	"github.com/qrt/command/internal/ws"
)

type TaskHandler struct {
	taskService *service.TaskService
	hub         *ws.Hub
}

func NewTaskHandler(taskService *service.TaskService, hub *ws.Hub) *TaskHandler {
	return &TaskHandler{taskService: taskService, hub: hub}
}

func (h *TaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	storyID, err := paramUUID(r, "storyId")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid story id")
		return
	}
	var input model.CreateTaskInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if input.Title == "" {
		respondError(w, http.StatusBadRequest, "title is required")
		return
	}
	userID := middleware.GetUserID(r.Context())
	task, err := h.taskService.CreateTask(r.Context(), storyID, input, userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create task")
		return
	}
	h.hub.Broadcast(ws.Message{Type: "task.created", Payload: task})
	respondJSON(w, http.StatusCreated, task)
}

func (h *TaskHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid task id")
		return
	}
	task, err := h.taskService.GetTask(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to get task")
		return
	}
	if task == nil {
		respondError(w, http.StatusNotFound, "task not found")
		return
	}
	respondJSON(w, http.StatusOK, task)
}

func (h *TaskHandler) ListByStory(w http.ResponseWriter, r *http.Request) {
	storyID, err := paramUUID(r, "storyId")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid story id")
		return
	}
	tasks, err := h.taskService.ListByStory(r.Context(), storyID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list tasks")
		return
	}
	if tasks == nil {
		tasks = []model.Task{}
	}
	respondJSON(w, http.StatusOK, tasks)
}

func (h *TaskHandler) MyTasks(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	tasks, err := h.taskService.ListMyTasks(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list tasks")
		return
	}
	if tasks == nil {
		tasks = []model.Task{}
	}
	respondJSON(w, http.StatusOK, tasks)
}

func (h *TaskHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid task id")
		return
	}
	var input model.UpdateTaskInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	task, err := h.taskService.UpdateTask(r.Context(), id, input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update task")
		return
	}
	if task == nil {
		respondError(w, http.StatusNotFound, "task not found")
		return
	}
	h.hub.Broadcast(ws.Message{Type: "task.updated", Payload: task})
	respondJSON(w, http.StatusOK, task)
}

func (h *TaskHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid task id")
		return
	}
	var input model.UpdateStatusInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	cascade, err := h.taskService.UpdateTaskStatus(r.Context(), id, input.Status)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update status")
		return
	}

	userID := middleware.GetUserID(r.Context())
	h.hub.Broadcast(ws.Message{
		Type: "task.moved",
		Payload: map[string]interface{}{
			"id": id.String(), "status": input.Status, "updated_by": userID.String(),
		},
	})

	// Broadcast cascade changes
	if cascade != nil && cascade.StoryUpdated != nil {
		h.hub.Broadcast(ws.Message{Type: "story.updated", Payload: cascade.StoryUpdated})
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"id": id, "status": input.Status, "cascade": cascade,
	})
}

func (h *TaskHandler) UpdateSortOrder(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid task id")
		return
	}
	var input struct {
		SortOrder int              `json:"sort_order"`
		Status    *model.TaskStatus `json:"status,omitempty"`
	}
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.taskService.UpdateTaskSortOrder(r.Context(), id, input.SortOrder); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update sort order")
		return
	}

	if input.Status != nil {
		h.taskService.UpdateTaskStatus(r.Context(), id, *input.Status)
	}

	userID := middleware.GetUserID(r.Context())
	h.hub.Broadcast(ws.Message{
		Type: "task.moved",
		Payload: map[string]interface{}{
			"id": id.String(), "sort_order": input.SortOrder, "status": input.Status, "updated_by": userID.String(),
		},
	})

	respondJSON(w, http.StatusOK, map[string]interface{}{"id": id, "sort_order": input.SortOrder})
}

func (h *TaskHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid task id")
		return
	}
	if err := h.taskService.DeleteTask(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete task")
		return
	}
	h.hub.Broadcast(ws.Message{Type: "task.deleted", Payload: map[string]interface{}{"id": id.String()}})
	w.WriteHeader(http.StatusNoContent)
}
