package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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
		SELECT id, name, code, description, is_active, offices, created_at, updated_at
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
		rows.Scan(&reg.ID, &reg.Name, &reg.Code, &reg.Description, &reg.IsActive, &reg.Offices, &reg.CreatedAt, &reg.UpdatedAt)
		regions = append(regions, reg)
	}
	if regions == nil {
		regions = []model.Region{}
	}
	respondJSON(w, http.StatusOK, regions)
}

// Create — C-Level creates a new region
func (h *RegionHandler) Create(w http.ResponseWriter, r *http.Request) {
	if model.Role(middleware.GetUserRole(r.Context())) != model.RoleCLevel {
		respondError(w, http.StatusForbidden, "only C-Level can manage regions")
		return
	}
	var input struct {
		Name        string `json:"name"`
		Code        string `json:"code"`
		Description string `json:"description"`
	}
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if input.Name == "" || input.Code == "" {
		respondError(w, http.StatusBadRequest, "name and code required")
		return
	}
	var reg model.Region
	err := h.db.QueryRow(r.Context(), `
		INSERT INTO regions (name, code, description)
		VALUES ($1, $2, NULLIF($3, ''))
		RETURNING id, name, code, description, is_active, offices, created_at, updated_at
	`, input.Name, input.Code, input.Description).Scan(
		&reg.ID, &reg.Name, &reg.Code, &reg.Description, &reg.IsActive, &reg.Offices, &reg.CreatedAt, &reg.UpdatedAt,
	)
	if err != nil {
		log.Printf("regions.Create failed: %v (input: name=%q code=%q)", err, input.Name, input.Code)
		// Friendly message for duplicate code (UNIQUE constraint violation)
		msg := err.Error()
		status := http.StatusBadRequest
		if strings.Contains(msg, "duplicate key") && strings.Contains(msg, "regions_code_key") {
			status = http.StatusConflict
			msg = "Region code \"" + input.Code + "\" already exists. Pick a different code."
		}
		respondError(w, status, msg)
		return
	}
	respondJSON(w, http.StatusCreated, reg)
}

// Update — C-Level renames or toggles is_active on a region
func (h *RegionHandler) Update(w http.ResponseWriter, r *http.Request) {
	if model.Role(middleware.GetUserRole(r.Context())) != model.RoleCLevel {
		respondError(w, http.StatusForbidden, "only C-Level can manage regions")
		return
	}
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid region id")
		return
	}
	var input struct {
		Name        *string `json:"name"`
		Code        *string `json:"code"`
		Description *string `json:"description"`
		IsActive    *bool    `json:"is_active"`
		Offices     []string `json:"offices"`
	}
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}
	var reg model.Region
	err = h.db.QueryRow(r.Context(), `
		UPDATE regions SET
		  name        = COALESCE($2, name),
		  code        = COALESCE($3, code),
		  description = COALESCE($4, description),
		  is_active   = COALESCE($5, is_active),
		  offices     = COALESCE($6, offices),
		  updated_at  = NOW()
		WHERE id = $1
		RETURNING id, name, code, description, is_active, offices, created_at, updated_at
	`, id, input.Name, input.Code, input.Description, input.IsActive, input.Offices).Scan(
		&reg.ID, &reg.Name, &reg.Code, &reg.Description, &reg.IsActive, &reg.Offices, &reg.CreatedAt, &reg.UpdatedAt,
	)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, reg)
}

// Delete — archive then hard-delete a region.
// Full snapshot (users, teams, stories, tasks, releases, events, snapshot counts)
// is copied to region_archives before the region is removed. Users and teams are
// NOT deleted; they lose their region assignment (region_id = NULL) and keep working.
func (h *RegionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if model.Role(middleware.GetUserRole(r.Context())) != model.RoleCLevel {
		respondError(w, http.StatusForbidden, "only C-Level can manage regions")
		return
	}
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid region id")
		return
	}
	archivedBy := middleware.GetUserID(r.Context())

	if err := h.archiveAndDelete(r.Context(), id, archivedBy); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusNoContent, nil)
}

// archiveAndDelete runs the snapshot + detach + delete in a single transaction.
func (h *RegionHandler) archiveAndDelete(ctx context.Context, regionID uuid.UUID, archivedBy uuid.UUID) error {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Fetch region
	var reg model.Region
	err = tx.QueryRow(ctx, `
		SELECT id, name, code, description, is_active, offices, created_at, updated_at
		FROM regions WHERE id = $1
	`, regionID).Scan(&reg.ID, &reg.Name, &reg.Code, &reg.Description, &reg.IsActive, &reg.Offices, &reg.CreatedAt, &reg.UpdatedAt)
	if err != nil {
		return err
	}

	// Gather affiliated data
	users, _ := collectRows(ctx, tx, `
		SELECT id, full_name, email, role, is_active, approved, team_id, created_at
		FROM users WHERE region_id = $1 ORDER BY full_name
	`, regionID)
	teams, _ := collectRows(ctx, tx, `
		SELECT t.id, t.name, t.office, t.lead_id, t.is_active, t.created_at,
		       (SELECT full_name FROM users u WHERE u.id = t.lead_id) AS lead_name,
		       (SELECT COUNT(*) FROM board_members bm WHERE bm.board_id = t.id) AS member_count
		FROM teams t WHERE t.region_id = $1 ORDER BY t.name
	`, regionID)
	stories, _ := collectRows(ctx, tx, `
		SELECT s.id, s.title, s.status, s.priority, s.progress, s.deadline, s.team_id,
		       t.name AS team_name
		FROM stories s
		LEFT JOIN teams t ON t.id = s.team_id
		WHERE t.region_id = $1 AND s.deleted_at IS NULL
		ORDER BY s.created_at DESC
	`, regionID)
	tasks, _ := collectRows(ctx, tx, `
		SELECT ta.id, ta.title, ta.status, ta.priority, ta.progress, ta.deadline,
		       ta.team_id, tm.name AS team_name, ta.assignee_id,
		       (SELECT full_name FROM users u WHERE u.id = ta.assignee_id) AS assignee_name
		FROM tasks ta
		LEFT JOIN teams tm ON tm.id = ta.team_id
		WHERE tm.region_id = $1 AND ta.deleted_at IS NULL
		ORDER BY ta.created_at DESC
	`, regionID)
	releases, _ := collectRows(ctx, tx, `
		SELECT id, release_date, label, release_type, office, description
		FROM command_releases WHERE region_id = $1 ORDER BY release_date
	`, regionID)
	events, _ := collectRows(ctx, tx, `
		SELECT id, event_date, kind, label, affected_kpis, description
		FROM command_timeline_events WHERE region_id = $1 ORDER BY event_date
	`, regionID)
	var snapshotCount int
	tx.QueryRow(ctx, `SELECT COUNT(*) FROM command_daily_snapshots WHERE region_id = $1`, regionID).Scan(&snapshotCount)

	payload := map[string]interface{}{
		"region": map[string]interface{}{
			"id":          reg.ID,
			"name":        reg.Name,
			"code":        reg.Code,
			"description": reg.Description,
			"is_active":   reg.IsActive,
			"created_at":  reg.CreatedAt,
			"archived_at": time.Now().UTC(),
		},
		"users":             users,
		"teams":             teams,
		"stories":           stories,
		"tasks":             tasks,
		"releases":          releases,
		"events":            events,
		"snapshots_counted": snapshotCount,
	}
	counts := map[string]int{
		"users":     len(users),
		"teams":     len(teams),
		"stories":   len(stories),
		"tasks":     len(tasks),
		"releases":  len(releases),
		"events":    len(events),
		"snapshots": snapshotCount,
	}

	payloadJSON, _ := json.Marshal(payload)
	countsJSON, _ := json.Marshal(counts)

	// Insert archive row
	_, err = tx.Exec(ctx, `
		INSERT INTO region_archives (original_id, name, code, description, payload, counts, archived_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, regionID, reg.Name, reg.Code, reg.Description, payloadJSON, countsJSON, archivedBy)
	if err != nil {
		return err
	}

	// Detach users/teams (they survive, lose region)
	if _, err := tx.Exec(ctx, `UPDATE users SET region_id = NULL, updated_at = NOW() WHERE region_id = $1`, regionID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE teams SET region_id = NULL, updated_at = NOW() WHERE region_id = $1`, regionID); err != nil {
		return err
	}
	// Releases/events have ON DELETE SET NULL; daily_snapshots have ON DELETE CASCADE.
	// Both handled by the foreign-key semantics when we delete the region.
	if _, err := tx.Exec(ctx, `DELETE FROM regions WHERE id = $1`, regionID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ListArchives — C-Level views all archived regions.
func (h *RegionHandler) ListArchives(w http.ResponseWriter, r *http.Request) {
	if model.Role(middleware.GetUserRole(r.Context())) != model.RoleCLevel {
		respondError(w, http.StatusForbidden, "only C-Level can view archives")
		return
	}
	rows, err := h.db.Query(r.Context(), `
		SELECT a.id, a.original_id, a.name, a.code, a.description, a.counts, a.archived_at,
		       u.full_name
		FROM region_archives a
		LEFT JOIN users u ON u.id = a.archived_by
		ORDER BY a.archived_at DESC
	`)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []map[string]interface{}{}
	for rows.Next() {
		var id, origID uuid.UUID
		var name, code string
		var desc, archiver *string
		var countsRaw []byte
		var archivedAt time.Time
		if err := rows.Scan(&id, &origID, &name, &code, &desc, &countsRaw, &archivedAt, &archiver); err != nil {
			continue
		}
		var counts map[string]int
		json.Unmarshal(countsRaw, &counts)
		out = append(out, map[string]interface{}{
			"id":           id,
			"original_id":  origID,
			"name":         name,
			"code":         code,
			"description":  desc,
			"counts":       counts,
			"archived_at":  archivedAt,
			"archived_by":  archiver,
		})
	}
	respondJSON(w, http.StatusOK, out)
}

// GetArchive — full payload of a single archive.
func (h *RegionHandler) GetArchive(w http.ResponseWriter, r *http.Request) {
	if model.Role(middleware.GetUserRole(r.Context())) != model.RoleCLevel {
		respondError(w, http.StatusForbidden, "only C-Level can view archives")
		return
	}
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid archive id")
		return
	}
	var (
		origID      uuid.UUID
		name, code  string
		desc        *string
		payloadRaw  []byte
		countsRaw   []byte
		archivedAt  time.Time
		archiver    *string
	)
	err = h.db.QueryRow(r.Context(), `
		SELECT a.original_id, a.name, a.code, a.description, a.payload, a.counts, a.archived_at,
		       u.full_name
		FROM region_archives a
		LEFT JOIN users u ON u.id = a.archived_by
		WHERE a.id = $1
	`, id).Scan(&origID, &name, &code, &desc, &payloadRaw, &countsRaw, &archivedAt, &archiver)
	if err != nil {
		respondError(w, http.StatusNotFound, "archive not found")
		return
	}
	var payload, counts interface{}
	json.Unmarshal(payloadRaw, &payload)
	json.Unmarshal(countsRaw, &counts)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"id":           id,
		"original_id":  origID,
		"name":         name,
		"code":         code,
		"description":  desc,
		"payload":      payload,
		"counts":       counts,
		"archived_at":  archivedAt,
		"archived_by":  archiver,
	})
}

// collectRows is a generic helper that turns a query into a slice of maps so
// we can dump them straight into JSONB without defining per-query structs.
func collectRows(ctx context.Context, tx pgx.Tx, sql string, args ...interface{}) ([]map[string]interface{}, error) {
	rows, err := tx.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	descs := rows.FieldDescriptions()
	var out []map[string]interface{}
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return nil, err
		}
		row := make(map[string]interface{}, len(descs))
		for i, d := range descs {
			row[string(d.Name)] = vals[i]
		}
		out = append(out, row)
	}
	return out, rows.Err()
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
