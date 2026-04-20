package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type EntitiesRepository struct {
	db *pgxpool.Pool
}

func NewEntitiesRepository(db *pgxpool.Pool) *EntitiesRepository {
	return &EntitiesRepository{db: db}
}

// ========================================================================
// RELEASES
// ========================================================================

type Release struct {
	ID          uuid.UUID
	Date        time.Time
	Label       string
	Type        string
	RegionID    *uuid.UUID
	Office      *string
	Description *string
	CreatedBy   *uuid.UUID
	CreatedAt   time.Time
	StoryIDs    []uuid.UUID
}

func (r *EntitiesRepository) ListReleases(ctx context.Context, regionID *uuid.UUID) ([]Release, error) {
	rows, err := r.db.Query(ctx, `
		SELECT r.id, r.release_date, r.label, r.release_type, r.region_id, r.office,
		       r.description, r.created_by, r.created_at,
		       COALESCE(
		         (SELECT array_agg(story_id) FROM command_release_stories rs WHERE rs.release_id = r.id),
		         ARRAY[]::uuid[]
		       ) AS story_ids
		FROM command_releases r
		WHERE ($1::uuid IS NULL OR r.region_id = $1 OR r.region_id IS NULL)
		ORDER BY r.release_date ASC
	`, regionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Release
	for rows.Next() {
		var rel Release
		if err := rows.Scan(&rel.ID, &rel.Date, &rel.Label, &rel.Type, &rel.RegionID,
			&rel.Office, &rel.Description, &rel.CreatedBy, &rel.CreatedAt, &rel.StoryIDs); err != nil {
			return nil, err
		}
		out = append(out, rel)
	}
	return out, rows.Err()
}

type CreateReleaseInput struct {
	Date        time.Time
	Label       string
	Type        string
	RegionID    *uuid.UUID
	Office      *string
	Description *string
	StoryIDs    []uuid.UUID
	CreatedBy   uuid.UUID
}

func (r *EntitiesRepository) CreateRelease(ctx context.Context, in CreateReleaseInput) (*Release, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var id uuid.UUID
	var createdAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO command_releases (release_date, label, release_type, region_id, office, description, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at
	`, in.Date, in.Label, in.Type, in.RegionID, in.Office, in.Description, in.CreatedBy).Scan(&id, &createdAt)
	if err != nil {
		return nil, err
	}

	for _, sid := range in.StoryIDs {
		_, err = tx.Exec(ctx, `INSERT INTO command_release_stories (release_id, story_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, sid)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &Release{
		ID: id, Date: in.Date, Label: in.Label, Type: in.Type,
		RegionID: in.RegionID, Office: in.Office, Description: in.Description,
		CreatedBy: &in.CreatedBy, CreatedAt: createdAt, StoryIDs: in.StoryIDs,
	}, nil
}

func (r *EntitiesRepository) DeleteRelease(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM command_releases WHERE id = $1`, id)
	return err
}

// ========================================================================
// STORY DEPENDENCIES
// ========================================================================

type StoryDep struct {
	ID        uuid.UUID
	FromStory uuid.UUID
	ToStory   uuid.UUID
	ToTask    *uuid.UUID // optional: specific task within to_story that must finish first
	Reason    *string
	CreatedAt time.Time
}

// ListDeps returns dependencies, optionally scoped to stories within a region.
func (r *EntitiesRepository) ListDeps(ctx context.Context, regionID *uuid.UUID) ([]StoryDep, error) {
	rows, err := r.db.Query(ctx, `
		SELECT d.id, d.from_story, d.to_story, d.to_task, d.reason, d.created_at
		FROM command_story_deps d
		JOIN stories sf ON sf.id = d.from_story
		JOIN stories st ON st.id = d.to_story
		LEFT JOIN teams tf ON sf.team_id = tf.id
		LEFT JOIN teams tt ON st.team_id = tt.id
		WHERE ($1::uuid IS NULL OR tf.region_id = $1 OR tt.region_id = $1)
		ORDER BY d.created_at DESC
	`, regionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []StoryDep
	for rows.Next() {
		var d StoryDep
		if err := rows.Scan(&d.ID, &d.FromStory, &d.ToStory, &d.ToTask, &d.Reason, &d.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *EntitiesRepository) CreateDep(ctx context.Context, from, to uuid.UUID, toTask *uuid.UUID, reason *string, createdBy uuid.UUID) (*StoryDep, error) {
	var id uuid.UUID
	var createdAt time.Time
	err := r.db.QueryRow(ctx, `
		INSERT INTO command_story_deps (from_story, to_story, to_task, reason, created_by)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (from_story, to_story) DO UPDATE SET reason = EXCLUDED.reason, to_task = EXCLUDED.to_task
		RETURNING id, created_at
	`, from, to, toTask, reason, createdBy).Scan(&id, &createdAt)
	if err != nil {
		return nil, err
	}
	return &StoryDep{ID: id, FromStory: from, ToStory: to, ToTask: toTask, Reason: reason, CreatedAt: createdAt}, nil
}

// AutoResolveForTask — called when a task moves to 'done'. Removes all story deps
// pointing to this task. Returns the count affected (for logging/broadcast).
func (r *EntitiesRepository) AutoResolveDepsForTask(ctx context.Context, taskID uuid.UUID) (int64, error) {
	cmd, err := r.db.Exec(ctx, `DELETE FROM command_story_deps WHERE to_task = $1`, taskID)
	if err != nil {
		return 0, err
	}
	return cmd.RowsAffected(), nil
}

// AutoResolveBlockersForTask — when a task completes, mark any unresolved blocker
// that references it as resolved.
func (r *EntitiesRepository) AutoResolveBlockersForTask(ctx context.Context, taskID uuid.UUID) (int64, error) {
	cmd, err := r.db.Exec(ctx, `
		UPDATE command_external_blockers SET resolved_at = NOW()
		WHERE blocking_task_id = $1 AND resolved_at IS NULL
	`, taskID)
	if err != nil {
		return 0, err
	}
	return cmd.RowsAffected(), nil
}

func (r *EntitiesRepository) DeleteDep(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM command_story_deps WHERE id = $1`, id)
	return err
}

// ========================================================================
// EXTERNAL BLOCKERS
// ========================================================================

type ExternalBlocker struct {
	ID              uuid.UUID
	StoryID         uuid.UUID
	BlockingTaskID  *uuid.UUID // optional: internal task blocking this story
	Description     string     // free text (required for external, optional comment for internal)
	Severity        string
	SinceDate       time.Time
	ResolvedAt      *time.Time
	CreatedAt       time.Time
}

func (r *EntitiesRepository) ListBlockers(ctx context.Context, regionID *uuid.UUID, onlyUnresolved bool) ([]ExternalBlocker, error) {
	where := `($1::uuid IS NULL OR tm.region_id = $1)`
	if onlyUnresolved {
		where += ` AND b.resolved_at IS NULL`
	}
	rows, err := r.db.Query(ctx, `
		SELECT b.id, b.story_id, b.blocking_task_id, b.blocker_description, b.severity, b.since_date,
		       b.resolved_at, b.created_at
		FROM command_external_blockers b
		JOIN stories s ON s.id = b.story_id
		LEFT JOIN teams tm ON s.team_id = tm.id
		WHERE `+where+`
		ORDER BY b.since_date ASC
	`, regionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ExternalBlocker
	for rows.Next() {
		var b ExternalBlocker
		if err := rows.Scan(&b.ID, &b.StoryID, &b.BlockingTaskID, &b.Description, &b.Severity,
			&b.SinceDate, &b.ResolvedAt, &b.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (r *EntitiesRepository) CreateBlocker(ctx context.Context, storyID uuid.UUID, blockingTaskID *uuid.UUID, description, severity string, since time.Time, createdBy uuid.UUID) (*ExternalBlocker, error) {
	var id uuid.UUID
	var createdAt time.Time
	err := r.db.QueryRow(ctx, `
		INSERT INTO command_external_blockers (story_id, blocking_task_id, blocker_description, severity, since_date, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`, storyID, blockingTaskID, description, severity, since, createdBy).Scan(&id, &createdAt)
	if err != nil {
		return nil, err
	}
	return &ExternalBlocker{
		ID: id, StoryID: storyID, BlockingTaskID: blockingTaskID, Description: description, Severity: severity,
		SinceDate: since, CreatedAt: createdAt,
	}, nil
}

func (r *EntitiesRepository) ResolveBlocker(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE command_external_blockers SET resolved_at = NOW() WHERE id = $1`, id)
	return err
}

func (r *EntitiesRepository) DeleteBlocker(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM command_external_blockers WHERE id = $1`, id)
	return err
}

// ========================================================================
// TIMELINE EVENTS
// ========================================================================

type TimelineEvent struct {
	ID          uuid.UUID
	Date        time.Time
	Kind        string
	Label       string
	AffectedKPIs []string
	RegionID    *uuid.UUID
	Description *string
	CreatedAt   time.Time
}

func (r *EntitiesRepository) ListEvents(ctx context.Context, regionID *uuid.UUID, fromDate, toDate time.Time) ([]TimelineEvent, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, event_date, kind, label, COALESCE(affected_kpis, '{}'), region_id, description, created_at
		FROM command_timeline_events
		WHERE event_date BETWEEN $2 AND $3
		  AND ($1::uuid IS NULL OR region_id = $1 OR region_id IS NULL)
		ORDER BY event_date ASC
	`, regionID, fromDate, toDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []TimelineEvent
	for rows.Next() {
		var e TimelineEvent
		if err := rows.Scan(&e.ID, &e.Date, &e.Kind, &e.Label, &e.AffectedKPIs,
			&e.RegionID, &e.Description, &e.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *EntitiesRepository) CreateEvent(ctx context.Context, date time.Time, kind, label string, affectedKPIs []string, regionID *uuid.UUID, description *string, createdBy uuid.UUID) (*TimelineEvent, error) {
	var id uuid.UUID
	var createdAt time.Time
	err := r.db.QueryRow(ctx, `
		INSERT INTO command_timeline_events (event_date, kind, label, affected_kpis, region_id, description, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at
	`, date, kind, label, affectedKPIs, regionID, description, createdBy).Scan(&id, &createdAt)
	if err != nil {
		return nil, err
	}
	return &TimelineEvent{
		ID: id, Date: date, Kind: kind, Label: label, AffectedKPIs: affectedKPIs,
		RegionID: regionID, Description: description, CreatedAt: createdAt,
	}, nil
}

func (r *EntitiesRepository) DeleteEvent(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM command_timeline_events WHERE id = $1`, id)
	return err
}
