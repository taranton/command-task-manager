package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func NewDB(databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}

	config.MaxConns = 20
	config.MinConns = 5

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return nil, fmt.Errorf("create connection pool: %w", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return pool, nil
}

func NewRedis(redisURL string) *redis.Client {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		opts = &redis.Options{Addr: "localhost:6379"}
	}
	return redis.NewClient(opts)
}

// SetRLSContext sets PostgreSQL session variables for Row-Level Security.
// Must be called within a transaction before any RLS-enabled queries.
func SetRLSContext(ctx context.Context, tx interface{ Exec(ctx context.Context, sql string, args ...any) (interface{}, error) }, userID, userRole string) error {
	_, err := tx.Exec(ctx, fmt.Sprintf("SET LOCAL app.user_id = '%s'", userID))
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, fmt.Sprintf("SET LOCAL app.user_role = '%s'", userRole))
	return err
}
