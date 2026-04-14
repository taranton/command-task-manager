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

// AssignUserToTeam — C-Level can assign anyone, Team Lead can assign to own board
// Now uses board_members junction table (many-to-many)
func (h *AdminHandler) AssignUserToTeam(w http.ResponseWriter, r *http.Request) {
	currentRole := model.Role(middleware.GetUserRole(r.Context()))
	currentUserID := middleware.GetUserID(r.Context())

	userID, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	var input struct {
		TeamID *string `json:"team_id"` // null = remove from all boards (legacy), or board_id to add
	}
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Permission check
	if currentRole == model.RoleCLevel {
		// C-Level can assign anyone to any board
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
		// Add to board via board_members (many-to-many)
		// Get user's role for the board_members entry
		var userRole string
		h.db.QueryRow(r.Context(), "SELECT role FROM users WHERE id = $1", userID).Scan(&userRole)
		if userRole == "" || userRole == "clevel" {
			userRole = "member"
		}
		_, err = h.db.Exec(r.Context(),
			`INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)
			 ON CONFLICT (board_id, user_id) DO NOTHING`,
			*input.TeamID, userID, userRole)
		// Also update legacy users.team_id for backward compat
		h.db.Exec(r.Context(), "UPDATE users SET team_id = $1, updated_at = NOW() WHERE id = $2", *input.TeamID, userID)
	} else {
		// Remove from all boards
		_, err = h.db.Exec(r.Context(), "DELETE FROM board_members WHERE user_id = $1", userID)
		h.db.Exec(r.Context(), "UPDATE users SET team_id = NULL, updated_at = NOW() WHERE id = $1", userID)
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to assign board")
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

// GetTeamMembers — returns users in a board (via board_members junction table)
func (h *AdminHandler) GetTeamMembers(w http.ResponseWriter, r *http.Request) {
	teamID, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid board id")
		return
	}

	// Try board_members first, fallback to users.team_id for backward compat
	rows, err := h.db.Query(r.Context(), `
		SELECT u.id, u.email, u.full_name, bm.role, u.avatar_url, u.team_id, u.is_active, u.created_at, u.updated_at
		FROM users u
		INNER JOIN board_members bm ON u.id = bm.user_id
		WHERE bm.board_id = $1 AND u.is_active = true
		ORDER BY
			CASE bm.role WHEN 'team_lead' THEN 0 WHEN 'member' THEN 1 WHEN 'trainee' THEN 2 ELSE 3 END,
			u.full_name
	`, teamID)
	if err != nil {
		// Fallback to legacy query
		rows, err = h.db.Query(r.Context(), `
			SELECT id, email, full_name, role, avatar_url, team_id, is_active, created_at, updated_at
			FROM users WHERE team_id = $1 AND is_active = true
			ORDER BY full_name
		`, teamID)
	}
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

// UpdateBoardMemberRole — change a user's role within a specific board
func (h *AdminHandler) UpdateBoardMemberRole(w http.ResponseWriter, r *http.Request) {
	boardID, err := paramUUID(r, "boardId")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid board id")
		return
	}
	userID, err := paramUUID(r, "userId")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	var input struct {
		Role string `json:"role"`
	}
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}
	role := model.Role(input.Role)
	if role != model.RoleTeamLead && role != model.RoleMember && role != model.RoleTrainee {
		respondError(w, http.StatusBadRequest, "role must be team_lead, member, or trainee")
		return
	}
	if role == model.RoleTeamLead {
		var existing *string
		h.db.QueryRow(r.Context(),
			"SELECT user_id::text FROM board_members WHERE board_id = $1 AND role = 'team_lead' AND user_id != $2",
			boardID, userID).Scan(&existing)
		if existing != nil {
			respondError(w, http.StatusConflict, "board already has a Team Lead")
			return
		}
	}
	_, err = h.db.Exec(r.Context(),
		"UPDATE board_members SET role = $1 WHERE board_id = $2 AND user_id = $3",
		input.Role, boardID, userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update role")
		return
	}
	if role == model.RoleTeamLead {
		h.db.Exec(r.Context(), "UPDATE teams SET lead_id = $1 WHERE id = $2", userID, boardID)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"board_id": boardID, "user_id": userID, "role": input.Role})
}

// RemoveFromBoard — remove a user from a specific board
func (h *AdminHandler) RemoveFromBoard(w http.ResponseWriter, r *http.Request) {
	userID, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	var input struct {
		BoardID string `json:"board_id"`
	}
	if err := decodeJSON(r, &input); err != nil || input.BoardID == "" {
		respondError(w, http.StatusBadRequest, "board_id is required")
		return
	}
	_, err = h.db.Exec(r.Context(), "DELETE FROM board_members WHERE board_id = $1 AND user_id = $2", input.BoardID, userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to remove from board")
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"removed": true})
}

// GetUserBoards — returns all boards a user belongs to
func (h *AdminHandler) GetUserBoards(w http.ResponseWriter, r *http.Request) {
	userID, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	rows, err := h.db.Query(r.Context(), `
		SELECT t.id, t.name, t.office, bm.role
		FROM board_members bm
		INNER JOIN teams t ON bm.board_id = t.id
		WHERE bm.user_id = $1
		ORDER BY t.name
	`, userID)
	if err != nil {
		respondJSON(w, http.StatusOK, []interface{}{})
		return
	}
	defer rows.Close()

	type boardInfo struct {
		ID     string `json:"id"`
		Name   string `json:"name"`
		Office *string `json:"office"`
		Role   string `json:"role"`
	}
	var boards []boardInfo
	for rows.Next() {
		var b boardInfo
		rows.Scan(&b.ID, &b.Name, &b.Office, &b.Role)
		boards = append(boards, b)
	}
	if boards == nil {
		boards = []boardInfo{}
	}
	respondJSON(w, http.StatusOK, boards)
}

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
