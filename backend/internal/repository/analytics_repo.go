package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AnalyticsRepository struct {
	db *pgxpool.Pool
}

func NewAnalyticsRepository(db *pgxpool.Pool) *AnalyticsRepository {
	return &AnalyticsRepository{db: db}
}

// ----- Live task aggregates -----

type TaskAggregate struct {
	Total       int
	Backlog     int
	ToDo        int
	InProgress  int
	InReview    int
	Done        int
	Overdue     int
	DoneLast7d  int
	DoneLast30d int
}

// AggregateTasks rolls up the current task landscape, optionally scoped to a region.
// Passing nil region_id = all regions.
func (r *AnalyticsRepository) AggregateTasks(ctx context.Context, regionID *uuid.UUID) (TaskAggregate, error) {
	var agg TaskAggregate
	// Join tasks → teams to scope by region. Exclude soft-deleted tasks.
	err := r.db.QueryRow(ctx, `
		SELECT
		  COUNT(*) AS total,
		  COUNT(*) FILTER (WHERE t.status = 'backlog')     AS backlog,
		  COUNT(*) FILTER (WHERE t.status = 'to_do')       AS to_do,
		  COUNT(*) FILTER (WHERE t.status = 'in_progress') AS in_progress,
		  COUNT(*) FILTER (WHERE t.status = 'in_review')   AS in_review,
		  COUNT(*) FILTER (WHERE t.status = 'done')        AS done,
		  COUNT(*) FILTER (WHERE t.deadline < CURRENT_DATE AND t.status <> 'done') AS overdue,
		  COUNT(*) FILTER (WHERE t.status = 'done' AND t.updated_at > NOW() - INTERVAL '7 days')  AS done_7d,
		  COUNT(*) FILTER (WHERE t.status = 'done' AND t.updated_at > NOW() - INTERVAL '30 days') AS done_30d
		FROM tasks t
		LEFT JOIN teams tm ON t.team_id = tm.id
		WHERE t.deleted_at IS NULL
		  AND ($1::uuid IS NULL OR tm.region_id = $1)
	`, regionID).Scan(
		&agg.Total, &agg.Backlog, &agg.ToDo, &agg.InProgress, &agg.InReview,
		&agg.Done, &agg.Overdue, &agg.DoneLast7d, &agg.DoneLast30d,
	)
	return agg, err
}

// ActiveUserCount — users belonging to a region (or all).
func (r *AnalyticsRepository) ActiveUserCount(ctx context.Context, regionID *uuid.UUID) (int, error) {
	var n int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM users
		WHERE is_active = true AND approved = true
		  AND ($1::uuid IS NULL OR region_id = $1)
	`, regionID).Scan(&n)
	return n, err
}

// ----- Cycle time -----

// CycleTimeAvgDays returns the average cycle time (first→done) for tasks that moved
// to 'done' within the last `days` days. Falls back to updated_at-created_at for
// tasks without changelog evidence.
func (r *AnalyticsRepository) CycleTimeAvgDays(ctx context.Context, regionID *uuid.UUID, days int) (float64, error) {
	var avg *float64
	err := r.db.QueryRow(ctx, `
		WITH done_tasks AS (
		  SELECT t.id, t.created_at, t.updated_at, t.team_id
		  FROM tasks t
		  LEFT JOIN teams tm ON t.team_id = tm.id
		  WHERE t.status = 'done'
		    AND t.deleted_at IS NULL
		    AND t.updated_at > NOW() - make_interval(days => $2)
		    AND ($1::uuid IS NULL OR tm.region_id = $1)
		),
		started AS (
		  SELECT dt.id, MIN(cl.changed_at) AS started_at
		  FROM done_tasks dt
		  LEFT JOIN command_changelog cl
		    ON cl.entity_type = 'task' AND cl.entity_id = dt.id
		    AND cl.action = 'status_changed'
		    AND cl.new_value IN ('in_progress', 'to_do')
		  GROUP BY dt.id
		),
		done_at AS (
		  SELECT dt.id, MAX(cl.changed_at) AS done_at
		  FROM done_tasks dt
		  LEFT JOIN command_changelog cl
		    ON cl.entity_type = 'task' AND cl.entity_id = dt.id
		    AND cl.action = 'status_changed'
		    AND cl.new_value = 'done'
		  GROUP BY dt.id
		)
		SELECT AVG(
		  EXTRACT(EPOCH FROM (
		    COALESCE(d.done_at, dt.updated_at) - COALESCE(s.started_at, dt.created_at)
		  )) / 86400.0
		)
		FROM done_tasks dt
		LEFT JOIN started s ON s.id = dt.id
		LEFT JOIN done_at d ON d.id = dt.id
	`, regionID, days).Scan(&avg)
	if err != nil {
		return 0, err
	}
	if avg == nil {
		return 0, nil
	}
	return *avg, nil
}

// ----- Snapshots (read) -----

type DailySnapshot struct {
	Date             time.Time
	Total            int
	Done             int
	Overdue          int
	InProgress       int
	InReview         int
	Backlog          int
	ToDo             int
	DoneInDay        int
	CycleAvg         *float64
	ActiveUsers      int
}

// GetSnapshots returns daily snapshots for the given region and date range, sorted ASC.
// Missing days return nothing (caller fills gaps).
func (r *AnalyticsRepository) GetSnapshots(ctx context.Context, regionID *uuid.UUID, fromDate, toDate time.Time) ([]DailySnapshot, error) {
	rows, err := r.db.Query(ctx, `
		SELECT snapshot_date, total_tasks, done_tasks, overdue_tasks,
		       in_progress_tasks, in_review_tasks, backlog_tasks, to_do_tasks,
		       done_in_day, cycle_time_avg_days, active_users
		FROM command_daily_snapshots
		WHERE snapshot_date BETWEEN $2 AND $3
		  AND (($1::uuid IS NULL AND region_id IS NULL) OR region_id = $1)
		ORDER BY snapshot_date ASC
	`, regionID, fromDate, toDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []DailySnapshot
	for rows.Next() {
		var s DailySnapshot
		if err := rows.Scan(&s.Date, &s.Total, &s.Done, &s.Overdue, &s.InProgress,
			&s.InReview, &s.Backlog, &s.ToDo, &s.DoneInDay, &s.CycleAvg, &s.ActiveUsers); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// ----- Snapshots (write) -----

// UpsertSnapshot writes or overwrites the snapshot row for (date, region).
// Uses delete+insert for atomic replacement (two partial unique indexes — ON CONFLICT
// needs a concrete index target and NULLs break composite keys).
func (r *AnalyticsRepository) UpsertSnapshot(ctx context.Context, s DailySnapshot, regionID *uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if regionID == nil {
		_, err = tx.Exec(ctx, `DELETE FROM command_daily_snapshots WHERE snapshot_date = $1 AND region_id IS NULL`, s.Date)
	} else {
		_, err = tx.Exec(ctx, `DELETE FROM command_daily_snapshots WHERE snapshot_date = $1 AND region_id = $2`, s.Date, regionID)
	}
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO command_daily_snapshots
		  (snapshot_date, region_id, total_tasks, done_tasks, overdue_tasks,
		   in_progress_tasks, in_review_tasks, backlog_tasks, to_do_tasks,
		   done_in_day, cycle_time_avg_days, active_users)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`, s.Date, regionID, s.Total, s.Done, s.Overdue, s.InProgress, s.InReview,
		s.Backlog, s.ToDo, s.DoneInDay, s.CycleAvg, s.ActiveUsers)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ----- Historical daily counts (for first snapshot backfill via changelog) -----

// DoneCountByDay reconstructs per-day "done" transitions from changelog for the
// past `days` days. Used when snapshots don't exist yet.
func (r *AnalyticsRepository) DoneCountByDay(ctx context.Context, regionID *uuid.UUID, days int) (map[string]int, error) {
	rows, err := r.db.Query(ctx, `
		SELECT date(cl.changed_at) AS d, COUNT(*)
		FROM command_changelog cl
		JOIN tasks t ON t.id = cl.entity_id AND cl.entity_type = 'task'
		LEFT JOIN teams tm ON t.team_id = tm.id
		WHERE cl.action = 'status_changed'
		  AND cl.new_value = 'done'
		  AND cl.changed_at > NOW() - make_interval(days => $2)
		  AND ($1::uuid IS NULL OR tm.region_id = $1)
		GROUP BY date(cl.changed_at)
		ORDER BY d
	`, regionID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int{}
	for rows.Next() {
		var d time.Time
		var n int
		if err := rows.Scan(&d, &n); err != nil {
			return nil, err
		}
		out[d.Format("2006-01-02")] = n
	}
	return out, rows.Err()
}

// ----- Office rollup (current state only) -----

type OfficeRow struct {
	Office      string
	Total       int
	Done        int
	InProgress  int
	InReview    int
	ToDo        int
	Backlog     int
	Overdue     int
	PeopleCount int
}

func (r *AnalyticsRepository) OfficeRollup(ctx context.Context, regionID *uuid.UUID) ([]OfficeRow, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
		  tm.office,
		  COUNT(t.*) FILTER (WHERE t.deleted_at IS NULL) AS total,
		  COUNT(*) FILTER (WHERE t.status = 'done' AND t.deleted_at IS NULL)        AS done,
		  COUNT(*) FILTER (WHERE t.status = 'in_progress' AND t.deleted_at IS NULL) AS in_progress,
		  COUNT(*) FILTER (WHERE t.status = 'in_review' AND t.deleted_at IS NULL)   AS in_review,
		  COUNT(*) FILTER (WHERE t.status = 'to_do' AND t.deleted_at IS NULL)       AS to_do,
		  COUNT(*) FILTER (WHERE t.status = 'backlog' AND t.deleted_at IS NULL)     AS backlog,
		  COUNT(*) FILTER (WHERE t.deadline < CURRENT_DATE AND t.status <> 'done' AND t.deleted_at IS NULL) AS overdue,
		  COALESCE(
		    (SELECT COUNT(DISTINCT bm.user_id)
		     FROM board_members bm
		     JOIN teams t2 ON t2.id = bm.board_id
		     WHERE t2.office = tm.office
		       AND ($1::uuid IS NULL OR t2.region_id = $1)), 0
		  ) AS people_count
		FROM teams tm
		LEFT JOIN tasks t ON t.team_id = tm.id
		WHERE tm.office IS NOT NULL AND tm.office <> ''
		  AND ($1::uuid IS NULL OR tm.region_id = $1)
		GROUP BY tm.office
		ORDER BY total DESC NULLS LAST
	`, regionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []OfficeRow
	for rows.Next() {
		var o OfficeRow
		if err := rows.Scan(&o.Office, &o.Total, &o.Done, &o.InProgress, &o.InReview,
			&o.ToDo, &o.Backlog, &o.Overdue, &o.PeopleCount); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

// ----- People risk -----

type PersonWorkload struct {
	ID         uuid.UUID
	Name       string
	TeamID     *uuid.UUID
	TeamName   *string
	Workload   int // open tasks
	Overdue    int
	Criticals  int
}

func (r *AnalyticsRepository) PeopleWorkload(ctx context.Context, regionID *uuid.UUID) ([]PersonWorkload, error) {
	rows, err := r.db.Query(ctx, `
		SELECT u.id, u.full_name, u.team_id, tm.name,
		       COUNT(t.*) FILTER (WHERE t.status NOT IN ('done','closed') AND t.deleted_at IS NULL) AS workload,
		       COUNT(t.*) FILTER (WHERE t.deadline < CURRENT_DATE AND t.status NOT IN ('done','closed') AND t.deleted_at IS NULL) AS overdue,
		       COUNT(t.*) FILTER (WHERE t.priority = 'critical' AND t.status NOT IN ('done','closed') AND t.deleted_at IS NULL) AS criticals
		FROM users u
		LEFT JOIN tasks t ON t.assignee_id = u.id
		LEFT JOIN teams tm ON u.team_id = tm.id
		WHERE u.is_active = true AND u.approved = true
		  AND ($1::uuid IS NULL OR u.region_id = $1)
		GROUP BY u.id, u.full_name, u.team_id, tm.name
		HAVING COUNT(t.*) FILTER (WHERE t.status NOT IN ('done','closed') AND t.deleted_at IS NULL) > 0
		ORDER BY workload DESC
	`, regionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []PersonWorkload
	for rows.Next() {
		var p PersonWorkload
		if err := rows.Scan(&p.ID, &p.Name, &p.TeamID, &p.TeamName,
			&p.Workload, &p.Overdue, &p.Criticals); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

type TeamBusFactor struct {
	TeamID    uuid.UUID
	TeamName  string
	Office    *string
	Bus       int
	TopShare  int // percent
	TopPerson *string
}

func (r *AnalyticsRepository) BusFactor(ctx context.Context, regionID *uuid.UUID) ([]TeamBusFactor, error) {
	// For each team, find the person holding the largest share of open tasks.
	rows, err := r.db.Query(ctx, `
		WITH team_tasks AS (
		  SELECT t.team_id, t.assignee_id, COUNT(*) AS n
		  FROM tasks t
		  WHERE t.deleted_at IS NULL AND t.status NOT IN ('done','closed')
		    AND t.team_id IS NOT NULL AND t.assignee_id IS NOT NULL
		  GROUP BY t.team_id, t.assignee_id
		),
		team_totals AS (
		  SELECT team_id, SUM(n) AS total, COUNT(DISTINCT assignee_id) AS active_assignees
		  FROM team_tasks GROUP BY team_id
		),
		top_by_team AS (
		  SELECT DISTINCT ON (tt.team_id) tt.team_id, tt.assignee_id, tt.n
		  FROM team_tasks tt
		  ORDER BY tt.team_id, tt.n DESC
		)
		SELECT tm.id, tm.name, tm.office,
		       COALESCE(tt.total, 0),
		       COALESCE(tt.active_assignees, 0),
		       COALESCE(top.n, 0),
		       u.full_name
		FROM teams tm
		LEFT JOIN team_totals tt ON tt.team_id = tm.id
		LEFT JOIN top_by_team top ON top.team_id = tm.id
		LEFT JOIN users u ON u.id = top.assignee_id
		WHERE tm.is_active = true
		  AND ($1::uuid IS NULL OR tm.region_id = $1)
	`, regionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []TeamBusFactor
	for rows.Next() {
		var t struct {
			ID       uuid.UUID
			Name     string
			Office   *string
			Total    int
			Active   int
			TopN     int
			TopName  *string
		}
		if err := rows.Scan(&t.ID, &t.Name, &t.Office, &t.Total, &t.Active, &t.TopN, &t.TopName); err != nil {
			return nil, err
		}
		share := 0
		if t.Total > 0 {
			share = t.TopN * 100 / t.Total
		}
		bus := t.Active
		if share >= 60 {
			bus = 1
		} else if share >= 40 {
			bus = 2
		}
		// Skip teams with no open work — bus factor is meaningless
		if t.Total == 0 {
			continue
		}
		out = append(out, TeamBusFactor{
			TeamID:    t.ID,
			TeamName:  t.Name,
			Office:    t.Office,
			Bus:       bus,
			TopShare:  share,
			TopPerson: t.TopName,
		})
	}
	return out, rows.Err()
}

// ----- Risk candidates -----

type RiskCandidate struct {
	ID               uuid.UUID
	Title            string
	Status           string
	Priority         string
	Progress         int
	Deadline         *time.Time
	CreatedAt        time.Time
	LastStatusChange *time.Time
	AgeDays          int
	Office           *string
	TeamName         *string
	AssigneeID       *uuid.UUID
	AssigneeName     *string
}

// RiskCandidates returns all open (non-done/closed) tasks with the fields needed
// by the risk scoring engine. Last-status-change comes from command_changelog.
func (r *AnalyticsRepository) RiskCandidates(ctx context.Context, regionID *uuid.UUID) ([]RiskCandidate, error) {
	rows, err := r.db.Query(ctx, `
		SELECT t.id, t.title, t.status, t.priority, COALESCE(t.progress, 0),
		       t.deadline, t.created_at,
		       (SELECT MAX(cl.changed_at) FROM command_changelog cl
		         WHERE cl.entity_type = 'task' AND cl.entity_id = t.id
		           AND cl.action = 'status_changed') AS last_status_change,
		       GREATEST(0, EXTRACT(DAY FROM (NOW() - t.created_at))::int) AS age_days,
		       tm.office, tm.name, t.assignee_id, u.full_name
		FROM tasks t
		LEFT JOIN teams tm ON t.team_id = tm.id
		LEFT JOIN users u ON t.assignee_id = u.id
		WHERE t.deleted_at IS NULL
		  AND t.status NOT IN ('done', 'closed')
		  AND ($1::uuid IS NULL OR tm.region_id = $1)
	`, regionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []RiskCandidate
	for rows.Next() {
		var c RiskCandidate
		if err := rows.Scan(&c.ID, &c.Title, &c.Status, &c.Priority, &c.Progress,
			&c.Deadline, &c.CreatedAt, &c.LastStatusChange, &c.AgeDays,
			&c.Office, &c.TeamName, &c.AssigneeID, &c.AssigneeName); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// ----- Drill-down queries -----

type DrillTask struct {
	ID        uuid.UUID
	Title     string
	Status    string
	Priority  string
	Deadline  *time.Time
	StoryID   uuid.UUID
	TeamID    *uuid.UUID
	TeamName  *string
	Office    *string
	Assignee  *string
	AssigneeID *uuid.UUID
}

func (r *AnalyticsRepository) DrillTasks(ctx context.Context, regionID *uuid.UUID, kpi string, limit int) ([]DrillTask, error) {
	where := `t.deleted_at IS NULL AND ($1::uuid IS NULL OR tm.region_id = $1)`
	switch kpi {
	case "completion", "velocity":
		where += ` AND t.status = 'done'`
	case "cycle":
		where += ` AND t.status = 'in_progress'`
	case "overdue":
		where += ` AND t.deadline < CURRENT_DATE AND t.status <> 'done'`
	case "utilization":
		where += ` AND t.status IN ('in_progress', 'in_review')`
	default:
		return nil, nil
	}
	rows, err := r.db.Query(ctx, `
		SELECT t.id, t.title, t.status, t.priority, t.deadline, t.story_id,
		       t.team_id, tm.name, tm.office,
		       u.full_name, t.assignee_id
		FROM tasks t
		LEFT JOIN teams tm ON t.team_id = tm.id
		LEFT JOIN users u ON t.assignee_id = u.id
		WHERE `+where+`
		ORDER BY t.updated_at DESC
		LIMIT $2
	`, regionID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DrillTask
	for rows.Next() {
		var d DrillTask
		if err := rows.Scan(&d.ID, &d.Title, &d.Status, &d.Priority, &d.Deadline,
			&d.StoryID, &d.TeamID, &d.TeamName, &d.Office, &d.Assignee, &d.AssigneeID); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
