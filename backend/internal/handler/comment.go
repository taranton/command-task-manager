package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/qrt/command/internal/middleware"
	"github.com/qrt/command/internal/model"
	"github.com/qrt/command/internal/repository"
)

type CommentHandler struct {
	commentRepo *repository.CommentRepository
}

func NewCommentHandler(commentRepo *repository.CommentRepository) *CommentHandler {
	return &CommentHandler{commentRepo: commentRepo}
}

// POST /api/v1/:entity_type/:entity_id/comments
func (h *CommentHandler) Create(w http.ResponseWriter, r *http.Request) {
	entityType := model.EntityType(chi.URLParam(r, "entity_type"))
	if !entityType.IsValid() {
		respondError(w, http.StatusBadRequest, "invalid entity type (must be story, task, or subtask)")
		return
	}
	entityID, err := paramUUID(r, "entity_id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid entity id")
		return
	}

	var input model.CreateCommentInput
	if err := decodeJSON(r, &input); err != nil || input.Body == "" {
		respondError(w, http.StatusBadRequest, "body is required")
		return
	}

	userID := middleware.GetUserID(r.Context())

	comment := &model.Comment{
		EntityType: entityType,
		EntityID:   entityID,
		AuthorID:   userID,
		Body:       input.Body,
	}

	if err := h.commentRepo.Create(r.Context(), comment); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create comment")
		return
	}

	// Refetch with author info
	created, _ := h.commentRepo.GetByID(r.Context(), comment.ID)
	if created != nil {
		respondJSON(w, http.StatusCreated, created)
	} else {
		respondJSON(w, http.StatusCreated, comment)
	}
}

// GET /api/v1/:entity_type/:entity_id/comments
func (h *CommentHandler) List(w http.ResponseWriter, r *http.Request) {
	entityType := model.EntityType(chi.URLParam(r, "entity_type"))
	if !entityType.IsValid() {
		respondError(w, http.StatusBadRequest, "invalid entity type")
		return
	}
	entityID, err := paramUUID(r, "entity_id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid entity id")
		return
	}

	comments, err := h.commentRepo.ListByEntity(r.Context(), entityType, entityID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list comments")
		return
	}
	if comments == nil {
		comments = []model.Comment{}
	}
	respondJSON(w, http.StatusOK, comments)
}

// PATCH /api/v1/comments/:id
func (h *CommentHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid comment id")
		return
	}

	// Only author can edit
	comment, err := h.commentRepo.GetByID(r.Context(), id)
	if err != nil || comment == nil {
		respondError(w, http.StatusNotFound, "comment not found")
		return
	}
	userID := middleware.GetUserID(r.Context())
	if comment.AuthorID != userID {
		respondError(w, http.StatusForbidden, "only the author can edit this comment")
		return
	}

	var input model.UpdateCommentInput
	if err := decodeJSON(r, &input); err != nil || input.Body == "" {
		respondError(w, http.StatusBadRequest, "body is required")
		return
	}

	if err := h.commentRepo.Update(r.Context(), id, input.Body); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update comment")
		return
	}

	updated, _ := h.commentRepo.GetByID(r.Context(), id)
	respondJSON(w, http.StatusOK, updated)
}

// DELETE /api/v1/comments/:id
func (h *CommentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid comment id")
		return
	}

	// Only author or admin can delete
	comment, err := h.commentRepo.GetByID(r.Context(), id)
	if err != nil || comment == nil {
		respondError(w, http.StatusNotFound, "comment not found")
		return
	}
	userID := middleware.GetUserID(r.Context())
	userRole := middleware.GetUserRole(r.Context())
	if comment.AuthorID != userID && userRole != string(model.RoleCLevel) {
		respondError(w, http.StatusForbidden, "only the author or admin can delete this comment")
		return
	}

	if err := h.commentRepo.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete comment")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
