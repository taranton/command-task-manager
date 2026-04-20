package service

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"

	"github.com/qrt/command/internal/repository"
)

type AnalyticsService struct {
	repo *repository.AnalyticsRepository
}

func NewAnalyticsService(repo *repository.AnalyticsRepository) *AnalyticsService {
	return &AnalyticsService{repo: repo}
}

// ----- KPIs (current state + sparkline from snapshots) -----

type KPIValue struct {
	Completion  int     `json:"completion"`  // %
	Velocity    int     `json:"velocity"`    // done/week
	CycleDays   float64 `json:"cycle_days"`
	OverduePct  int     `json:"overdue_pct"`
	Utilization int     `json:"utilization"` // %
}

type KPIResponse struct {
	Current     KPIValue    `json:"current"`
	Prior       KPIValue    `json:"prior"`
	Spark       KPISpark    `json:"spark"`
	TimeframeDays int       `json:"timeframe_days"`
}

type KPISpark struct {
	Dates        []string  `json:"dates"`
	Completion   []int     `json:"completion"`
	Velocity     []int     `json:"velocity"`
	CycleDays    []float64 `json:"cycle_days"`
	OverduePct   []int     `json:"overdue_pct"`
	Utilization  []int     `json:"utilization"`
	// Prior-period mirrored series
	PriorCompletion []int  `json:"prior_completion"`
	PriorVelocity   []int  `json:"prior_velocity"`
	PriorCycleDays  []float64 `json:"prior_cycle_days"`
	PriorOverduePct []int  `json:"prior_overdue_pct"`
	PriorUtilization []int `json:"prior_utilization"`
}

// KPI computes current + prior-period KPIs and a sparkline series from snapshots.
// If fewer than `days` snapshots exist, the gaps are left as zeros (frontend
// can render the partial series without crashing).
func (s *AnalyticsService) KPI(ctx context.Context, regionID *uuid.UUID, days int) (*KPIResponse, error) {
	today := time.Now().UTC().Truncate(24 * time.Hour)
	from := today.AddDate(0, 0, -(2*days - 1)) // need 2×days for prior window
	snaps, err := s.repo.GetSnapshots(ctx, regionID, from, today)
	if err != nil {
		return nil, err
	}

	// Index snapshots by date
	byDate := map[string]repository.DailySnapshot{}
	for _, snap := range snaps {
		byDate[snap.Date.Format("2006-01-02")] = snap
	}

	// Build current window
	curDates := make([]string, days)
	curCompletion := make([]int, days)
	curVelocity := make([]int, days)
	curCycle := make([]float64, days)
	curOverdue := make([]int, days)
	curUtil := make([]int, days)
	for i := 0; i < days; i++ {
		d := today.AddDate(0, 0, -(days - 1 - i))
		key := d.Format("2006-01-02")
		curDates[i] = key
		if snap, ok := byDate[key]; ok {
			curCompletion[i] = pct(snap.Done, snap.Total)
			curVelocity[i] = snap.DoneInDay
			if snap.CycleAvg != nil {
				curCycle[i] = *snap.CycleAvg
			}
			curOverdue[i] = pct(snap.Overdue, snap.Total)
			denom := snap.ActiveUsers
			if denom < 1 {
				denom = 1
			}
			curUtil[i] = min100(snap.InProgress + snap.InReview, denom)
		}
	}

	// Prior window
	priorCompletion := make([]int, days)
	priorVelocity := make([]int, days)
	priorCycle := make([]float64, days)
	priorOverdue := make([]int, days)
	priorUtil := make([]int, days)
	for i := 0; i < days; i++ {
		d := today.AddDate(0, 0, -(2*days - 1 - i))
		key := d.Format("2006-01-02")
		if snap, ok := byDate[key]; ok {
			priorCompletion[i] = pct(snap.Done, snap.Total)
			priorVelocity[i] = snap.DoneInDay
			if snap.CycleAvg != nil {
				priorCycle[i] = *snap.CycleAvg
			}
			priorOverdue[i] = pct(snap.Overdue, snap.Total)
			denom := snap.ActiveUsers
			if denom < 1 {
				denom = 1
			}
			priorUtil[i] = min100(snap.InProgress + snap.InReview, denom)
		}
	}

	// Current KPI value = live aggregate (most accurate than last snapshot)
	agg, err := s.repo.AggregateTasks(ctx, regionID)
	if err != nil {
		return nil, err
	}
	users, err := s.repo.ActiveUserCount(ctx, regionID)
	if err != nil {
		return nil, err
	}
	cycle, _ := s.repo.CycleTimeAvgDays(ctx, regionID, days)

	weeks := float64(days) / 7.0
	if weeks < 1 {
		weeks = 1
	}
	// pick "done in current window" from snapshots (sum of done_in_day)
	doneInWindow := 0
	for _, v := range curVelocity {
		doneInWindow += v
	}
	// If no snapshots yet, fall back to live recent counts
	if doneInWindow == 0 {
		if days >= 30 {
			doneInWindow = agg.DoneLast30d
		} else {
			doneInWindow = agg.DoneLast7d
		}
	}

	current := KPIValue{
		Completion:  pct(agg.Done, agg.Total),
		Velocity:    int(float64(doneInWindow) / weeks),
		CycleDays:   round2(cycle),
		OverduePct:  pct(agg.Overdue, agg.Total),
		Utilization: min100(agg.InProgress+agg.InReview, max1(users)),
	}

	// Prior value: average of the prior-period arrays (non-zero entries)
	prior := KPIValue{
		Completion:  avgNonZero(priorCompletion),
		Velocity:    sum(priorVelocity) / intMax(days/7, 1),
		CycleDays:   avgNonZeroF(priorCycle),
		OverduePct:  avgNonZero(priorOverdue),
		Utilization: avgNonZero(priorUtil),
	}

	return &KPIResponse{
		Current:       current,
		Prior:         prior,
		TimeframeDays: days,
		Spark: KPISpark{
			Dates:        curDates,
			Completion:   curCompletion,
			Velocity:     curVelocity,
			CycleDays:    curCycle,
			OverduePct:   curOverdue,
			Utilization:  curUtil,
			PriorCompletion: priorCompletion,
			PriorVelocity:   priorVelocity,
			PriorCycleDays:  priorCycle,
			PriorOverduePct: priorOverdue,
			PriorUtilization: priorUtil,
		},
	}, nil
}

// ----- Burndown -----

type BurndownResponse struct {
	Dates      []string `json:"dates"`
	Open       []int    `json:"open"`
	Ideal      []int    `json:"ideal"`
	Throughput []int    `json:"throughput"`
}

func (s *AnalyticsService) Burndown(ctx context.Context, regionID *uuid.UUID, days int) (*BurndownResponse, error) {
	today := time.Now().UTC().Truncate(24 * time.Hour)
	from := today.AddDate(0, 0, -(days - 1))
	snaps, err := s.repo.GetSnapshots(ctx, regionID, from, today)
	if err != nil {
		return nil, err
	}
	byDate := map[string]repository.DailySnapshot{}
	for _, snap := range snaps {
		byDate[snap.Date.Format("2006-01-02")] = snap
	}

	dates := make([]string, days)
	open := make([]int, days)
	throughput := make([]int, days)

	var startOpen, endOpen int
	for i := 0; i < days; i++ {
		d := today.AddDate(0, 0, -(days - 1 - i))
		key := d.Format("2006-01-02")
		dates[i] = key
		if snap, ok := byDate[key]; ok {
			openCount := snap.Total - snap.Done
			open[i] = openCount
			throughput[i] = snap.DoneInDay
			if i == 0 {
				startOpen = openCount
			}
			endOpen = openCount
		}
	}
	// If first day missing, use current live aggregate as fallback
	agg, _ := s.repo.AggregateTasks(ctx, regionID)
	if startOpen == 0 && agg.Total > 0 {
		startOpen = agg.Total - agg.Done
		endOpen = startOpen
	}

	ideal := make([]int, days)
	for i := 0; i < days; i++ {
		frac := float64(i) / float64(max1(days - 1))
		ideal[i] = startOpen - int(float64(startOpen-endOpen)*frac)
	}

	return &BurndownResponse{Dates: dates, Open: open, Ideal: ideal, Throughput: throughput}, nil
}

// ----- Offices -----

type OfficeRollupRow struct {
	Office       string `json:"office"`
	Total        int    `json:"total"`
	Done         int    `json:"done"`
	InProgress   int    `json:"in_progress"`
	InReview     int    `json:"in_review"`
	ToDo         int    `json:"to_do"`
	Backlog      int    `json:"backlog"`
	Overdue      int    `json:"overdue"`
	PeopleCount  int    `json:"people_count"`
	CompletionPct int   `json:"completion_pct"`
}

func (s *AnalyticsService) Offices(ctx context.Context, regionID *uuid.UUID) ([]OfficeRollupRow, error) {
	rows, err := s.repo.OfficeRollup(ctx, regionID)
	if err != nil {
		return nil, err
	}
	out := make([]OfficeRollupRow, 0, len(rows))
	for _, r := range rows {
		out = append(out, OfficeRollupRow{
			Office:        r.Office,
			Total:         r.Total,
			Done:          r.Done,
			InProgress:    r.InProgress,
			InReview:      r.InReview,
			ToDo:          r.ToDo,
			Backlog:       r.Backlog,
			Overdue:       r.Overdue,
			PeopleCount:   r.PeopleCount,
			CompletionPct: pct(r.Done, r.Total),
		})
	}
	return out, nil
}

// ----- Period compare -----

type PeriodCompareResp struct {
	Current KPIValue `json:"current"`
	Prior   KPIValue `json:"prior"`
	Days    int      `json:"days"`
}

func (s *AnalyticsService) PeriodCompare(ctx context.Context, regionID *uuid.UUID, days int) (*PeriodCompareResp, error) {
	k, err := s.KPI(ctx, regionID, days)
	if err != nil {
		return nil, err
	}
	return &PeriodCompareResp{Current: k.Current, Prior: k.Prior, Days: days}, nil
}

// ----- Drill-down -----

type DrillRow struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	Status     string  `json:"status"`
	Priority   string  `json:"priority"`
	Deadline   *string `json:"deadline"`
	StoryID    string  `json:"story_id"`
	TeamID     *string `json:"team_id"`
	TeamName   *string `json:"team_name"`
	Office     *string `json:"office"`
	Assignee   *string `json:"assignee"`
	AssigneeID *string `json:"assignee_id"`
}

func (s *AnalyticsService) Drill(ctx context.Context, regionID *uuid.UUID, kpi string, limit int) ([]DrillRow, error) {
	tasks, err := s.repo.DrillTasks(ctx, regionID, kpi, limit)
	if err != nil {
		return nil, err
	}
	out := make([]DrillRow, 0, len(tasks))
	for _, t := range tasks {
		row := DrillRow{
			ID:       t.ID.String(),
			Title:    t.Title,
			Status:   t.Status,
			Priority: t.Priority,
			StoryID:  t.StoryID.String(),
			TeamName: t.TeamName,
			Office:   t.Office,
			Assignee: t.Assignee,
		}
		if t.Deadline != nil {
			ds := t.Deadline.Format("2006-01-02")
			row.Deadline = &ds
		}
		if t.TeamID != nil {
			s := t.TeamID.String()
			row.TeamID = &s
		}
		if t.AssigneeID != nil {
			s := t.AssigneeID.String()
			row.AssigneeID = &s
		}
		out = append(out, row)
	}
	return out, nil
}

// ----- People risk -----

type PersonRisk struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	TeamID    *string `json:"team_id"`
	TeamName  *string `json:"team_name"`
	Workload  int     `json:"workload"`
	Overdue   int     `json:"overdue"`
	Criticals int     `json:"criticals"`
	Burnout   int     `json:"burnout"`
}

type BusFactorTeam struct {
	TeamID    string  `json:"team_id"`
	TeamName  string  `json:"team_name"`
	Office    *string `json:"office"`
	Bus       int     `json:"bus"`
	TopShare  int     `json:"top_share"`
	TopPerson *string `json:"top_person"`
}

type PeopleRiskResponse struct {
	TopBurnout []PersonRisk    `json:"top_burnout"`
	BusFactor  []BusFactorTeam `json:"bus_factor"`
	Counts     struct {
		High     int `json:"high"`
		Elevated int `json:"elevated"`
		Healthy  int `json:"healthy"`
	} `json:"counts"`
}

func (s *AnalyticsService) PeopleRisk(ctx context.Context, regionID *uuid.UUID) (*PeopleRiskResponse, error) {
	people, err := s.repo.PeopleWorkload(ctx, regionID)
	if err != nil {
		return nil, err
	}
	bus, err := s.repo.BusFactor(ctx, regionID)
	if err != nil {
		return nil, err
	}

	resp := &PeopleRiskResponse{
		TopBurnout: []PersonRisk{},
		BusFactor:  []BusFactorTeam{},
	}
	for _, p := range people {
		// burnout = workload*6 + overdue*14 + criticals*8, capped at 100
		score := p.Workload*6 + p.Overdue*14 + p.Criticals*8
		if score > 100 {
			score = 100
		}
		pr := PersonRisk{
			ID:        p.ID.String(),
			Name:      p.Name,
			Workload:  p.Workload,
			Overdue:   p.Overdue,
			Criticals: p.Criticals,
			Burnout:   score,
			TeamName:  p.TeamName,
		}
		if p.TeamID != nil {
			tid := p.TeamID.String()
			pr.TeamID = &tid
		}
		resp.TopBurnout = append(resp.TopBurnout, pr)
		if score >= 75 {
			resp.Counts.High++
		} else if score >= 50 {
			resp.Counts.Elevated++
		} else {
			resp.Counts.Healthy++
		}
	}
	// Sort descending by burnout, cap at top 10
	sortPeopleByBurnout(resp.TopBurnout)
	if len(resp.TopBurnout) > 10 {
		resp.TopBurnout = resp.TopBurnout[:10]
	}

	for _, b := range bus {
		resp.BusFactor = append(resp.BusFactor, BusFactorTeam{
			TeamID:    b.TeamID.String(),
			TeamName:  b.TeamName,
			Office:    b.Office,
			Bus:       b.Bus,
			TopShare:  b.TopShare,
			TopPerson: b.TopPerson,
		})
	}
	return resp, nil
}

func sortPeopleByBurnout(p []PersonRisk) {
	for i := 1; i < len(p); i++ {
		for j := i; j > 0 && p[j].Burnout > p[j-1].Burnout; j-- {
			p[j], p[j-1] = p[j-1], p[j]
		}
	}
}

// ===============================================================
// Snapshot job
// ===============================================================

// RunSnapshot writes today's snapshot for the given region (or all regions if nil).
// Idempotent — safely replaces existing row for (today, region).
func (s *AnalyticsService) RunSnapshot(ctx context.Context, regionID *uuid.UUID) error {
	today := time.Now().UTC().Truncate(24 * time.Hour)
	agg, err := s.repo.AggregateTasks(ctx, regionID)
	if err != nil {
		return err
	}
	users, err := s.repo.ActiveUserCount(ctx, regionID)
	if err != nil {
		return err
	}
	cycle, _ := s.repo.CycleTimeAvgDays(ctx, regionID, 14)

	// done_in_day: tasks that transitioned to 'done' today
	doneToday := 0
	m, _ := s.repo.DoneCountByDay(ctx, regionID, 1)
	if v, ok := m[today.Format("2006-01-02")]; ok {
		doneToday = v
	}

	cycleP := &cycle
	if cycle == 0 {
		cycleP = nil
	}

	snap := repository.DailySnapshot{
		Date:         today,
		Total:        agg.Total,
		Done:         agg.Done,
		Overdue:      agg.Overdue,
		InProgress:   agg.InProgress,
		InReview:     agg.InReview,
		Backlog:      agg.Backlog,
		ToDo:         agg.ToDo,
		DoneInDay:    doneToday,
		CycleAvg:     cycleP,
		ActiveUsers:  users,
	}
	return s.repo.UpsertSnapshot(ctx, snap, regionID)
}

// BackfillFromChangelog seeds snapshots for the last `days` days by replaying
// done-transitions per day. Called once at startup if no snapshots exist.
func (s *AnalyticsService) BackfillFromChangelog(ctx context.Context, regionID *uuid.UUID, days int) error {
	today := time.Now().UTC().Truncate(24 * time.Hour)
	agg, err := s.repo.AggregateTasks(ctx, regionID)
	if err != nil {
		return err
	}
	users, _ := s.repo.ActiveUserCount(ctx, regionID)
	done, err := s.repo.DoneCountByDay(ctx, regionID, days)
	if err != nil {
		return err
	}

	// We approximate historical totals by assuming current total and working backwards
	// subtracting daily done counts. This is imperfect (doesn't account for creations
	// or deletions) but gives a usable baseline. Real accuracy comes from forward-going
	// daily snapshots.
	cumulativeDoneFuture := 0
	for i := 0; i < days; i++ {
		d := today.AddDate(0, 0, -(days - 1 - i))
		key := d.Format("2006-01-02")
		doneInDay := done[key]
		// "done as of date d" = current done - (done after d)
		doneThen := agg.Done - cumulativeDoneFuture
		snap := repository.DailySnapshot{
			Date:        d,
			Total:       agg.Total, // approximation
			Done:        doneThen,
			Overdue:     agg.Overdue, // approximation — we don't have historical
			InProgress:  agg.InProgress,
			InReview:    agg.InReview,
			Backlog:     agg.Backlog,
			ToDo:        agg.ToDo,
			DoneInDay:   doneInDay,
			ActiveUsers: users,
		}
		if err := s.repo.UpsertSnapshot(ctx, snap, regionID); err != nil {
			return err
		}
		cumulativeDoneFuture += doneInDay
	}
	return nil
}

// StartSnapshotScheduler runs the snapshot job at startup (backfill if empty)
// and then once a day at ~00:05 UTC.
func (s *AnalyticsService) StartSnapshotScheduler(ctx context.Context, regionIDs []uuid.UUID) {
	// Initial: backfill + today's snapshot for all regions + global
	if err := s.runForAll(ctx, regionIDs, true); err != nil {
		log.Printf("analytics: initial snapshot failed: %v", err)
	}

	go func() {
		for {
			now := time.Now().UTC()
			// next 00:05 UTC
			next := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 5, 0, 0, time.UTC)
			wait := time.Until(next)
			log.Printf("analytics: next snapshot in %v", wait.Round(time.Second))

			select {
			case <-ctx.Done():
				return
			case <-time.After(wait):
				if err := s.runForAll(ctx, regionIDs, false); err != nil {
					log.Printf("analytics: scheduled snapshot failed: %v", err)
				}
			}
		}
	}()
}

func (s *AnalyticsService) runForAll(ctx context.Context, regionIDs []uuid.UUID, backfillIfEmpty bool) error {
	// Global (region=nil)
	if err := s.snapshotOne(ctx, nil, backfillIfEmpty); err != nil {
		return err
	}
	for i := range regionIDs {
		rid := regionIDs[i]
		if err := s.snapshotOne(ctx, &rid, backfillIfEmpty); err != nil {
			log.Printf("analytics: snapshot region %s failed: %v", rid, err)
		}
	}
	return nil
}

func (s *AnalyticsService) snapshotOne(ctx context.Context, regionID *uuid.UUID, backfillIfEmpty bool) error {
	if backfillIfEmpty {
		// Check if any snapshot exists for this region
		snaps, err := s.repo.GetSnapshots(ctx, regionID, time.Now().AddDate(0, 0, -90), time.Now())
		if err == nil && len(snaps) == 0 {
			if err := s.BackfillFromChangelog(ctx, regionID, 30); err != nil {
				log.Printf("analytics: backfill region=%v failed: %v", regionID, err)
			}
		}
	}
	return s.RunSnapshot(ctx, regionID)
}

// ----- math helpers -----

func pct(num, denom int) int {
	if denom <= 0 {
		return 0
	}
	return int(float64(num) / float64(denom) * 100)
}

func min100(num, denom int) int {
	v := pct(num, denom)
	if v > 100 {
		return 100
	}
	return v
}

func max1(v int) int {
	if v < 1 {
		return 1
	}
	return v
}

func intMax(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func sum(a []int) int {
	s := 0
	for _, v := range a {
		s += v
	}
	return s
}

func avgNonZero(a []int) int {
	s, n := 0, 0
	for _, v := range a {
		if v != 0 {
			s += v
			n++
		}
	}
	if n == 0 {
		return 0
	}
	return s / n
}

func avgNonZeroF(a []float64) float64 {
	s, n := 0.0, 0
	for _, v := range a {
		if v != 0 {
			s += v
			n++
		}
	}
	if n == 0 {
		return 0
	}
	return round2(s / float64(n))
}

func round2(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}
