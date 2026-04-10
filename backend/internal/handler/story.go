package handler

import (
	"net/http"
	"strconv"

	"github.com/qrt/command/internal/middleware"
	"github.com/qrt/command/internal/model"
	"github.com/qrt/command/internal/service"
)

type StoryHandler struct {
	storyService *service.StoryService
}

func NewStoryHandler(storyService *service.StoryService) *StoryHandler {
	return &StoryHandler{storyService: storyService}
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
	filter := model.StoryFilter{
		Limit:  50,
		Offset: 0,
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
		s := model.Status(v)
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
		"data":   stories,
		"total":  total,
		"limit":  filter.Limit,
		"offset": filter.Offset,
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

	w.WriteHeader(http.StatusNoContent)
}
