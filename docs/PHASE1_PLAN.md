# Phase 1 — Task Tracker Core: Detailed Implementation Plan

**Version:** 2.0
**Date:** 2026-04-09
**Duration:** ~1.5 недели
**Goal:** Рабочий Task Tracker с Kanban board, авторизацией, real-time обновлениями и мобильной адаптацией

---

## Overview

Phase 1 закладывает фундамент всего сервиса Command. По завершении команда сможет:
- Создавать Story → Task → Subtask
- Управлять задачами через Kanban-доску с drag-and-drop
- Работать с мобильного устройства с полным функционалом
- Видеть изменения коллег в реальном времени
- Входить через SSO с ролевым доступом

---

## Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| **Backend API** | Go (net/http + chi router) | Совместимость с QPDF API стеком; высокая производительность |
| **Database** | PostgreSQL 16 | Основное хранилище; Row-Level Security для RBAC |
| **Migrations** | golang-migrate | Версионирование схемы БД |
| **Cache / Pub-Sub** | Redis 7 | Сессии, кэш, pub/sub для WebSocket broadcast |
| **WebSocket** | gorilla/websocket | Real-time обновления Kanban-доски |
| **Frontend** | React 18 + TypeScript | Компонентный подход, типизация |
| **Styling** | Styled Components | Консистентность с QRT-порталом (тот же подход) |
| **State Management** | TanStack Query (React Query) | Server state, optimistic updates, cache invalidation |
| **DnD** | @dnd-kit/core | Лёгкий, accessible, touch-friendly drag-and-drop |
| **Icons** | React Icons (Feather: fi) | Консистентность с QRT-порталом |
| **Auth** | JWT (access + refresh) | Статeless аутентификация; SSO-ready |
| **Containerization** | Docker + docker-compose | Локальная разработка; деплой на GCP |

> **Важно:** Используем Styled Components вместо Tailwind — для визуальной и технической консистентности с QRT-порталом, который полностью построен на Styled Components.

---

## Design System — QRT Portal Alignment

Визуальный стиль Command полностью наследует дизайн-систему QRT-портала.

### Color Palette

```
PRIMARY
├── Charcoal:       #282928   — Header, Sidebar, Footer, основной текст
├── Vivid Orange:   #FF8D00   — CTA, активные состояния, акценты
├── Deep Orange:    #d67000   — Hover-состояния кнопок
└── Light Gray:     #F0F1F3   — Лёгкие фоны, disabled

SECONDARY
├── Davy's Gray:    #535352   — Вторичный текст
├── Cadet Gray:     #999FA0   — Мягкий текст, disabled
├── Silver:         #B2B8B8   — Разделители
└── Medium Gray:    #666666   — Вторичный текст, иконки

STATUS (для Task Tracker)
├── Backlog:        #9E9E9E   (Gray)
├── To Do:          #2196F3   (Blue)
├── In Progress:    #FF9800   (Amber)
├── In Review:      #9C27B0   (Purple)
├── Done:           #4CAF50   (Green)
└── Closed:         #666666   (Dark Gray)

PRIORITY
├── Critical:       #F44336   (Red)
├── High:           #FF9800   (Orange)
├── Medium:         #2196F3   (Blue)
└── Low:            #4CAF50   (Green)

UI
├── White:          #FFFFFF   — Фоны карточек, модальных окон
├── Border:         #E5E7EB   — Разделители, рамки форм
├── Background:     #F9FAFB   — Фон страниц
├── Error:          #F44336
├── Success:        #4CAF50
├── Warning:        #FF9800
└── Info:           #2196F3
```

### Typography

```
FONTS
├── Primary:    "Barlow", sans-serif     — Заголовки, брендинг
└── Secondary:  "Inter", sans-serif      — Тело текста, UI элементы

SIZES
├── xs:     12px   — Метки, бейджи
├── sm:     14px   — Лейблы форм, вторичный текст
├── md:     16px   — Основной текст
├── lg:     18px   — Подзаголовки
├── xl:     20px   — Заголовки карточек/модалей
├── 2xl:    24px   — Заголовки страниц
└── 3xl:    32px   — Крупные заголовки

WEIGHTS
├── Regular:   400
├── Medium:    500
├── Semibold:  600
└── Bold:      700
```

### Spacing System

```
xs:   4px   — Микрозазоры, padding бейджей
sm:   8px   — Малые зазоры, gap форм
md:   16px  — Дефолтный padding
lg:   24px  — Padding карточек, секций
xl:   32px  — Крупные секции, модальные окна
2xl:  48px  — Отступы на уровне страниц
```

### Component Styles (наследуемые от QRT-портала)

**Карточки:**
```
Background:     #FFFFFF
Border:         1px solid #E5E7EB
Border Radius:  12px
Padding:        24px
Shadow:         0 2px 10px rgba(12, 23, 41, 0.08)
Hover Shadow:   0 6px 18px rgba(12, 23, 41, 0.12)
Hover Transform: translateY(-2px)
Transition:     all 0.2s ease
```

**Кнопки (Primary):**
```
Background:     #FF8D00
Color:          #FFFFFF
Padding:        12px 24px
Border Radius:  8px
Font Weight:    600
Hover BG:       #d67000
Hover Transform: translateY(-1px)
Hover Shadow:   0 4px 8px rgba(255, 141, 0, 0.3)
```

**Кнопки (Secondary):**
```
Background:     #FFFFFF
Border:         1px solid #E5E7EB
Color:          #282928
Hover BG:       #E5E7EB
```

**Инпуты:**
```
Padding:        8px 16px
Border:         1px solid #E5E7EB
Border Radius:  8px
Font Size:      14px
Focus Border:   #FF8D00
Placeholder:    #666666
```

**Модальные окна:**
```
Overlay:        rgba(0, 0, 0, 0.5)
Background:     #FFFFFF
Border Radius:  16px
Max Width:      900px
Shadow:         0 14px 28px rgba(0,0,0,0.25)
Header:         24px 32px padding, border-bottom
```

**Sidebar:**
```
Width (expanded):  260px
Width (collapsed): 70px
Background:        #282928
Active item:       rgba(255, 141, 0, 0.15) bg + 3px left orange border
Text:              white at 80% opacity
Transition:        width 0.3s ease
```

---

## Interface Specification

### Page Structure

```
┌─────────────────────────────────────────────────┐
│                 HEADER (56px)                    │
│  [☰] [Command logo]      [🔍] [🔔] [Avatar ▾] │
└─────────────────────────────────────────────────┘
┌──────────┬──────────────────────────────────────┐
│          │  BOARD TOOLBAR                        │
│ SIDEBAR  │  [Story ▾] [Assignee ▾] [Priority ▾] │
│  260px   │  [Search...] [+ New Task]             │
│          ├──────────────────────────────────────┤
│ My Tasks │                                      │
│ Board    │  KANBAN COLUMNS                      │
│ Stories  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│ ──────── │  │Back │ │To Do│ │In   │ │Done │   │
│ Projects │  │log  │ │     │ │Prog │ │     │   │
│ Team     │  │     │ │     │ │     │ │     │   │
│          │  │[card]│ │[card]│ │[card]│ │[card]│   │
│          │  │[card]│ │[card]│ │     │ │     │   │
│          │  └─────┘ └─────┘ └─────┘ └─────┘   │
│          │                                      │
│          │              ┌─────────────────────┐ │
│          │              │  TASK DETAIL PANEL   │ │
│          │              │  (slide-over, 480px) │ │
│          │              │                     │ │
│          │              │  Title              │ │
│          │              │  Status | Priority  │ │
│          │              │  Assignee | Deadline│ │
│          │              │  ─────────────────  │ │
│          │              │  Description        │ │
│          │              │  ─────────────────  │ │
│          │              │  Subtasks (3/7)     │ │
│          │              │  □ Subtask 1        │ │
│          │              │  ☑ Subtask 2        │ │
│          │              └─────────────────────┘ │
└──────────┴──────────────────────────────────────┘
```

### Desktop Layout (>1024px)

**Sidebar Navigation (260px, collapsible to 70px):**
- Стиль идентичен QRT-порталу
- Sections:
  - **My Tasks** — личные задачи текущего пользователя
  - **Board** — Kanban-доска (основной вид)
  - **Stories** — список всех стори
  - Separator
  - **Projects** — фильтр по проектам (из модуля Projects)
  - **Team** — фильтр по людям (из модуля People/HR)
- Active state: orange left border (3px) + `rgba(255, 141, 0, 0.15)` bg

**Board Toolbar:**
- Фильтры в виде горизонтальных chips (Story, Assignee, Priority)
- Каждый chip — dropdown при клике, заполненный/цветной при активном фильтре, с "×" для сброса
- Поисковая строка (Cmd+K для command palette)
- Кнопка "+ New Task" (primary orange)
- Переключатель swimlanes: Flat / By Story / By Assignee

**Kanban Columns:**
- 5 колонок: Backlog, To Do, In Progress, In Review, Done
- Ширина каждой: ~240-280px, flex-grow
- Заголовок колонки: название + цветная точка статуса + количество карточек
- WIP limit: отображается как "(3/5)" рядом с количеством, колонка подсвечивается amber при превышении
- Скролл: вертикальный внутри каждой колонки
- При 30+ карточках: виртуальный скролл (react-window)
- Empty state: пунктирная рамка + "No tasks" + призрачная кнопка "+ Add task"

**Task Card (в колонке):**
```
┌──────────────────────────┐
│ PROJ-123            [!]  │  ← ID + Priority icon
│ Fix authentication bug   │  ← Title (1-2 строки, truncate)
│                          │
│ [Frontend] [Bug]         │  ← Labels (max 2-3 pills)
│                          │
│ 📅 Apr 15    👤 [avatar] │  ← Deadline + Assignee
│ ▓▓▓▓▓░░░░░ 3/7          │  ← Subtask progress bar
└──────────────────────────┘
```

- Background: white
- Border: 1px solid #E5E7EB
- Border radius: 8px
- Padding: 12px 16px
- Shadow: 0 1px 3px rgba(0,0,0,0.08)
- Hover: shadow + translateY(-1px)
- Drag state: shadow elevates, opacity 0.9, scale 1.02
- **Priority indicator**: 4px left border stripe в цвет приоритета
- **Deadline**: красный текст если просрочена, amber если < 2 дней

**Task Detail Panel (slide-over, 480px):**
- Slide-in справа, поверх доски (desktop)
- Full-screen на mobile
- Backdrop: semi-transparent
- Закрытие: Escape, клик по backdrop, кнопка "×"
- Содержимое:
  - **Title** (editable inline, 20px bold)
  - **Metadata row**: Status badge | Priority badge | Assignee (avatar + name) | Deadline (date picker)
  - **Separator**
  - **Description** (rich text, placeholder "Add description...")
  - **Separator**
  - **Subtasks section**: progress bar + count + list с чекбоксами + "+ Add subtask" inline
  - *(Activity/Comments — Phase 2)*

### Tablet Layout (768-1024px)

- Sidebar collapsed to 70px (icons only), expand on hover
- Kanban: 3-4 видимых колонки, горизонтальный скролл для остальных
- Task detail: модальное окно вместо side panel (70% ширины)
- Toolbar filters: scrollable horizontal chips

### Mobile Layout (<768px)

```
┌─────────────────────────┐
│ HEADER (56px)           │
│ [☰] Command    [🔍] [🔔]│
├─────────────────────────┤
│ BOARD TOOLBAR           │
│ ← [Backlog] [To Do]    │
│   [In Progress] [Done] →│  ← Scrollable status tabs
├─────────────────────────┤
│                         │
│ ┌─────────────────────┐ │
│ │ PROJ-123        [!] │ │
│ │ Fix auth bug        │ │
│ │ 📅 Apr 15  👤 [ava] │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ PROJ-124        [!] │ │
│ │ Update landing page │ │
│ │ 📅 Apr 18  👤 [ava] │ │
│ └─────────────────────┘ │
│                         │
│ ... (vertical scroll)   │
│                         │
│              [+ FAB]    │  ← Floating Action Button
├─────────────────────────┤
│ BOTTOM NAV              │
│ [📋 Tasks] [📊 Board]   │
│ [📁 Stories] [⚙️ More]  │
└─────────────────────────┘
```

**Navigation: Bottom Tab Bar (4 tabs)**
- **My Tasks** — список личных задач, сгруппированных по статусу
- **Board** — Kanban (scrollable tabs по статусам)
- **Stories** — список стори
- **More** — профиль, настройки, выход

Стиль bottom nav:
```
Height:      56px
Background:  #FFFFFF
Border Top:  1px solid #E5E7EB
Active Icon: #FF8D00 (vivid orange)
Inactive:    #999FA0 (cadet gray)
Font Size:   11px
Icon Size:   22px
```

**Kanban на мобильном:**
- Горизонтальные tabs-переключатели статусов вместо колонок
- Каждая "вкладка" = одна колонка
- Внутри: вертикальный список карточек
- Свайп карточки вправо → quick action sheet (смена статуса, назначить, приоритет)
- Pull-to-refresh

**Quick Capture (FAB):**
- Позиция: bottom-right, 16px от краёв, над bottom nav
- Размер: 56px круг
- Цвет: #FF8D00 (vivid orange)
- Shadow: 0 4px 12px rgba(255, 141, 0, 0.4)
- При нажатии → bottom sheet:
  ```
  ┌─────────────────────────┐
  │ Quick Create Task       │
  │                         │
  │ [Task title...        ] │
  │                         │
  │ [Story ▾] [👤 ▾] [! ▾] │  ← Optional quick-set
  │                         │
  │ [Cancel]    [Create ➜]  │
  └─────────────────────────┘
  ```
  - Минимум: только Title + Enter = создать
  - Опционально: Story, Assignee, Priority (одна строка быстрых пикеров)
  - Story автоматически подставляется если доска уже отфильтрована по стори

**Task Detail на мобильном:**
- Full-screen view (push navigation, не модальное окно)
- Навигация: "← Back" в header
- Все поля — tap to edit
- Subtasks: чекбоксы, "+ Add" внизу списка
- Status change: tap на badge → action sheet с вариантами

---

## Desktop ↔ Mobile: Functional Mapping

| Feature | Desktop | Mobile | Notes |
|---------|---------|--------|-------|
| **View board** | 5 колонок одновременно | Tabs по статусам | Полный функционал |
| **Move task** | Drag-and-drop | Swipe → action sheet | Тот же результат, разный UX |
| **Create task** | "+" кнопка → форма в side panel | FAB → bottom sheet | Mobile: minimal fields |
| **Edit task** | Side panel (480px) | Full-screen view | Все поля доступны |
| **Filter** | Chips в toolbar | Icon → bottom sheet | Те же фильтры |
| **Search** | Cmd+K command palette | Search tab в bottom nav | Одинаковые результаты |
| **Sidebar nav** | Fixed sidebar 260px | Bottom tab bar 56px | Те же разделы |
| **Subtasks** | Inline list в detail panel | Checkboxes в full-screen | Одинаково |
| **Reorder** | Drag внутри колонки | Long press + drag | Touch-friendly |
| **Quick actions** | Right-click context menu | Swipe-to-reveal | 2-3 действия |
| **Notifications** | Bell icon → dropdown | Bell icon → dropdown / push | Push на mobile |
| **Keyboard** | Cmd+K, J/K, Escape, 1-4 | N/A | Desktop only |

### Keyboard Shortcuts (Desktop, Phase 1)

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Command palette (поиск задач, навигация) |
| `C` | Create new task |
| `J` / `K` | Navigate down/up in card list |
| `Enter` | Open selected task |
| `Escape` | Close detail panel |
| `1`-`5` | Set status (Backlog, To Do, In Progress, In Review, Done) |
| `P` | Set priority |
| `A` | Set assignee |
| `/` | Focus filter bar |

---

## Scalability: Готовность к росту

### Phase 2+ Ready Architecture

Интерфейс Phase 1 спроектирован с учётом будущих расширений:

| Future Feature | How Phase 1 Prepares |
|---------------|---------------------|
| **Gantt/Timeline (Phase 2)** | Toolbar имеет место для переключателя видов: [Kanban] [Gantt] [Timeline] |
| **Comments (Phase 2)** | Task detail panel имеет секцию-заглушку для Activity/Comments |
| **Reports (Phase 3)** | Sidebar имеет placeholder для раздела "Reports" |
| **C-Level Board (Phase 4)** | Sidebar → "Dashboard" (скрыто для non-clevel ролей) |
| **AI Assistant (Phase 6)** | Cmd+K palette расширяется для NL queries |
| **Saved Views** | Filter chips architecture поддерживает сохранение комбинаций |
| **Custom Fields** | Task detail panel extensible: metadata section добавляется через конфиг |
| **Bulk Operations** | Desktop: Shift+Click для multi-select → bulk action bar |

### Component Architecture для роста

```
src/
├── components/
│   ├── ui/               # Atomic components (Button, Input, Badge, Avatar...)
│   ├── board/            # Kanban-specific (Board, Column, Card, DetailPanel)
│   ├── layout/           # Shell (Sidebar, Header, MobileNav, BottomSheet)
│   ├── forms/            # Task/Story forms, QuickCapture
│   └── shared/           # Reusable composed components (FilterBar, CommandPalette)
├── hooks/                # Custom hooks (useWebSocket, useAuth, useBoardData)
├── lib/                  # Utilities (api client, ws client, lexorank)
├── styles/
│   └── theme.ts          # Design tokens (mirror QRT portal theme.ts)
└── types/                # TypeScript interfaces
```

**theme.ts** — единый источник всех дизайн-токенов, зеркалирует структуру QRT-портала:
```ts
export const theme = {
  colors: {
    charcoal: '#282928',
    vividOrange: '#FF8D00',
    deepOrange: '#d67000',
    // ... полная палитра
    status: {
      backlog: '#9E9E9E',
      todo: '#2196F3',
      inProgress: '#FF9800',
      inReview: '#9C27B0',
      done: '#4CAF50',
      closed: '#666666',
    },
    priority: {
      critical: '#F44336',
      high: '#FF9800',
      medium: '#2196F3',
      low: '#4CAF50',
    },
  },
  typography: { /* ... */ },
  spacing: { /* ... */ },
  shadows: { /* ... */ },
  breakpoints: {
    xs: '480px',
    sm: '768px',
    md: '1024px',
    lg: '1200px',
    xl: '1440px',
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    round: '50%',
  },
};
```

---

## Project Structure

```
TaskM/
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go                 # Entry point
│   ├── internal/
│   │   ├── config/                     # App configuration
│   │   ├── middleware/
│   │   │   ├── auth.go                 # JWT validation
│   │   │   ├── cors.go                 # CORS policy
│   │   │   └── rbac.go                 # Role-based access
│   │   ├── handler/
│   │   │   ├── story.go                # Story CRUD endpoints
│   │   │   ├── task.go                 # Task CRUD endpoints
│   │   │   ├── subtask.go              # Subtask CRUD endpoints
│   │   │   ├── board.go                # Kanban board endpoints
│   │   │   └── auth.go                 # Login/refresh/logout
│   │   ├── model/
│   │   │   ├── story.go
│   │   │   ├── task.go
│   │   │   ├── subtask.go
│   │   │   └── user.go
│   │   ├── repository/
│   │   │   ├── story_repo.go
│   │   │   ├── task_repo.go
│   │   │   └── subtask_repo.go
│   │   ├── service/
│   │   │   ├── story_service.go
│   │   │   ├── task_service.go
│   │   │   └── auth_service.go
│   │   └── ws/
│   │       ├── hub.go                  # WebSocket hub (broadcast)
│   │       └── client.go               # WebSocket client handler
│   ├── migrations/
│   │   ├── 001_create_users.up.sql
│   │   ├── 001_create_users.down.sql
│   │   ├── 002_create_stories.up.sql
│   │   ├── 003_create_tasks.up.sql
│   │   ├── 004_create_subtasks.up.sql
│   │   └── 005_rls_policies.up.sql
│   ├── go.mod
│   └── go.sum
├── frontend/
│   ├── src/
│   │   ├── app/                        # Pages / routing
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                # Dashboard / redirect
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── board/
│   │   │       ├── page.tsx            # Kanban board
│   │   │       └── [storyId]/
│   │   │           └── page.tsx        # Story detail
│   │   ├── components/
│   │   │   ├── ui/                     # Atomic: Button, Input, Badge, Avatar, etc.
│   │   │   ├── board/
│   │   │   │   ├── KanbanBoard.tsx     # Main board component
│   │   │   │   ├── KanbanColumn.tsx    # Single column (desktop) / status tab (mobile)
│   │   │   │   ├── TaskCard.tsx        # Task card in column
│   │   │   │   └── TaskDetail.tsx      # Side panel (desktop) / full screen (mobile)
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx        # Main layout wrapper
│   │   │   │   ├── Sidebar.tsx         # Desktop sidebar nav (260px/70px)
│   │   │   │   ├── Header.tsx          # Top header (56px)
│   │   │   │   ├── MobileNav.tsx       # Bottom tab bar (56px)
│   │   │   │   └── BottomSheet.tsx     # Reusable bottom sheet (mobile)
│   │   │   ├── forms/
│   │   │   │   ├── CreateStory.tsx
│   │   │   │   ├── CreateTask.tsx
│   │   │   │   └── QuickCapture.tsx    # FAB + bottom sheet (mobile)
│   │   │   └── shared/
│   │   │       ├── FilterBar.tsx       # Horizontal chips filter
│   │   │       ├── CommandPalette.tsx   # Cmd+K dialog
│   │   │       └── Toast.tsx           # Notifications (QRT-style)
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts         # WS connection + reconnect
│   │   │   ├── useAuth.ts              # Auth state + tokens
│   │   │   ├── useBoardData.ts         # Board data + optimistic updates
│   │   │   ├── useMediaQuery.ts        # Responsive breakpoint detection
│   │   │   └── useKeyboardShortcuts.ts # Global shortcuts
│   │   ├── lib/
│   │   │   ├── api.ts                  # HTTP client (fetch wrapper)
│   │   │   ├── ws.ts                   # WebSocket client
│   │   │   └── lexorank.ts             # Fractional indexing for DnD
│   │   ├── styles/
│   │   │   ├── theme.ts                # Design tokens (mirrors QRT portal)
│   │   │   └── GlobalStyle.ts          # Global CSS reset + fonts
│   │   └── types/
│   │       └── index.ts                # TypeScript interfaces
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
├── docs/
│   ├── concept.pdf
│   ├── CONCEPT_UPDATED.md
│   └── PHASE1_PLAN.md
└── README.md
```

---

## Database Schema (Phase 1)

### Users (синхронизация с People/HR)

```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id   VARCHAR(255) UNIQUE,          -- ID из People/HR модуля
    email         VARCHAR(255) UNIQUE NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    role          VARCHAR(50) NOT NULL DEFAULT 'member',
                  -- 'clevel', 'team_lead', 'member', 'trainee'
    avatar_url    TEXT,
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### Stories

```sql
CREATE TABLE stories (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title         VARCHAR(500) NOT NULL,
    description   TEXT,                          -- Rich text (HTML/Markdown)
    status        VARCHAR(50) NOT NULL DEFAULT 'backlog',
                  -- backlog, todo, in_progress, in_review, done, closed
    progress      SMALLINT DEFAULT 0,            -- 0-100, auto-calculated
    priority      VARCHAR(20) NOT NULL DEFAULT 'medium',
                  -- critical, high, medium, low
    project_id    VARCHAR(255),                  -- FK к модулю Projects
    created_by    UUID REFERENCES users(id),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### Tasks

```sql
CREATE TABLE tasks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id      UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    title         VARCHAR(500) NOT NULL,
    description   TEXT,
    status        VARCHAR(50) NOT NULL DEFAULT 'backlog',
    progress      SMALLINT DEFAULT 0,
    priority      VARCHAR(20) NOT NULL DEFAULT 'medium',
    assignee_id   UUID REFERENCES users(id),
    start_date    DATE,
    deadline      DATE,
    position      VARCHAR(255) NOT NULL,         -- LexoRank for ordering
    created_by    UUID REFERENCES users(id),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_story ON tasks(story_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_position ON tasks(position);
```

### Subtasks

```sql
CREATE TABLE subtasks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title         VARCHAR(500) NOT NULL,
    description   TEXT,
    status        VARCHAR(50) NOT NULL DEFAULT 'backlog',
    progress      SMALLINT DEFAULT 0,
    assignee_id   UUID REFERENCES users(id),
    start_date    DATE,
    deadline      DATE,
    position      VARCHAR(255) NOT NULL,
    created_by    UUID REFERENCES users(id),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subtasks_task ON subtasks(task_id);
```

### Row-Level Security

```sql
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_clevel_full ON tasks
    FOR ALL TO authenticated
    USING (current_setting('app.user_role') IN ('clevel', 'team_lead'));

CREATE POLICY tasks_member_own ON tasks
    FOR ALL TO authenticated
    USING (
        current_setting('app.user_role') = 'member'
        AND (assignee_id = current_setting('app.user_id')::uuid
             OR created_by = current_setting('app.user_id')::uuid)
    );

CREATE POLICY tasks_trainee_assigned ON tasks
    FOR SELECT TO authenticated
    USING (
        current_setting('app.user_role') = 'trainee'
        AND assignee_id = current_setting('app.user_id')::uuid
    );
```

---

## API Endpoints (Phase 1)

### Auth
```
POST   /api/v1/auth/login          # Login (email + password or SSO token)
POST   /api/v1/auth/refresh         # Refresh JWT
POST   /api/v1/auth/logout          # Invalidate refresh token
GET    /api/v1/auth/me              # Current user info
```

### Stories
```
GET    /api/v1/stories              # List stories (filters: status, priority, project_id)
POST   /api/v1/stories              # Create story
GET    /api/v1/stories/:id          # Get story with tasks
PUT    /api/v1/stories/:id          # Update story
DELETE /api/v1/stories/:id          # Delete story (soft delete)
```

### Tasks
```
GET    /api/v1/stories/:storyId/tasks       # List tasks for a story
POST   /api/v1/stories/:storyId/tasks       # Create task
GET    /api/v1/tasks/:id                     # Get task with subtasks
PUT    /api/v1/tasks/:id                     # Update task
DELETE /api/v1/tasks/:id                     # Delete task
PATCH  /api/v1/tasks/:id/status              # Change status (triggers WS broadcast)
PATCH  /api/v1/tasks/:id/position            # Reorder (LexoRank update)
GET    /api/v1/tasks/my                      # My tasks (across all stories)
```

### Subtasks
```
GET    /api/v1/tasks/:taskId/subtasks        # List subtasks
POST   /api/v1/tasks/:taskId/subtasks        # Create subtask
PUT    /api/v1/subtasks/:id                  # Update subtask
DELETE /api/v1/subtasks/:id                  # Delete subtask
PATCH  /api/v1/subtasks/:id/status           # Change status
```

### Board
```
GET    /api/v1/board                         # Full board data (grouped by status)
GET    /api/v1/board?assignee=:id            # Filtered by assignee
GET    /api/v1/board?priority=:level         # Filtered by priority
GET    /api/v1/board?story=:id               # Filtered by story
```

### WebSocket
```
WS     /ws                                   # Real-time board updates
```

**WS Message format:**
```json
{
  "type": "task.updated",
  "payload": {
    "id": "uuid",
    "status": "in_progress",
    "position": "0|hzzzzz:",
    "updated_by": "uuid"
  }
}
```

---

## Optimistic Updates & Real-time

### Drag-and-Drop Flow
```
User drags card → UI updates immediately (optimistic)
                → API call (PATCH /tasks/:id/status + position)
                → Success: confirm state
                → Failure: revert card + show toast (QRT-style, slide-in top-center)
```

TanStack Query `useMutation` с `onMutate` (optimistic) + `onError` (rollback) + `onSettled` (refetch).

### WebSocket Flow
```
Connect on mount → authenticate via JWT → subscribe to board channel
Receive event → invalidate relevant TanStack Query cache keys
Reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
Show "Reconnecting..." banner below header when disconnected
```

### LexoRank Ordering
- Каждая карточка имеет `position` (строковый ранг)
- При перемещении: вычисляем новый ранг между соседними карточками
- Не требует пересчёта позиций всех карточек в колонке
- Rebalancing: если ранги "сжимаются" (< 1 символ разницы), batch rebalance колонки

---

## Implementation Steps

### Step 1: Project Setup (Day 1)
- [ ] Init Go module, project structure, docker-compose (PostgreSQL + Redis)
- [ ] Init React project (Vite + TypeScript + Styled Components)
- [ ] Создать `theme.ts` с полной палитрой QRT-портала
- [ ] Создать `GlobalStyle.ts` (reset + Barlow/Inter fonts)
- [ ] Configure ESLint, Prettier, Go linter
- [ ] Docker-compose with hot reload for both services

### Step 2: Database & Models (Day 1-2)
- [ ] Write migration files (users, stories, tasks, subtasks)
- [ ] Implement Go models with validation
- [ ] Setup database connection pool (pgxpool)
- [ ] Implement repository layer (CRUD operations)
- [ ] Seed script с тестовыми данными

### Step 3: Auth & Middleware (Day 2-3)
- [ ] JWT generation (access token 15min + refresh token 7d)
- [ ] Auth middleware (validate JWT, extract user context)
- [ ] RBAC middleware (role check per endpoint)
- [ ] CORS middleware (allow command.qrt-platform.com)
- [ ] Set PostgreSQL session variables for RLS
- [ ] Login endpoint (email/password, SSO-ready interface)

### Step 4: Core API (Day 3-5)
- [ ] Story CRUD handlers + service layer
- [ ] Task CRUD handlers + service layer
- [ ] Subtask CRUD handlers + service layer
- [ ] Board endpoint (aggregated view grouped by status)
- [ ] Filtering & pagination
- [ ] Position management (LexoRank) for task ordering
- [ ] Input validation & error responses (consistent JSON)

### Step 5: WebSocket Server (Day 5-6)
- [ ] WebSocket hub (connection management, rooms per board)
- [ ] Client handler (auth on connect, heartbeat/ping-pong)
- [ ] Broadcast on task changes (create/update/delete/move)
- [ ] Redis pub/sub for multi-instance support

### Step 6: Frontend — Layout & Auth (Day 5-6)
- [ ] AppShell: Header (56px) + Sidebar (260px/70px) + Content
- [ ] Sidebar с навигацией (стиль QRT-портала: charcoal bg, orange active state)
- [ ] Header с logo, search icon, notifications bell, user avatar
- [ ] MobileNav: Bottom tab bar (My Tasks, Board, Stories, More)
- [ ] Login page (стиль QRT-портала)
- [ ] Auth context (token storage, auto-refresh, redirect)
- [ ] Protected routes
- [ ] Responsive: useMediaQuery hook + conditional rendering

### Step 7: Frontend — Kanban Board (Day 6-8)
- [ ] KanbanBoard: desktop = columns, mobile = status tabs
- [ ] KanbanColumn: droppable zone, header с count + WIP indicator
- [ ] TaskCard: ID, title, priority stripe, assignee avatar, deadline, subtask progress
- [ ] Drag-and-drop (@dnd-kit): touch + mouse + keyboard
- [ ] Optimistic updates on drag (TanStack Query mutations)
- [ ] FilterBar: horizontal chips (Story, Assignee, Priority, Search)
- [ ] Mobile: swipe-to-reveal quick actions on cards
- [ ] Empty states: dashed border + "No tasks" + ghost "+ Add" button
- [ ] Virtual scroll for columns with 30+ cards (react-window)

### Step 8: Frontend — Task Management (Day 8-9)
- [ ] TaskDetail: side panel 480px (desktop) / full-screen (mobile)
- [ ] Inline title editing
- [ ] Metadata row: Status badge, Priority badge, Assignee picker, Date picker
- [ ] Description: textarea with markdown support
- [ ] Subtask list: checkboxes, progress bar, inline "+ Add subtask"
- [ ] Create/Edit Story form (modal)
- [ ] Create/Edit Task form (side panel)
- [ ] QuickCapture: FAB (56px, orange) → bottom sheet с title + optional pickers
- [ ] BottomSheet: reusable component for mobile forms/actions

### Step 9: Command Palette & Shortcuts (Day 9)
- [ ] CommandPalette (Cmd+K): overlay, search input, categorized results
- [ ] Global keyboard shortcuts (useKeyboardShortcuts hook)
- [ ] Navigation shortcuts: J/K, Enter, Escape
- [ ] Action shortcuts: C (create), 1-5 (status), P (priority), A (assignee)

### Step 10: WebSocket Integration & Real-time (Day 9-10)
- [ ] useWebSocket hook (connect, auth, reconnect, parse messages)
- [ ] Board real-time updates (invalidate React Query cache on WS event)
- [ ] Connection status: "Reconnecting..." banner below header
- [ ] Stale data detection: highlight cards updated by others

### Step 11: Testing & Polish (Day 10-11)
- [ ] Go: unit tests для service layer, integration tests для handlers
- [ ] Frontend: component tests (Vitest + Testing Library)
- [ ] E2E smoke test (Playwright: login → create story → create task → drag)
- [ ] Mobile testing: iOS Safari, Android Chrome
- [ ] Performance: <100ms DnD feedback, <500ms page load
- [ ] Accessibility: keyboard nav, focus management, ARIA labels
- [ ] QRT visual consistency check: compare with portal screenshots

---

## Definition of Done (Phase 1)

- [ ] Пользователь может залогиниться и увидеть Kanban-доску
- [ ] CRUD для Story / Task / Subtask работает
- [ ] Drag-and-drop меняет статус задачи и сохраняет на сервере
- [ ] Изменения видны другим пользователям в реальном времени (WebSocket)
- [ ] Мобильная версия полнофункциональна: tabs по статусам, FAB, bottom sheet, swipe actions
- [ ] Desktop: side panel, DnD, filter chips, Cmd+K, keyboard shortcuts
- [ ] Роли работают: Team Lead видит всё, Member — свои задачи, Trainee — назначенные
- [ ] Визуальный стиль соответствует QRT-порталу (цвета, шрифты, компоненты)
- [ ] Нет критических багов, приложение стабильно
- [ ] Docker-compose поднимает всё одной командой
