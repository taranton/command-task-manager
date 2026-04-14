package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/qrt/command/internal/config"
	"github.com/qrt/command/internal/handler"
	"github.com/qrt/command/internal/middleware"
	"github.com/qrt/command/internal/repository"
	"github.com/qrt/command/internal/service"
	"github.com/qrt/command/internal/ws"
)

func main() {
	cfg := config.Load()

	// Database
	db, err := repository.NewDB(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	// Redis
	rdb := repository.NewRedis(cfg.RedisURL)
	defer rdb.Close()

	// Repositories
	userRepo := repository.NewUserRepository(db)
	teamRepo := repository.NewTeamRepository(db)
	storyRepo := repository.NewStoryRepository(db)
	taskRepo := repository.NewTaskRepository(db)
	subtaskRepo := repository.NewSubtaskRepository(db)

	// Services
	changelog := service.NewChangeLogger(db)
	authService := service.NewAuthService(userRepo, cfg.JWTSecret, rdb)
	storyService := service.NewStoryService(storyRepo)
	taskService := service.NewTaskService(taskRepo, subtaskRepo, storyRepo, changelog)

	// WebSocket hub
	hub := ws.NewHub(rdb)
	go hub.Run()

	// Handlers
	authHandler := handler.NewAuthHandler(authService, userRepo)
	userHandler := handler.NewUserHandler(userRepo)
	teamHandler := handler.NewTeamHandler(teamRepo)
	adminHandler := handler.NewAdminHandler(db, userRepo)
	storyHandler := handler.NewStoryHandler(storyService)
	taskHandler := handler.NewTaskHandler(taskService, hub)
	subtaskHandler := handler.NewSubtaskHandler(taskService, hub)
	commentRepo := repository.NewCommentRepository(db)
	commentHandler := handler.NewCommentHandler(commentRepo)
	boardHandler := handler.NewBoardHandler(taskService, storyService)
	wsHandler := handler.NewWSHandler(hub, authService)

	// Router
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Timeout(30 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Public routes
	r.Post("/api/v1/auth/login", authHandler.Login)
	r.Post("/api/v1/auth/refresh", authHandler.Refresh)
	r.Post("/api/v1/auth/register", authHandler.Register)

	// WebSocket (auth via query param token)
	r.Get("/ws", wsHandler.HandleConnect)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.Auth(cfg.JWTSecret))

		// Auth
		r.Post("/api/v1/auth/logout", authHandler.Logout)
		r.Get("/api/v1/auth/me", authHandler.Me)

		// Users
		r.Get("/api/v1/users", userHandler.List)

		// Teams
		r.Get("/api/v1/teams", teamHandler.List)
		r.Get("/api/v1/teams/{id}", teamHandler.Get)
		r.Post("/api/v1/teams", adminHandler.CreateTeam)
		r.Put("/api/v1/teams/{id}", adminHandler.UpdateTeam)
		r.Get("/api/v1/teams/{id}/members", adminHandler.GetTeamMembers)

		// Admin: user management
		r.Get("/api/v1/users/pending", adminHandler.ListPending)
		r.Patch("/api/v1/users/{id}/role", adminHandler.UpdateUserRole)
		r.Patch("/api/v1/users/{id}/team", adminHandler.AssignUserToTeam)
		r.Post("/api/v1/users/{id}/remove-from-board", adminHandler.RemoveFromBoard)
		r.Get("/api/v1/users/{id}/boards", adminHandler.GetUserBoards)
		r.Post("/api/v1/users/{id}/approve", adminHandler.ApproveUser)
		r.Post("/api/v1/users/{id}/reject", adminHandler.RejectUser)

		// Stories
		r.Get("/api/v1/stories", storyHandler.List)
		r.Post("/api/v1/stories", storyHandler.Create)
		r.Get("/api/v1/stories/{id}", storyHandler.Get)
		r.Patch("/api/v1/stories/{id}", storyHandler.Update)
		r.Delete("/api/v1/stories/{id}", storyHandler.Delete)

		// Tasks
		r.Get("/api/v1/stories/{storyId}/tasks", taskHandler.ListByStory)
		r.Post("/api/v1/stories/{storyId}/tasks", taskHandler.Create)
		r.Get("/api/v1/tasks/{id}", taskHandler.Get)
		r.Patch("/api/v1/tasks/{id}", taskHandler.Update)
		r.Delete("/api/v1/tasks/{id}", taskHandler.Delete)
		r.Patch("/api/v1/tasks/{id}/status", taskHandler.UpdateStatus)
		r.Patch("/api/v1/tasks/{id}/reorder", taskHandler.UpdateSortOrder)
		r.Get("/api/v1/tasks/my", taskHandler.MyTasks)

		// Subtasks
		r.Get("/api/v1/tasks/{taskId}/subtasks", subtaskHandler.List)
		r.Post("/api/v1/tasks/{taskId}/subtasks", subtaskHandler.Create)
		r.Patch("/api/v1/subtasks/{id}", subtaskHandler.Update)
		r.Delete("/api/v1/subtasks/{id}", subtaskHandler.Delete)
		r.Patch("/api/v1/subtasks/{id}/status", subtaskHandler.UpdateStatus)
		r.Patch("/api/v1/subtasks/{id}/reorder", subtaskHandler.UpdateSortOrder)

		// Comments
		r.Post("/api/v1/{entity_type}/{entity_id}/comments", commentHandler.Create)
		r.Get("/api/v1/{entity_type}/{entity_id}/comments", commentHandler.List)
		r.Patch("/api/v1/comments/{id}", commentHandler.Update)
		r.Delete("/api/v1/comments/{id}", commentHandler.Delete)

		// Changelog
		r.Get("/api/v1/{entity_type}/{entity_id}/changelog", func(w http.ResponseWriter, r *http.Request) {
			entityType := chi.URLParam(r, "entity_type")
			entityID := chi.URLParam(r, "entity_id")
			rows, err := db.Query(r.Context(), `
				SELECT cl.id, cl.entity_type, cl.entity_id, cl.action, cl.field, cl.old_value, cl.new_value,
				       cl.changed_by, cl.changed_at, COALESCE(u.full_name, 'System') as changed_by_name
				FROM command_changelog cl
				LEFT JOIN users u ON cl.changed_by = u.id
				WHERE cl.entity_type = $1 AND cl.entity_id = $2
				ORDER BY cl.changed_at DESC
				LIMIT 50
			`, entityType, entityID)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(200)
				w.Write([]byte("[]"))
				return
			}
			defer rows.Close()
			type entry struct {
				ID          string  `json:"id"`
				EntityType  string  `json:"entity_type"`
				EntityID    string  `json:"entity_id"`
				Action      string  `json:"action"`
				Field       *string `json:"field"`
				OldValue    *string `json:"old_value"`
				NewValue    *string `json:"new_value"`
				ChangedBy   *string `json:"changed_by"`
				ChangedAt   string  `json:"changed_at"`
				ChangedName string  `json:"changed_by_name"`
			}
			var entries []entry
			for rows.Next() {
				var e entry
				rows.Scan(&e.ID, &e.EntityType, &e.EntityID, &e.Action, &e.Field, &e.OldValue, &e.NewValue, &e.ChangedBy, &e.ChangedAt, &e.ChangedName)
				entries = append(entries, e)
			}
			if entries == nil {
				entries = []entry{}
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(entries)
		})

		// Board
		r.Get("/api/v1/board", boardHandler.GetBoard)
	})

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Server
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		log.Printf("Command API server starting on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("server shutdown failed: %v", err)
	}
	log.Println("server stopped")
}
