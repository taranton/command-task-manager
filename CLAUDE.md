# CLAUDE.md — Command Task Manager

## Project Context
- **Command** — Task management service for QRT Digital Platform
- **Stack**: Go backend (chi router), React frontend (TypeScript, Styled Components), PostgreSQL, Redis
- **Live**: https://command-test.qrtpower.com
- **Repo**: https://github.com/taranton/command-task-manager

## Coding Principles (Karpathy-inspired)

### 1. Think Before Coding
- State assumptions explicitly. If uncertain, ask.
- If multiple approaches exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
- Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code.
- If you write 200 lines and it could be 50, rewrite it.
- Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes
- Touch only what you must. Don't "improve" adjacent code.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- Every changed line should trace directly to the user's request.
- Remove only what YOUR changes made unused.

### 4. Goal-Driven Execution
- Define success criteria before coding.
- For multi-step tasks, state a brief plan with verification steps.
- Build → verify → iterate. Don't ship without checking.

## Project-Specific Rules

### Backend (Go)
- All endpoints under `/api/v1/`
- Use PATCH for updates (not PUT)
- Entity-specific statuses: StoryStatus, TaskStatus, SubtaskStatus
- Cascade automation: child status changes propagate upward
- ChangeLog: log every status change to command_changelog
- board_members table for many-to-many board membership
- Regions: users and boards belong to regions for data isolation

### Frontend (React + TypeScript)
- Styled Components (NOT Tailwind) — matches QRT portal design system
- Theme from `src/styles/theme.ts` — always use theme tokens
- TanStack Query for server state
- DnD: @dnd-kit with closestCenter collision detection
- Three views: Kanban, Backlog (table), Timeline (gantt)
- Status types split: StoryStatus, TaskStatus, SubtaskStatus

### Database
- Tables: stories, tasks, subtasks, users, teams (boards), board_members, regions
- command_comments, command_attachments, command_changelog
- Soft delete for stories/tasks (deleted_at), hard delete for subtasks
- sort_order INTEGER for ordering (not VARCHAR position)

### Deploy
- Server: command-test.qrtpower.com (GCP, nginx, pm2)
- Script: `./scripts/deploy.sh` handles migration + build + restart
- Always GRANT permissions to `command` user for new tables

### DnD Rules (hard-learned)
- NEVER put non-sortable elements inside SortableContext
- Cross-column drag: always place at END of target column
- Same-column reorder: use closestCenter + arrayMove in onDragEnd
- Keep items state synced with board data when not dragging
