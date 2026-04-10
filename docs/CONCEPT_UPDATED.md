# Command — Task Management Service for QRT Digital Platform

## Updated Concept & Implementation Roadmap

**Version:** 1.1
**Date:** 2026-04-09
**Based on:** Original concept v1.0 (07.04.2026) + Industry best practices research

---

## 1. Vision

**Command** — отдельный защищённый сервис управления задачами, отчётности и исполнительного контроля. Работает как независимый субдомен QRT Digital Platform с повышенными требованиями к безопасности. Заменяет MS Planner как единую точку управления проектной работой компании.

### Ключевые принципы (обновлено с учётом best practices)

| Принцип | Описание |
|---------|----------|
| **Speed-first** | Optimistic UI, <100ms визуальный фидбэк на все действия (по примеру Linear) |
| **Responsive by default** | Desktop — основная рабочая среда; Mobile — триаж и быстрые обновления |
| **Progressive disclosure** | 3 уровня иерархии по умолчанию, сложность раскрывается по запросу |
| **Event-driven** | WebSocket для real-time, event bus для каскадных автоматизаций |
| **Security-first** | Отдельный субдомен, SSO/MFA, field-level permissions, полный audit log |
| **AI as assistant** | ИИ подсказывает и предупреждает, но решения принимает человек |

---

## 2. Architecture Overview

```
                    command.qrt-platform.com
                              |
                    ┌─────────┴─────────┐
                    │   Nginx / Traefik  │
                    │   (TLS 1.3, CORS)  │
                    └─────────┬─────────┘
                              |
              ┌───────────────┼───────────────┐
              |               |               |
     ┌────────┴──────┐  ┌────┴────┐  ┌───────┴───────┐
     │  Frontend SPA  │  │   API   │  │  WebSocket    │
     │  (React/Next)  │  │  (Go)   │  │  Server (Go)  │
     └───────┬────────┘  └────┬────┘  └───────┬───────┘
             |               |               |
             └───────────────┼───────────────┘
                             |
              ┌──────────────┼──────────────┐
              |              |              |
         ┌────┴────┐  ┌─────┴────┐  ┌─────┴─────┐
         │PostgreSQL│  │  Redis   │  │  S3/GCS   │
         │  + RLS   │  │  Cache   │  │  Files    │
         └─────────┘  └──────────┘  └───────────┘
```

**Backend:** Go (совместимо с текущим стеком QPDF API)
**Frontend:** React + Next.js (SSR для SEO не нужен, но App Router для layout/routing)
**Database:** PostgreSQL с Row-Level Security для изоляции данных по ролям
**Cache:** Redis — кэш дашбордов, real-time pub/sub, сессии
**Storage:** GCS (основное) для файловых вложений
**Real-time:** WebSocket через отдельный Go-сервер

---

## 3. Four Subsystems (из оригинального концепта)

### 3.1 Task Tracker
Создание, управление и визуализация задач в иерархии **Story → Task → Subtask**.

**Views:** Kanban Board, Gantt/Roadmap, Timeline
**Automation:** Каскадное обновление статусов, автопрогресс
**Status flow:** `Backlog → To Do → In Progress → In Review → Done → Closed`

**Обновления по итогам ресерча:**
- WIP-лимиты на колонки Kanban (снижают cycle time на 20-30%)
- Fractional indexing (LexoRank) для drag-and-drop без переиндексации
- Swimlanes по исполнителю, приоритету, стори
- Quick capture на мобильных (FAB с минимальными полями)
- Swipe-жесты для смены статуса на мобильных

### 3.2 Reports Engine
Автоматическая генерация отчётов: утренние дайджесты, еженедельные и ежемесячные C-Level отчёты.

**Типы:** Morning Inbox Summary, Weekly Team Report, Monthly C-Level Report, AI Risk & Progress Analyst

**Обновления:**
- Materialized views для агрегированных метрик (не считать на лету)
- Фокус на flow-метриках (cycle time, throughput), а не vanity metrics
- Drill-down паттерн: портфель → проект → конкретный bottleneck

### 3.3 C-Level Board
KPI-дашборд с детализацией по задачам.

**KPI:** Team Velocity, Completion Rate, Overdue Rate, Burndown Chart, Resource Utilization

**Обновления:**
- Pre-aggregated tables + Redis cache (TTL 30-60s)
- Сравнение между офисами (Sussex, Krakow, Texas, Dubai)

### 3.4 Integrations Layer
MS Teams, WhatsApp/Telegram, AI Assistant.

**Обновления:**
- Webhook-интеграция с Teams API для call summary + task generation
- Deep linking с аутентификацией для перехода из мессенджеров
- NLP для извлечения action items из транскриптов

---

## 4. Security Model (расширено)

| Аспект | Решение |
|--------|---------|
| **Authentication** | SSO (SAML/OIDC) через QRT Platform + MFA enforcement |
| **Authorization** | RBAC (4 роли) + Row-Level Security в PostgreSQL |
| **Field-level access** | Sensitive fields скрыты на уровне API, не UI |
| **Audit** | Immutable append-only log всех изменений (actor, timestamp, old/new value) |
| **Encryption** | TLS 1.3 in transit, AES-256 at rest |
| **Isolation** | Отдельный субдомен, strict CORS, отдельная DB schema |
| **Sessions** | Short-lived tokens + refresh tokens, Redis session store |

**4 роли (из концепта):**
1. **C-Level / Director** — просмотр задач, все отчёты, полный доступ к C-Level Board
2. **Team Lead** — полный доступ к Task Tracker, создание отчётов, ограниченный C-Level Board
3. **Team Member** — свои + назначенные задачи, morning summary
4. **Trainee** — только назначенные задачи, morning summary

---

## 5. Data Model (из концепта, без изменений)

**Core entities:** Story, Task, Subtask, Comment, Mention, ChangeLog
**Integration entities:** CallSummary, Report
**Comment model:** polymorphic (entity_type: story/task/subtask + entity_id), поддержка @mentions с нотификацией упомянутых пользователей
**Relations:** Story ← Task ← Subtask; Comment/ChangeLog → polymorphic (entity_type + entity_id)

---

## 6. Implementation Phases (обновлённый roadmap)

### Phase 1 — Task Tracker Core (1.5 недели)
**Scope:** Фундамент всей системы
- Backend API: CRUD для Story/Task/Subtask
- Аутентификация и RBAC (базовый)
- Kanban Board (drag-and-drop, фильтры)
- Responsive layout (desktop + mobile)
- WebSocket для real-time обновлений доски
- Database schema + миграции

**Deliverable:** Рабочий Task Tracker с Kanban view, авторизацией и мобильной версией

---

### Phase 2 — Advanced Views & Automation (1 неделя)
**Scope:** Расширение визуализации
- Gantt / Roadmap view с зависимостями между задачами
- Timeline view с группировкой по командам/проектам
- Каскадная автоматизация статусов (event-driven)
- Автоматический расчёт прогресса
- Комментарии с вложениями (Story / Task / Subtask)
- @mentions — тегирование пользователей в комментариях с уведомлениями
- История изменений (ChangeLog)

**Deliverable:** Полнофункциональный Task Tracker со всеми views, комментариями и @mentions

---

### Phase 3 — Reports Engine + Document Storage (2 недели)
**Scope:** Автоматизация отчётности
- Morning Inbox Summary (push + мессенджеры)
- Weekly Team Report (PDF/HTML генерация)
- Document tree (folders, import/export)
- Интеграция с People/HR модулем для данных о команде
- Materialized views для агрегаций

**Deliverable:** Автоматические отчёты + хранение документов

---

### Phase 4 — C-Level Board (1 неделя)
**Scope:** Исполнительный дашборд
- KPI-панель (velocity, completion rate, overdue rate, burndown)
- Drill-down до конкретных задач
- Фильтры по проекту, команде, приоритету
- Экспорт данных для презентаций
- Redis-кэширование агрегаций

**Deliverable:** Executive Dashboard с KPI и детализацией

---

### Phase 5 — MS Teams Integration (1 неделя)
**Scope:** Связь со звонками
- Подключение AI к запланированным встречам
- Транскрипция и Call Summary
- Автоматическая генерация задач из action items
- Approve / Review / Change workflow для сгенерированных задач

**Deliverable:** Teams → Call Summary → Generated Tasks pipeline

---

### Phase 6 — Messengers + AI Risk Analyst (1 неделя)
**Scope:** Уведомления и прогнозная аналитика
- WhatsApp/Telegram уведомления (дедлайны, новые задачи)
- Deep linking из мессенджеров в платформу
- AI Risk & Progress Analyst (прогнозы, алерты, рекомендации)
- Monthly C-Level Report с AI-аналитикой
- Natural language queries через AI Assistant

**Deliverable:** Полная интеграция с мессенджерами + AI-аналитика

---

### Общая оценка: ~7-8 недель

```
Week  1  ──── Phase 1: Task Tracker Core ────────────
Week  2  ──── Phase 1 (finish) + Phase 2: Views ────
Week  3  ──── Phase 2 (finish) ──────────────────────
Week  4  ──── Phase 3: Reports Engine ───────────────
Week  5  ──── Phase 3 (finish) ──────────────────────
Week  6  ──── Phase 4: C-Level Board ───────────────
Week  7  ──── Phase 5: Teams Integration ────────────
Week  8  ──── Phase 6: Messengers + AI ──────────────
```

---

## 7. Risks & Mitigations (обновлено)

| Риск | Влияние | Митигация |
|------|---------|-----------|
| Зависимость от AI Assistant модуля | Высокое | Phase 1-4 независимы от AI; параллельная разработка |
| Сложность Teams API | Среднее | Ранний прототип интеграции в Phase 2; резерв времени |
| Объём данных для C-Level Board | Среднее | Materialized views + Redis cache с самого начала |
| Принятие командой (adoption) | Высокое | Поэтапный переход с MS Planner; обучение; UX лучше чем у Planner |
| **Перегрузка UI на мобильных** | **Среднее** | **Progressive disclosure; Quick capture; Swipe-жесты** |
| **Real-time конфликты при совместной работе** | **Среднее** | **Optimistic UI + CRDT для rich text; last-write-wins для простых полей** |

---

*Документ подготовлен на основе оригинального концепта v1.0 и исследования лучших практик (Linear, Asana, Jira, ClickUp, Monday.com, Notion). Далее следует детальный план Phase 1.*
