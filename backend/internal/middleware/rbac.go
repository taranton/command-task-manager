package middleware

import (
	"net/http"

	"github.com/qrt/command/internal/model"
)

// RequireRole returns middleware that restricts access to specified roles
func RequireRole(roles ...model.Role) func(http.Handler) http.Handler {
	roleSet := make(map[string]bool)
	for _, r := range roles {
		roleSet[string(r)] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userRole := GetUserRole(r.Context())
			if !roleSet[userRole] {
				http.Error(w, `{"error":"forbidden","message":"insufficient permissions"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireTaskCreation restricts task creation to non-trainee roles
func RequireTaskCreation(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role := model.Role(GetUserRole(r.Context()))
		if !role.CanCreateTasks() {
			http.Error(w, `{"error":"forbidden","message":"trainees cannot create tasks"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}
