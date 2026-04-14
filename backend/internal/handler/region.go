package handler

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/qrt/command/internal/middleware"
	"github.com/qrt/command/internal/model"
)

type RegionHandler struct {
	db *pgxpool.Pool
}

func NewRegionHandler(db *pgxpool.Pool) *RegionHandler {
	return &RegionHandler{db: db}
}

func (h *RegionHandler) List(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(r.Context(), `
		SELECT id, name, code, description, is_active, created_at, updated_at
		FROM regions WHERE is_active = true ORDER BY name
	`)
	if err != nil {
		respondJSON(w, http.StatusOK, []interface{}{})
		return
	}
	defer rows.Close()

	var regions []model.Region
	for rows.Next() {
		var reg model.Region
		rows.Scan(&reg.ID, &reg.Name, &reg.Code, &reg.Description, &reg.IsActive, &reg.CreatedAt, &reg.UpdatedAt)
		regions = append(regions, reg)
	}
	if regions == nil {
		regions = []model.Region{}
	}
	respondJSON(w, http.StatusOK, regions)
}

// AssignRegion — C-Level assigns a user or board to a region
func (h *RegionHandler) AssignUserRegion(w http.ResponseWriter, r *http.Request) {
	if model.Role(middleware.GetUserRole(r.Context())) != model.RoleCLevel {
		respondError(w, http.StatusForbidden, "only C-Level can assign regions")
		return
	}
	userID, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	var input struct {
		RegionID *string `json:"region_id"`
	}
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if input.RegionID != nil {
		h.db.Exec(r.Context(), "UPDATE users SET region_id = $1, updated_at = NOW() WHERE id = $2", *input.RegionID, userID)
	} else {
		h.db.Exec(r.Context(), "UPDATE users SET region_id = NULL, updated_at = NOW() WHERE id = $1", userID)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"id": userID, "region_id": input.RegionID})
}

func (h *RegionHandler) AssignBoardRegion(w http.ResponseWriter, r *http.Request) {
	if model.Role(middleware.GetUserRole(r.Context())) != model.RoleCLevel {
		respondError(w, http.StatusForbidden, "only C-Level can assign regions")
		return
	}
	boardID, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid board id")
		return
	}
	var input struct {
		RegionID *string `json:"region_id"`
	}
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if input.RegionID != nil {
		h.db.Exec(r.Context(), "UPDATE teams SET region_id = $1, updated_at = NOW() WHERE id = $2", *input.RegionID, boardID)
	} else {
		h.db.Exec(r.Context(), "UPDATE teams SET region_id = NULL, updated_at = NOW() WHERE id = $1", boardID)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"id": boardID, "region_id": input.RegionID})
}
