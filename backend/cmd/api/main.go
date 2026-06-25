package main

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"secret-vault-backend/internal/audit"
	"secret-vault-backend/internal/auth"
	"secret-vault-backend/internal/database"
	"secret-vault-backend/internal/secrets"
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:4000")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// 1. Database Connection
	db, err := database.Connect()
	if err != nil {
		fmt.Printf("Database connection error: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	// 2. Run Database Migrations
	migrationsPath := os.Getenv("MIGRATIONS_PATH")
	if migrationsPath == "" {
		migrationsPath = "./migrations"
	}
	// Absolute path conversion for safety
	absMigrationsPath, err := filepath.Abs(migrationsPath)
	if err == nil {
		migrationsPath = absMigrationsPath
	}
	fmt.Printf("Running migrations from: %s\n", migrationsPath)
	err = database.RunMigrations(migrationsPath)
	if err != nil {
		fmt.Printf("Migrations failed: %v\n", err)
		os.Exit(1)
	}

	// 3. Initialize modules
	audit.Init(db)
	secrets.Init(db)

	// 4. Set up routes
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Auth routes
	r.Post("/api/auth/login", auth.LoginHandler)
	r.Post("/api/auth/logout", auth.LogoutHandler)
	r.Get("/api/auth/session", auth.CheckSessionHandler)

	// Protected routes
	r.Route("/api", func(r chi.Router) {
		r.Use(auth.AuthMiddleware)

		// Secrets CRUD
		r.Post("/secrets", secrets.CreateSecretHandler)
		r.Get("/secrets", secrets.ListSecretsHandler)
		r.Get("/secrets/{id}", secrets.GetSecretHandler)
		r.Put("/secrets/{id}", secrets.UpdateSecretHandler)
		r.Post("/secrets/{id}/revoke", secrets.RevokeSecretHandler)

		// Secrets Versioning
		r.Get("/secrets/{id}/versions", secrets.ListSecretVersionsHandler)
		r.Post("/secrets/{id}/versions/{version}/rollback", secrets.RollbackSecretHandler)

		// Audit Logs
		r.Get("/audit-logs", audit.ListAuditLogsHandler)
	})

	fmt.Printf("Server starting on port %s...\n", port)
	err = http.ListenAndServe(":"+port, r)
	if err != nil {
		fmt.Printf("Error starting server: %v\n", err)
		os.Exit(1)
	}
}
