package handler

import (
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/qrt/command/internal/middleware"
	"github.com/qrt/command/internal/repository"
)

type EntitiesHandler struct {
	repo *repository.EntitiesRepository
}

func NewEntitiesHandler(repo *repository.EntitiesRepository) *EntitiesHandler {
	return &EntitiesHandler{repo: repo}
}

// ---------- helpers ----------

func parseDate(s string) (time.Time, error) {
	return time.Parse("2006-01-02", s)
}

func userIDFromCtx(r *http.Request) (uuid.UUID, bool) {
	id := middleware.GetUserID(r.Context())
	if id == uuid.Nil {
		return id, false
	}
	return id, true
}

// ---------- Releases ----------

type releaseInput struct {
	ReleaseDate string   `json:"release_date"`
	Label       string   `json:"label"`
	Type        string   `json:"release_type"`
	RegionID    *string  `json:"region_id"`
	Office      *string  `json:"office"`
	Description *string  `json:"description"`
	StoryIDs    []string `json:"story_ids"`
}

type releaseOutput struct {
	ID          string   `json:"id"`
	ReleaseDate string   `json:"release_date"`
	Label       string   `json:"label"`
	Type        string   `json:"release_type"`
	RegionID    *string  `json:"region_id"`
	Office      *string  `json:"office"`
	Description *string  `json:"description"`
	StoryIDs    []string `json:"story_ids"`
}

func (h *EntitiesHandler) ListReleases(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.ListReleases(r.Context(), parseRegion(r))
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	out := make([]releaseOutput, 0, len(list))
	for _, rel := range list {
		storyIDs := make([]string, 0, len(rel.StoryIDs))
		for _, sid := range rel.StoryIDs {
			storyIDs = append(storyIDs, sid.String())
		}
		o := releaseOutput{
			ID:          rel.ID.String(),
			ReleaseDate: rel.Date.Format("2006-01-02"),
			Label:       rel.Label,
			Type:        rel.Type,
			Office:      rel.Office,
			Description: rel.Description,
			StoryIDs:    storyIDs,
		}
		if rel.RegionID != nil {
			s := rel.RegionID.String()
			o.RegionID = &s
		}
		out = append(out, o)
	}
	respondJSON(w, http.StatusOK, out)
}

func (h *EntitiesHandler) CreateRelease(w http.ResponseWriter, r *http.Request) {
	uid, ok := userIDFromCtx(r)
	if !ok {
		respondError(w, http.StatusUnauthorized, "auth required")
		return
	}
	var in releaseInput
	if err := decodeJSON(r, &in); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if in.Label == "" || in.ReleaseDate == "" {
		respondError(w, http.StatusBadRequest, "label and release_date required")
		return
	}
	date, err := parseDate(in.ReleaseDate)
	if err != nil {
		respondError(w, http.StatusBadRequest, "release_date must be YYYY-MM-DD")
		return
	}
	relType := in.Type
	if relType == "" {
		relType = "minor"
	}
	var regionID *uuid.UUID
	if in.RegionID != nil && *in.RegionID != "" {
		id, err := uuid.Parse(*in.RegionID)
		if err == nil {
			regionID = &id
		}
	}
	storyUUIDs := make([]uuid.UUID, 0, len(in.StoryIDs))
	for _, s := range in.StoryIDs {
		if id, err := uuid.Parse(s); err == nil {
			storyUUIDs = append(storyUUIDs, id)
		}
	}
	rel, err := h.repo.CreateRelease(r.Context(), repository.CreateReleaseInput{
		Date: date, Label: in.Label, Type: relType, RegionID: regionID,
		Office: in.Office, Description: in.Description, StoryIDs: storyUUIDs, CreatedBy: uid,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	storyIDs := make([]string, 0, len(rel.StoryIDs))
	for _, sid := range rel.StoryIDs {
		storyIDs = append(storyIDs, sid.String())
	}
	o := releaseOutput{
		ID:          rel.ID.String(),
		ReleaseDate: rel.Date.Format("2006-01-02"),
		Label:       rel.Label,
		Type:        rel.Type,
		Office:      rel.Office,
		Description: rel.Description,
		StoryIDs:    storyIDs,
	}
	if rel.RegionID != nil {
		s := rel.RegionID.String()
		o.RegionID = &s
	}
	respondJSON(w, http.StatusCreated, o)
}

func (h *EntitiesHandler) DeleteRelease(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.repo.DeleteRelease(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusNoContent, nil)
}

// ---------- Dependencies ----------

type depInput struct {
	FromStory string  `json:"from_story"`
	ToStory   string  `json:"to_story"`
	ToTask    *string `json:"to_task,omitempty"`
	Reason    *string `json:"reason"`
}

type depOutput struct {
	ID        string  `json:"id"`
	FromStory string  `json:"from_story"`
	ToStory   string  `json:"to_story"`
	ToTask    *string `json:"to_task"`
	Reason    *string `json:"reason"`
}

func (h *EntitiesHandler) ListDeps(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.ListDeps(r.Context(), parseRegion(r))
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	out := make([]depOutput, 0, len(list))
	for _, d := range list {
		o := depOutput{
			ID: d.ID.String(), FromStory: d.FromStory.String(), ToStory: d.ToStory.String(), Reason: d.Reason,
		}
		if d.ToTask != nil {
			s := d.ToTask.String()
			o.ToTask = &s
		}
		out = append(out, o)
	}
	respondJSON(w, http.StatusOK, out)
}

func (h *EntitiesHandler) CreateDep(w http.ResponseWriter, r *http.Request) {
	uid, ok := userIDFromCtx(r)
	if !ok {
		respondError(w, http.StatusUnauthorized, "auth required")
		return
	}
	var in depInput
	if err := decodeJSON(r, &in); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	from, err := uuid.Parse(in.FromStory)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid from_story")
		return
	}
	to, err := uuid.Parse(in.ToStory)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid to_story")
		return
	}
	if from == to {
		respondError(w, http.StatusBadRequest, "from_story and to_story must differ")
		return
	}
	var toTask *uuid.UUID
	if in.ToTask != nil && *in.ToTask != "" {
		id, err := uuid.Parse(*in.ToTask)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid to_task")
			return
		}
		toTask = &id
	}
	d, err := h.repo.CreateDep(r.Context(), from, to, toTask, in.Reason, uid)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	o := depOutput{
		ID: d.ID.String(), FromStory: d.FromStory.String(), ToStory: d.ToStory.String(), Reason: d.Reason,
	}
	if d.ToTask != nil {
		s := d.ToTask.String()
		o.ToTask = &s
	}
	respondJSON(w, http.StatusCreated, o)
}

func (h *EntitiesHandler) DeleteDep(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.repo.DeleteDep(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusNoContent, nil)
}

// ---------- External blockers ----------

type blockerInput struct {
	StoryID        string  `json:"story_id"`
	BlockingTaskID *string `json:"blocking_task_id,omitempty"`
	Description    string  `json:"blocker_description"`
	Severity       string  `json:"severity"`
	SinceDate      string  `json:"since_date"`
}

type blockerOutput struct {
	ID             string  `json:"id"`
	StoryID        string  `json:"story_id"`
	BlockingTaskID *string `json:"blocking_task_id"`
	Description    string  `json:"blocker_description"`
	Severity       string  `json:"severity"`
	SinceDate      string  `json:"since_date"`
	ResolvedAt     *string `json:"resolved_at"`
}

func (h *EntitiesHandler) ListBlockers(w http.ResponseWriter, r *http.Request) {
	onlyUnresolved := r.URL.Query().Get("unresolved") != "false"
	list, err := h.repo.ListBlockers(r.Context(), parseRegion(r), onlyUnresolved)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	out := make([]blockerOutput, 0, len(list))
	for _, b := range list {
		o := blockerOutput{
			ID: b.ID.String(), StoryID: b.StoryID.String(),
			Description: b.Description, Severity: b.Severity,
			SinceDate: b.SinceDate.Format("2006-01-02"),
		}
		if b.BlockingTaskID != nil {
			s := b.BlockingTaskID.String()
			o.BlockingTaskID = &s
		}
		if b.ResolvedAt != nil {
			ts := b.ResolvedAt.Format(time.RFC3339)
			o.ResolvedAt = &ts
		}
		out = append(out, o)
	}
	respondJSON(w, http.StatusOK, out)
}

func (h *EntitiesHandler) CreateBlocker(w http.ResponseWriter, r *http.Request) {
	uid, ok := userIDFromCtx(r)
	if !ok {
		respondError(w, http.StatusUnauthorized, "auth required")
		return
	}
	var in blockerInput
	if err := decodeJSON(r, &in); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	sid, err := uuid.Parse(in.StoryID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid story_id")
		return
	}
	var blockingTaskID *uuid.UUID
	if in.BlockingTaskID != nil && *in.BlockingTaskID != "" {
		id, err := uuid.Parse(*in.BlockingTaskID)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid blocking_task_id")
			return
		}
		blockingTaskID = &id
	}
	// Either a description (external) or a blocking_task (internal) is required.
	if in.Description == "" && blockingTaskID == nil {
		respondError(w, http.StatusBadRequest, "provide blocker_description or blocking_task_id")
		return
	}
	sev := in.Severity
	if sev == "" {
		sev = "high"
	}
	since := time.Now().UTC().Truncate(24 * time.Hour)
	if in.SinceDate != "" {
		if t, err := parseDate(in.SinceDate); err == nil {
			since = t
		}
	}
	b, err := h.repo.CreateBlocker(r.Context(), sid, blockingTaskID, in.Description, sev, since, uid)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	o := blockerOutput{
		ID: b.ID.String(), StoryID: b.StoryID.String(),
		Description: b.Description, Severity: b.Severity,
		SinceDate: b.SinceDate.Format("2006-01-02"),
	}
	if b.BlockingTaskID != nil {
		s := b.BlockingTaskID.String()
		o.BlockingTaskID = &s
	}
	respondJSON(w, http.StatusCreated, o)
}

func (h *EntitiesHandler) ResolveBlocker(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.repo.ResolveBlocker(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusNoContent, nil)
}

func (h *EntitiesHandler) DeleteBlocker(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.repo.DeleteBlocker(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusNoContent, nil)
}

// ---------- Timeline events ----------

type eventInput struct {
	EventDate    string   `json:"event_date"`
	Kind         string   `json:"kind"`
	Label        string   `json:"label"`
	AffectedKPIs []string `json:"affected_kpis"`
	RegionID     *string  `json:"region_id"`
	Description  *string  `json:"description"`
}

type eventOutput struct {
	ID           string   `json:"id"`
	EventDate    string   `json:"event_date"`
	Kind         string   `json:"kind"`
	Label        string   `json:"label"`
	AffectedKPIs []string `json:"affected_kpis"`
	RegionID     *string  `json:"region_id"`
	Description  *string  `json:"description"`
}

func (h *EntitiesHandler) ListEvents(w http.ResponseWriter, r *http.Request) {
	from := time.Now().AddDate(0, 0, -90)
	to := time.Now().AddDate(0, 0, 30)
	if s := r.URL.Query().Get("from"); s != "" {
		if t, err := parseDate(s); err == nil {
			from = t
		}
	}
	if s := r.URL.Query().Get("to"); s != "" {
		if t, err := parseDate(s); err == nil {
			to = t
		}
	}
	list, err := h.repo.ListEvents(r.Context(), parseRegion(r), from, to)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	out := make([]eventOutput, 0, len(list))
	for _, e := range list {
		o := eventOutput{
			ID: e.ID.String(), EventDate: e.Date.Format("2006-01-02"),
			Kind: e.Kind, Label: e.Label, AffectedKPIs: e.AffectedKPIs,
			Description: e.Description,
		}
		if e.RegionID != nil {
			s := e.RegionID.String()
			o.RegionID = &s
		}
		out = append(out, o)
	}
	respondJSON(w, http.StatusOK, out)
}

func (h *EntitiesHandler) CreateEvent(w http.ResponseWriter, r *http.Request) {
	uid, ok := userIDFromCtx(r)
	if !ok {
		respondError(w, http.StatusUnauthorized, "auth required")
		return
	}
	var in eventInput
	if err := decodeJSON(r, &in); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if in.Label == "" || in.Kind == "" || in.EventDate == "" {
		respondError(w, http.StatusBadRequest, "label, kind, event_date required")
		return
	}
	d, err := parseDate(in.EventDate)
	if err != nil {
		respondError(w, http.StatusBadRequest, "event_date must be YYYY-MM-DD")
		return
	}
	var regionID *uuid.UUID
	if in.RegionID != nil && *in.RegionID != "" {
		id, err := uuid.Parse(*in.RegionID)
		if err == nil {
			regionID = &id
		}
	}
	kpis := in.AffectedKPIs
	if kpis == nil {
		kpis = []string{}
	}
	e, err := h.repo.CreateEvent(r.Context(), d, in.Kind, in.Label, kpis, regionID, in.Description, uid)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	o := eventOutput{
		ID: e.ID.String(), EventDate: e.Date.Format("2006-01-02"),
		Kind: e.Kind, Label: e.Label, AffectedKPIs: e.AffectedKPIs,
		Description: e.Description,
	}
	if e.RegionID != nil {
		s := e.RegionID.String()
		o.RegionID = &s
	}
	respondJSON(w, http.StatusCreated, o)
}

func (h *EntitiesHandler) DeleteEvent(w http.ResponseWriter, r *http.Request) {
	id, err := paramUUID(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.repo.DeleteEvent(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusNoContent, nil)
}
