package handler

import (
	"net/http"

	"github.com/qrt/command/internal/repository"
)

type TeamHandler struct {
	teamRepo *repository.TeamRepository
}

func NewTeamHandler(teamRepo *repository.TeamRepository) *TeamHandler {
	return &TeamHandler{teamRepo: teamRepo}
}

func (h *TeamHandler) List(w http.ResponseWriter, r *http.Request) {
	teams, err := h.teamRepo.List(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list teams")
		return
	}
	if teams == nil {
		respondJSON(w, http.StatusOK, []interface{}{})
		return
	}
	respondJSON(w, http.StatusOK, teams)
}

func (h *TeamHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid team id")
		return
	}
	team, err := h.teamRepo.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to get team")
		return
	}
	if team == nil {
		respondError(w, http.StatusNotFound, "team not found")
		return
	}
	respondJSON(w, http.StatusOK, team)
}
