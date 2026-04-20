# C-Level Board — Backend Wiring Plan

**Status:** Draft. Scope for review.
**Goal:** Replace all mock data in the C-Level Board with real backend endpoints, derived from actual tasks/stories/teams/users. Some sections need new database entities.

---

## Inventory: what each section needs

| Section | Data needed | Source today | Backend gap |
|---|---|---|---|
| **KPI Hero** (Completion, Velocity, Cycle, Overdue, Utilization) | current value + 14/30/90-day sparkline + prior-period value + delta | none (mocked) | need analytics endpoint; sparklines reconstructed from `command_changelog` |
| **Drill-down strip** | task list filtered by KPI | real tasks exist | need filter logic per KPI |
| **Burndown + Throughput** | daily open count + daily done count, over N days | none (mocked) | reconstructed from `command_changelog` |
| **Office comparison** | per-office aggregates (counts by status, overdue, people, rate) | teams.office + tasks | simple rollup query |
| **Active stories** | active stories with progress + WIP count | `/api/v1/stories` already | add WIP count + filters |
| **Period over period** | KPI values for this N days vs prior N days | none (mocked) | part of analytics endpoint |
| **AI risk watchlist** | list of risky tasks with severity + reason | none (mocked) | rule-based scoring engine |
| **Release calendar** | releases with date/type/office/stories[] | no entity | **new table + CRUD** |
| **Dependencies + external blockers** | story→story dep graph, external blockers list | no entity | **new tables + CRUD** |
| **People risk** | per-person workload/overdue/criticals/burnout, per-team bus factor | people + tasks exist | aggregation query |
| **Timeline events** (sparkline markers) | release/incident/hire dates | no entity | **new table** |

---

## Phased plan

### Phase 1 — Analytics service (no new tables)
Pure read endpoints, computed on-demand from existing `tasks`/`stories`/`teams`/`users`/`command_changelog`.

**New files:**
- `backend/internal/service/analytics.go` — all rollup logic
- `backend/internal/handler/analytics.go` — thin handlers
- `backend/internal/repository/analytics_repo.go` — SQL queries

**Endpoints:**
```
GET  /api/v1/analytics/kpi?region=X&timeframe=14d
GET  /api/v1/analytics/burndown?region=X&timeframe=14d
GET  /api/v1/analytics/offices?region=X
GET  /api/v1/analytics/period-compare?region=X&timeframe=14d
GET  /api/v1/analytics/drill?kpi=completion&region=X
```

**KPI derivations:**
| KPI | Current value | Sparkline (historical) |
|---|---|---|
| Completion | `done / total` (WHERE deleted_at IS NULL) | daily: done transitions per day from changelog |
| Velocity | `done in last 7d / 1` | daily: count of status→done events from changelog |
| Cycle time | `avg(updated_at - created_at)` over last-N-days done tasks | rolling 7-day avg, last 14 days |
| Overdue | `count(deadline < today AND status != done) / total` | historical: replay changelog per day (approximate) |
| Utilization | `(in_progress + in_review) / user_count_in_region * 100` | daily: count active tasks from changelog |

**Prior-period:** Same formulas but shifted by N days. For completion/velocity we have the data; for cycle/overdue we approximate.

**Region filtering:** All queries take `region_id`. Filter via `teams.region_id = $1`.

**Caching:** Wrap service calls in Redis cache with 60s TTL (analytics change slowly). Skip for Phase 1, add in Phase 5.

**Deliverable:** KPI hero, burndown, office comparison, period-compare, drill-down — all real. Release calendar / risks / dependencies / people risk / events still mock.

**Effort:** ~1 day backend + half a day frontend wiring.

---

### Phase 2 — Risk scoring engine (no new tables)

Rule-based, runs on-demand against current DB state.

**Rules** (ranked; first match wins per task):
1. `deadline ≤ today AND status != done AND overdue ≥ 3d` → **critical**, reason: "Overdue by Xd, no resolution."
2. `deadline ≤ today+1d AND progress < 50% AND status != done` → **critical**, reason: "Deadline tomorrow, progress X%."
3. `no status change ≥ 6d AND status = in_progress` → **high**, reason: "Stalled — no activity in Xd."
4. `deadline ≤ today+3d AND progress < 30%` → **high**, reason: "Deadline in Xd, only X% done."
5. `cycle_time > 2× team_median AND status = in_progress` → **medium**, reason: "Taking 2.3× longer than team median."

**Endpoint:**
```
GET /api/v1/analytics/risks?region=X&limit=20
```

**Deliverable:** AI risk watchlist (both list and triage views) real.

**Effort:** ~0.5 day.

---

### Phase 3 — People analytics (no new tables)

**Endpoint:**
```
GET /api/v1/analytics/people-risk?region=X
```

**Returns:**
- `top_burnout`: per-person `{ workload, overdue, criticals, burnout_score }`
  - `burnout = min(100, workload*6 + overdue*14 + criticals*8)` (same formula as mock — reviewable)
- `bus_factor`: per-team `{ bus, top_person, top_share }`
  - `top_share = max(tasks_per_person) / total_team_tasks`
  - `bus = 1 if top_share > 0.6 else 2 if > 0.4 else count_active_assignees`
- Bench overview counters

**Deliverable:** People risk section real.

**Effort:** ~0.5 day.

---

### Phase 4 — New entities

Three new tables. Each needs migration + model + repo + handler + route + admin UI to create/edit records.

#### 4a. Releases
```sql
CREATE TABLE command_releases (
  id UUID PK,
  release_date DATE NOT NULL,
  label VARCHAR(255) NOT NULL,
  release_type VARCHAR(20) NOT NULL CHECK (release_type IN ('major','minor','patch')),
  region_id UUID REFERENCES regions(id),
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE command_release_stories (
  release_id UUID REFERENCES command_releases(id) ON DELETE CASCADE,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  PRIMARY KEY (release_id, story_id)
);
```

**Endpoints:** `GET/POST/PATCH/DELETE /api/v1/releases`, `GET/POST /api/v1/releases/:id/stories`.

**Admin UI:** New tab in Boards management → "Releases" → list + create modal.

#### 4b. Story dependencies + external blockers
```sql
CREATE TABLE command_story_deps (
  id UUID PK,
  from_story UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  to_story UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (from_story, to_story)
);
CREATE TABLE command_external_blockers (
  id UUID PK,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  blocker_description TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  since_date DATE NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Endpoints:** CRUD under `/api/v1/story-deps` and `/api/v1/blockers`.

**UI surfacing:** Dependencies editable from StoryDetail panel — "Blocks / Blocked by" inline. Blockers also editable from StoryDetail.

#### 4c. Timeline events
```sql
CREATE TABLE command_timeline_events (
  id UUID PK,
  event_date DATE NOT NULL,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('release','incident','hire','launch','milestone')),
  label VARCHAR(255) NOT NULL,
  affected_kpis TEXT[],
  region_id UUID REFERENCES regions(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Endpoints:** CRUD under `/api/v1/events`.

**Admin UI:** Minimal — list + create modal in Boards management.

**Deliverable:** Release calendar, dependencies graph, external blockers, sparkline event markers — all real.

**Effort:** ~2 days (migrations + 3 entities × model/repo/handler + admin UI).

---

### Phase 5 — Polish: caching + realtime

- Redis cache for analytics responses, TTL 60s, key = endpoint+region+timeframe.
- Invalidate on task/story status changes.
- WebSocket push: when task status changes, broadcast `analytics_invalidate` → frontend refetches.
- Client: `useQuery` with short `staleTime` + manual invalidate on ws events.

**Effort:** ~0.5 day.

---

## Total scope
| Phase | Backend | Frontend | Days |
|---|---|---|---|
| 1. Analytics service | new files, no tables | wire 5 sections | 1.5 |
| 2. Risk scoring | extend service | wire 1 section | 0.5 |
| 3. People analytics | extend service | wire 1 section | 0.5 |
| 4. New entities (releases/deps/blockers/events) | 4 tables + CRUD | wire 3 sections + admin UI | 2 |
| 5. Caching + realtime | Redis + ws | stale-while-revalidate | 0.5 |
| **Total** | | | **~5 days** |

---

## Open questions (need decisions before starting)

1. **Sparkline historical data.** Changelog has status transitions. We can reliably compute daily done-count (velocity) and daily in-progress-count (utilization). Completion rate sparkline needs total-task count per day — derivable from `tasks.created_at` + `deleted_at`. Overdue sparkline is approximate (needs historical deadline+state — feasible but more complex). **Accept approximation for v1?**

2. **Burndown ideal line.** Mock uses straight linear interpolation. For real data we could use story deadlines as targets. **Straight line OK for v1?**

3. **Cycle time definition.** Options:
   - `updated_at - created_at` for done tasks (easiest, but sensitive to reopens)
   - `first status→done transition - created_at` from changelog (accurate)
   - `first → done, excluding backlog time` (most meaningful)
   **Which?**

4. **Risk rules tunable?** Hardcode the thresholds for v1 or make them admin-configurable?

5. **Release / dependency / blocker authoring.** Who creates these? C-Level only, or any team lead within their region?

6. **Event markers on sparkline.** Do we auto-generate events from DB (e.g., detect release by bulk-done transitions) or require manual authoring via the new `/events` CRUD?

7. **Phase 4 priority.** If we need to ship incrementally: would you rather see Phase 4a (Releases) before 4b (Dependencies) and 4c (Events)?

---

## Suggested execution order

**Week 1:** Phase 1 + 2 + 3 (all analytics that work off existing tables). By end of week most of the board is real. Demo-label the 3 sections needing new entities.

**Week 2:** Phase 4 (new entities + admin UI). Phase 5 (caching) at the end.

**My recommendation:** Start with Phase 1 after you answer Q1–Q3 (sparkline strictness, burndown ideal, cycle definition). Q4–Q6 can be decided when Phase 4 starts.
