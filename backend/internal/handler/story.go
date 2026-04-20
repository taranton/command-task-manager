package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/qrt/command/internal/middleware"
	"github.com/qrt/command/internal/model"
	"github.com/qrt/command/internal/service"
	"github.com/qrt/command/internal/ws"
)

type StoryHandler struct {
	storyService *service.StoryService
	hub          *ws.Hub
}

func NewStoryHandler(storyService *service.StoryService, hub *ws.Hub) *StoryHandler {
	return &StoryHandler{storyService: storyService, hub: hub}
}

func (h *StoryHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input model.CreateStoryInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if input.Title == "" {
		respondError(w, http.StatusBadRequest, "title is required")
		return
	}

	userID := middleware.GetUserID(r.Context())
	story, err := h.storyService.Create(r.Context(), input, userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create story")
		return
	}
	if h.hub != nil {
		h.hub.Broadcast(ws.Message{Type: "story.created", Payload: story})
	}
	respondJSON(w, http.StatusCreated, story)
}

func (h *StoryHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid story id")
		return
	}
	story, err := h.storyService.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to get story")
		return
	}
	if story == nil {
		respondError(w, http.StatusNotFound, "story not found")
		return
	}
	respondJSON(w, http.StatusOK, story)
}

func (h *StoryHandler) List(w http.ResponseWriter, r *http.Request) {
	filter := model.StoryFilter{Limit: 50, Offset: 0}

	if v := r.URL.Query().Get("archived"); v == "true" || v == "1" {
		filter.ArchivedOnly = true
	}

	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			filter.Limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			filter.Offset = n
		}
	}
	if v := r.URL.Query().Get("status"); v != "" {
		s := model.StoryStatus(v)
		filter.Status = &s
	}
	if v := r.URL.Query().Get("priority"); v != "" {
		p := model.Priority(v)
		filter.Priority = &p
	}
	if v := queryString(r, "project_id"); v != nil {
		filter.ProjectID = v
	}

	stories, total, err := h.storyService.List(r.Context(), filter)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list stories")
		return
	}
	if stories == nil {
		stories = []model.Story{}
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": stories, "total": total, "limit": filter.Limit, "offset": filter.Offset,
	})
}

func (h *StoryHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid story id")
		return
	}
	var input model.UpdateStoryInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	story, err := h.storyService.Update(r.Context(), id, input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update story")
		return
	}
	if story == nil {
		respondError(w, http.StatusNotFound, "story not found")
		return
	}
	if h.hub != nil {
		h.hub.Broadcast(ws.Message{Type: "story.updated", Payload: story})
	}
	respondJSON(w, http.StatusOK, story)
}

func (h *StoryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid story id")
		return
	}
	if err := h.storyService.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete story")
		return
	}
	if h.hub != nil {
		h.hub.Broadcast(ws.Message{Type: "story.deleted", Payload: map[string]interface{}{"id": id.String()}})
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *StoryHandler) Archive(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid story id")
		return
	}
	if err := h.storyService.Archive(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to archive")
		return
	}
	if h.hub != nil {
		h.hub.Broadcast(ws.Message{Type: "story.updated", Payload: map[string]interface{}{"id": id.String(), "archived": true}})
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *StoryHandler) Unarchive(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid story id")
		return
	}
	var body struct {
		Deadline *string `json:"deadline"`
	}
	decodeJSON(r, &body) // body is optional
	var newDeadline *time.Time
	if body.Deadline != nil && *body.Deadline != "" {
		if t, err := time.Parse("2006-01-02", *body.Deadline); err == nil {
			newDeadline = &t
		}
	}
	if err := h.storyService.Unarchive(r.Context(), id, newDeadline); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to unarchive")
		return
	}
	if h.hub != nil {
		h.hub.Broadcast(ws.Message{Type: "story.updated", Payload: map[string]interface{}{"id": id.String(), "archived": false}})
	}
	w.WriteHeader(http.StatusNoContent)
}

// TimelineStart returns the earliest start_date across ongoing (non-done,
// non-archived) stories, optionally scoped by region. Used by Timeline view.
func (h *StoryHandler) TimelineStart(w http.ResponseWriter, r *http.Request) {
	var regionID *uuid.UUID
	if v := r.URL.Query().Get("region"); v != "" && v != "all" {
		if id, err := uuid.Parse(v); err == nil {
			regionID = &id
		}
	}
	d, err := h.storyService.EarliestOngoingStartDate(r.Context(), regionID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	resp := map[string]interface{}{"start_date": nil}
	if d != nil {
		resp["start_date"] = d.Format("2006-01-02")
	}
	respondJSON(w, http.StatusOK, resp)
}
