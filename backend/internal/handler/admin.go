package handler

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/qrt/command/internal/middleware"
	"github.com/qrt/command/internal/model"
	"github.com/qrt/command/internal/repository"
)

type AdminHandler struct {
	db       *pgxpool.Pool
	userRepo *repository.UserRepository
}

func NewAdminHandler(db *pgxpool.Pool, userRepo *repository.UserRepository) *AdminHandler {
	return &AdminHandler{db: db, userRepo: userRepo}
}

// UpdateUserRole — C-Level can set any role; Team Lead can set member/trainee within own team
func (h *AdminHandler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	currentRole := model.Role(middleware.GetUserRole(r.Context()))
	currentUserID := middleware.GetUserID(r.Context())

	if currentRole != model.RoleCLevel && currentRole != model.RoleTeamLead {
		respondError(w, http.StatusForbidden, "insufficient permissions")
		return
	}

	userID, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	var input struct {
		Role string `json:"role"`
	}
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	newRole := model.Role(input.Role)
	if !newRole.IsValid() {
		respondError(w, http.StatusBadRequest, "invalid role: must be clevel, team_lead, member, or trainee")
		return
	}

	if currentRole == model.RoleTeamLead {
		// Team Lead can only assign member or trainee
		if newRole != model.RoleMember && newRole != model.RoleTrainee {
			respondError(w, http.StatusForbidden, "team leads can only assign member or trainee roles")
			return
		}
		// Must be in the same team
		var leadTeamID, targetTeamID *uuid.UUID
		h.db.QueryRow(r.Context(), "SELECT team_id FROM users WHERE id = $1", currentUserID).Scan(&leadTeamID)
		h.db.QueryRow(r.Context(), "SELECT team_id FROM users WHERE id = $1", userID).Scan(&targetTeamID)
		if leadTeamID == nil || targetTeamID == nil || *leadTeamID != *targetTeamID {
			respondError(w, http.StatusForbidden, "you can only change roles for your own team members")
			return
		}
	}

	_, err = h.db.Exec(r.Context(),
		"UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2", input.Role, userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update role")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"id": userID, "role": input.Role})
}

// AssignUserToTeam — C-Level can assign anyone, Team Lead can assign to own team
func (h *AdminHandler) AssignUserToTeam(w http.ResponseWriter, r *http.Request) {
	currentRole := model.Role(middleware.GetUserRole(r.Context()))
	currentUserID := middleware.GetUserID(r.Context())

	userID, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	var input struct {
		TeamID *string `json:"team_id"` // null = remove from team
	}
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Permission check
	if currentRole == model.RoleCLevel {
		// C-Level can assign anyone to any team
	} else if currentRole == model.RoleTeamLead {
		// Team Lead can only assign to their own team
		var leadTeamID *uuid.UUID
		h.db.QueryRow(r.Context(), "SELECT team_id FROM users WHERE id = $1", currentUserID).Scan(&leadTeamID)
		if leadTeamID == nil {
			respondError(w, http.StatusForbidden, "you are not assigned to a team")
			return
		}
		if input.TeamID != nil {
			targetTeamID, err := uuid.Parse(*input.TeamID)
			if err != nil || targetTeamID != *leadTeamID {
				respondError(w, http.StatusForbidden, "you can only assign users to your own team")
				return
			}
		}
	} else {
		respondError(w, http.StatusForbidden, "insufficient permissions")
		return
	}

	if input.TeamID != nil {
		_, err = h.db.Exec(r.Context(),
			"UPDATE users SET team_id = $1, updated_at = NOW() WHERE id = $2", *input.TeamID, userID)
	} else {
		_, err = h.db.Exec(r.Context(),
			"UPDATE users SET team_id = NULL, updated_at = NOW() WHERE id = $1", userID)
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to assign team")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"id": userID, "team_id": input.TeamID})
}

// CreateTeam — C-Level only
func (h *AdminHandler) CreateTeam(w http.ResponseWriter, r *http.Request) {
	if model.Role(middleware.GetUserRole(r.Context())) != model.RoleCLevel {
		respondError(w, http.StatusForbidden, "only C-Level can create teams")
		return
	}

	var input struct {
		Name        string  `json:"name"`
		Description *string `json:"description"`
		Office      *string `json:"office"`
		LeadID      *string `json:"lead_id"`
	}
	if err := decodeJSON(r, &input); err != nil || input.Name == "" {
		respondError(w, http.StatusBadRequest, "name is required")
		return
	}

	var id uuid.UUID
	err := h.db.QueryRow(r.Context(), `
		INSERT INTO teams (name, description, office, lead_id)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, input.Name, input.Description, input.Office, input.LeadID).Scan(&id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create team")
		return
	}

	// If lead is set, assign them to this team
	if input.LeadID != nil {
		h.db.Exec(r.Context(), "UPDATE users SET team_id = $1 WHERE id = $2", id, *input.LeadID)
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{"id": id, "name": input.Name})
}

// UpdateTeam — C-Level or own Team Lead
func (h *AdminHandler) UpdateTeam(w http.ResponseWriter, r *http.Request) {
	currentRole := model.Role(middleware.GetUserRole(r.Context()))
	teamID, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid team id")
		return
	}

	if currentRole != model.RoleCLevel && currentRole != model.RoleTeamLead {
		respondError(w, http.StatusForbidden, "insufficient permissions")
		return
	}

	var input struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		Office      *string `json:"office"`
		LeadID      *string `json:"lead_id"`
	}
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if input.Name != nil {
		h.db.Exec(r.Context(), "UPDATE teams SET name = $1, updated_at = NOW() WHERE id = $2", *input.Name, teamID)
	}
	if input.Description != nil {
		h.db.Exec(r.Context(), "UPDATE teams SET description = $1, updated_at = NOW() WHERE id = $2", *input.Description, teamID)
	}
	if input.Office != nil {
		h.db.Exec(r.Context(), "UPDATE teams SET office = $1, updated_at = NOW() WHERE id = $2", *input.Office, teamID)
	}
	if input.LeadID != nil && currentRole == model.RoleCLevel {
		h.db.Exec(r.Context(), "UPDATE teams SET lead_id = $1, updated_at = NOW() WHERE id = $2", *input.LeadID, teamID)
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"id": teamID, "updated": true})
}

// GetTeamMembers — returns users in a team
func (h *AdminHandler) GetTeamMembers(w http.ResponseWriter, r *http.Request) {
	teamID, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid team id")
		return
	}

	rows, err := h.db.Query(r.Context(), `
		SELECT id, email, full_name, role, avatar_url, team_id, is_active, created_at, updated_at
		FROM users WHERE team_id = $1 AND is_active = true
		ORDER BY
			CASE role WHEN 'team_lead' THEN 0 WHEN 'member' THEN 1 WHEN 'trainee' THEN 2 ELSE 3 END,
			full_name
	`, teamID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list members")
		return
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(
			&u.ID, &u.Email, &u.FullName, &u.Role, &u.AvatarURL, &u.TeamID,
			&u.IsActive, &u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			respondError(w, http.StatusInternalServerError, "scan error")
			return
		}
		users = append(users, u)
	}
	if users == nil {
		users = []model.User{}
	}
	respondJSON(w, http.StatusOK, users)
}

// ListPending — users awaiting approval
func (h *AdminHandler) ListPending(w http.ResponseWriter, r *http.Request) {
	currentRole := model.Role(middleware.GetUserRole(r.Context()))
	if currentRole != model.RoleCLevel {
		respondError(w, http.StatusForbidden, "only C-Level can view pending users")
		return
	}

	users, err := h.userRepo.ListPending(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list pending")
		return
	}
	if users == nil {
		respondJSON(w, http.StatusOK, []interface{}{})
		return
	}
	respondJSON(w, http.StatusOK, users)
}

// ApproveUser — C-Level approves a pending registration
func (h *AdminHandler) ApproveUser(w http.ResponseWriter, r *http.Request) {
	currentRole := model.Role(middleware.GetUserRole(r.Context()))
	if currentRole != model.RoleCLevel {
		respondError(w, http.StatusForbidden, "only C-Level can approve users")
		return
	}

	userID, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	approverID := middleware.GetUserID(r.Context())
	_, err = h.db.Exec(r.Context(),
		"UPDATE users SET approved = true, approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2",
		approverID, userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to approve")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"id": userID, "approved": true})
}

// RejectUser — C-Level rejects (deactivates) a pending registration
func (h *AdminHandler) RejectUser(w http.ResponseWriter, r *http.Request) {
	currentRole := model.Role(middleware.GetUserRole(r.Context()))
	if currentRole != model.RoleCLevel {
		respondError(w, http.StatusForbidden, "only C-Level can reject users")
		return
	}

	userID, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	_, err = h.db.Exec(r.Context(),
		"UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1", userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to reject")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"id": userID, "rejected": true})
}
