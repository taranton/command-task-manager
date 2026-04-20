package service

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/qrt/command/internal/repository"
)

// ---- Thresholds (tunable via env) ----

type RiskThresholds struct {
	OverdueCriticalDays int     // overdue by ≥ N days → critical
	DeadlineSoonDays    int     // deadline ≤ N days ahead
	DeadlineSoonMinPct  int     // + progress < this % → critical (soon+1) or high (soon+3)
	StalledMinDays      int     // no status change ≥ N days AND in_progress → high
	CycleMedianMult     float64 // cycle time > this × median → medium
	MaxRisks            int     // cap on returned risks
}

func defaultThresholds() RiskThresholds {
	return RiskThresholds{
		OverdueCriticalDays: getEnvInt("RISK_OVERDUE_CRITICAL_DAYS", 3),
		DeadlineSoonDays:    getEnvInt("RISK_DEADLINE_SOON_DAYS", 3),
		DeadlineSoonMinPct:  getEnvInt("RISK_DEADLINE_PROGRESS_PCT", 30),
		StalledMinDays:      getEnvInt("RISK_STALLED_MIN_DAYS", 6),
		CycleMedianMult:     getEnvFloat("RISK_CYCLE_MEDIAN_MULT", 2.0),
		MaxRisks:            getEnvInt("RISK_MAX_RESULTS", 30),
	}
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func getEnvFloat(key string, fallback float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return fallback
}

// ---- API shape ----

type Risk struct {
	TaskID      string  `json:"task_id"`
	Title       string  `json:"title"`
	Severity    string  `json:"severity"` // "critical" | "high" | "medium"
	Reason      string  `json:"reason"`
	Office      *string `json:"office"`
	TeamName    *string `json:"team_name"`
	Priority    string  `json:"priority"`
	Status      string  `json:"status"`
	Deadline    *string `json:"deadline"`
	Assignee    *string `json:"assignee"`
	AssigneeID  *string `json:"assignee_id"`
}

// ---- Implementation ----

func (s *AnalyticsService) Risks(ctx context.Context, regionID *uuid.UUID) ([]Risk, error) {
	return s.RisksWith(ctx, regionID, defaultThresholds())
}

func (s *AnalyticsService) RisksWith(ctx context.Context, regionID *uuid.UUID, t RiskThresholds) ([]Risk, error) {
	// Single SQL passing thresholds as parameters. We look at all open tasks and
	// return rows with fields needed to apply rules. Scoring is done in Go for
	// clearer rule composition (and easier to tweak per-task reasoning text).
	candidates, err := s.repo.RiskCandidates(ctx, regionID)
	if err != nil {
		return nil, err
	}

	// Approximate team-median cycle time = overall median cycle. We already compute
	// avg cycle per timeframe; use 14-day avg as a quick proxy for "median" here.
	avgCycle, _ := s.repo.CycleTimeAvgDays(ctx, regionID, 14)

	today := time.Now().UTC().Truncate(24 * time.Hour)
	risks := make([]Risk, 0, len(candidates))

	for _, c := range candidates {
		if c.Status == "done" || c.Status == "closed" {
			continue
		}
		r, ok := scoreTask(c, today, avgCycle, t)
		if !ok {
			continue
		}
		risks = append(risks, r)
	}

	// Sort by severity then by daysOverdue desc
	sortRisks(risks)

	if len(risks) > t.MaxRisks {
		risks = risks[:t.MaxRisks]
	}
	return risks, nil
}

// scoreTask applies rules in order — first match wins, so more severe rules come first.
func scoreTask(c repository.RiskCandidate, today time.Time, avgCycle float64, t RiskThresholds) (Risk, bool) {
	r := Risk{
		TaskID:     c.ID.String(),
		Title:      c.Title,
		Office:     c.Office,
		TeamName:   c.TeamName,
		Priority:   c.Priority,
		Status:     c.Status,
		Assignee:   c.AssigneeName,
	}
	if c.Deadline != nil {
		ds := c.Deadline.Format("2006-01-02")
		r.Deadline = &ds
	}
	if c.AssigneeID != nil {
		s := c.AssigneeID.String()
		r.AssigneeID = &s
	}

	// Rule 1: overdue ≥ N days → critical
	if c.Deadline != nil {
		days := int(today.Sub(*c.Deadline).Hours() / 24)
		if days >= t.OverdueCriticalDays {
			r.Severity = "critical"
			r.Reason = fmt.Sprintf("Overdue by %d days — no resolution yet.", days)
			return r, true
		}
		// Rule 2: deadline within 1 day AND progress < soon-threshold → critical
		daysAhead := int(c.Deadline.Sub(today).Hours() / 24)
		if daysAhead >= 0 && daysAhead <= 1 && c.Progress < t.DeadlineSoonMinPct {
			r.Severity = "critical"
			if daysAhead == 0 {
				r.Reason = fmt.Sprintf("Deadline today · progress %d%%.", c.Progress)
			} else {
				r.Reason = fmt.Sprintf("Deadline tomorrow · progress %d%%.", c.Progress)
			}
			return r, true
		}
	}

	// Rule 3: stalled — no status change in ≥ N days AND in_progress → high
	if c.Status == "in_progress" && c.LastStatusChange != nil {
		days := int(today.Sub(*c.LastStatusChange).Hours() / 24)
		if days >= t.StalledMinDays {
			r.Severity = "high"
			r.Reason = fmt.Sprintf("Stalled — no activity in %d days.", days)
			return r, true
		}
	}

	// Rule 4: deadline ≤ soonDays AND progress < soon-threshold → high
	if c.Deadline != nil {
		daysAhead := int(c.Deadline.Sub(today).Hours() / 24)
		if daysAhead >= 0 && daysAhead <= t.DeadlineSoonDays && c.Progress < t.DeadlineSoonMinPct {
			r.Severity = "high"
			r.Reason = fmt.Sprintf("Deadline in %d days · only %d%% done.", daysAhead, c.Progress)
			return r, true
		}
	}

	// Rule 5: cycle time > N× team median → medium (only for in_progress)
	if c.Status == "in_progress" && avgCycle > 0 && c.AgeDays > 0 {
		if float64(c.AgeDays) > avgCycle*t.CycleMedianMult {
			r.Severity = "medium"
			r.Reason = fmt.Sprintf("Open for %dd — %.1f× the team average (%.1fd).",
				c.AgeDays, float64(c.AgeDays)/avgCycle, avgCycle)
			return r, true
		}
	}

	return r, false
}

// sortRisks: critical > high > medium, then by title for stability.
func sortRisks(rs []Risk) {
	order := map[string]int{"critical": 0, "high": 1, "medium": 2}
	// simple stable sort
	for i := 1; i < len(rs); i++ {
		for j := i; j > 0; j-- {
			if order[rs[j].Severity] < order[rs[j-1].Severity] {
				rs[j], rs[j-1] = rs[j-1], rs[j]
			} else {
				break
			}
		}
	}
}
