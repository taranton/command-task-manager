package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://command:command@localhost:5432/command?sslmode=disable"
	}

	db, err := sql.Open("pgx", dbURL)
	if err != nil {
		log.Fatalf("failed to connect: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("failed to ping: %v", err)
	}

	migrationsDir := "migrations"
	if len(os.Args) > 1 {
		migrationsDir = os.Args[1]
	}

	files, err := filepath.Glob(filepath.Join(migrationsDir, "*.up.sql"))
	if err != nil {
		log.Fatalf("failed to read migrations: %v", err)
	}
	sort.Strings(files)

	direction := "up"
	if len(os.Args) > 2 {
		direction = os.Args[2]
	}

	if direction == "down" {
		files, err = filepath.Glob(filepath.Join(migrationsDir, "*.down.sql"))
		if err != nil {
			log.Fatalf("failed to read migrations: %v", err)
		}
		sort.Sort(sort.Reverse(sort.StringSlice(files)))
	}

	for _, f := range files {
		name := filepath.Base(f)
		content, err := os.ReadFile(f)
		if err != nil {
			log.Fatalf("failed to read %s: %v", name, err)
		}

		// Split by semicolons for multi-statement migrations
		statements := strings.Split(string(content), ";")
		for _, stmt := range statements {
			stmt = strings.TrimSpace(stmt)
			if stmt == "" {
				continue
			}
			if _, err := db.Exec(stmt); err != nil {
				// Skip "already exists" errors for idempotency
				if !strings.Contains(err.Error(), "already exists") &&
					!strings.Contains(err.Error(), "does not exist") {
					log.Fatalf("migration %s failed: %v\nStatement: %s", name, err, stmt[:min(len(stmt), 200)])
				}
			}
		}
		fmt.Printf("✓ %s\n", name)
	}

	fmt.Println("Migrations complete!")
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
