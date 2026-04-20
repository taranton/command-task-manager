package handler

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/qrt/command/internal/middleware"
	"github.com/qrt/command/internal/model"
)

type BoardsOverviewHandler struct {
	db *pgxpool.Pool
}

func NewBoardsOverviewHandler(db *pgxpool.Pool) *BoardsOverviewHandler {
	return &BoardsOverviewHandler{db: db}
}

type boardOverviewRow struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Description     *string   `json:"description"`
	Office          *string   `json:"office"`
	RegionID        *string   `json:"region_id"`
	RegionCode      *string   `json:"region_code"`
	RegionName      *string   `json:"region_name"`
	MyRole          *string   `json:"my_role"`       // role of current user on this board (null = C-Level viewing someone else's)
	MemberCount     int       `json:"member_count"`
	StoriesCount    int       `json:"stories_count"`
	TasksCount      int       `json:"tasks_count"`
	DoneTasksCount  int       `json:"done_tasks_count"`
	OverdueCount    int       `json:"overdue_count"`
	ProgressPct     int       `json:"progress_pct"`
	LastActivityAt  *time.Time `json:"last_activity_at"`
	MembersPreview  []string  `json:"members_preview"` // up to 4 member initials/names
	IsActive        bool      `json:"is_active"`
}

// List returns the per-board overview visible to the caller. Visibility rules:
//
//	• C-Level → every active board
//	• Anyone else → only boards the user belongs to via board_members
//
// MyRole reflects the caller's role on each board (null for C-Level viewing
// boards they aren't a member of).
func (h *BoardsOverviewHandler) List(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r.Context())
	role := middleware.GetUserRole(r.Context())
	isCLevel := model.Role(role) == model.RoleCLevel

	// Base SQL — fetches all stats via subqueries so we stay in one round-trip.
	// WHERE clause toggles between "everything" (C-Level) and "my boards".
	rows, err := h.db.Query(r.Context(), `
		SELECT
		  t.id, t.name, t.description, t.office, t.region_id, t.is_active,
		  r.code, r.name AS region_name,
		  (SELECT role FROM board_members WHERE board_id = t.id AND user_id = $1) AS my_role,
		  (SELECT COUNT(*) FROM board_members WHERE board_id = t.id) AS member_count,
		  (SELECT COUNT(*) FROM stories s WHERE s.team_id = t.id AND s.deleted_at IS NULL AND s.archived_at IS NULL) AS stories_count,
		  (SELECT COUNT(*) FROM tasks ta WHERE ta.team_id = t.id AND ta.deleted_at IS NULL) AS tasks_count,
		  (SELECT COUNT(*) FROM tasks ta WHERE ta.team_id = t.id AND ta.deleted_at IS NULL AND ta.status = 'done') AS done_tasks_count,
		  (SELECT COUNT(*) FROM tasks ta WHERE ta.team_id = t.id AND ta.deleted_at IS NULL AND ta.deadline < CURRENT_DATE AND ta.status <> 'done') AS overdue_count,
		  (SELECT MAX(cl.changed_at) FROM command_changelog cl
		     WHERE (cl.entity_type = 'task' AND cl.entity_id IN (SELECT id FROM tasks WHERE team_id = t.id))
		        OR (cl.entity_type = 'story' AND cl.entity_id IN (SELECT id FROM stories WHERE team_id = t.id))
		  ) AS last_activity,
		  (SELECT COALESCE(array_agg(u.full_name ORDER BY bm.joined_at), ARRAY[]::text[])
		   FROM (SELECT user_id, joined_at FROM board_members WHERE board_id = t.id ORDER BY joined_at LIMIT 4) bm
		   JOIN users u ON u.id = bm.user_id) AS members_preview
		FROM teams t
		LEFT JOIN regions r ON r.id = t.region_id
		WHERE t.is_active = true
		  AND ($2::boolean OR EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = t.id AND bm.user_id = $1))
		ORDER BY t.name
	`, uid, isCLevel)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	out := make([]boardOverviewRow, 0)
	for rows.Next() {
		var row boardOverviewRow
		var id uuid.UUID
		var regID *uuid.UUID
		if err := rows.Scan(
			&id, &row.Name, &row.Description, &row.Office, &regID, &row.IsActive,
			&row.RegionCode, &row.RegionName, &row.MyRole, &row.MemberCount,
			&row.StoriesCount, &row.TasksCount, &row.DoneTasksCount, &row.OverdueCount,
			&row.LastActivityAt, &row.MembersPreview,
		); err != nil {
			continue
		}
		row.ID = id.String()
		if regID != nil {
			s := regID.String()
			row.RegionID = &s
		}
		if row.TasksCount > 0 {
			row.ProgressPct = int(float64(row.DoneTasksCount) / float64(row.TasksCount) * 100)
		}
		out = append(out, row)
	}
	respondJSON(w, http.StatusOK, out)
}
