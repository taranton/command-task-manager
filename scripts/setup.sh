#!/bin/bash
set -e

echo "=== Command Task Manager — Setup ==="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running. Please start Docker first."
  exit 1
fi

# Start database and redis
echo "1. Starting PostgreSQL and Redis..."
cd "$(dirname "$0")/.."
docker compose up -d postgres redis
echo "   Waiting for databases to be ready..."
sleep 3

# Run migrations
echo "2. Running database migrations..."
cd backend
go run ./cmd/migrate ./migrations up
cd ..

# Install frontend dependencies (if needed)
echo "3. Checking frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
  echo "   Installing npm packages..."
  npm install
fi
cd ..

echo ""
echo "=== Setup complete! ==="
echo ""
echo "To start the app:"
echo "  Terminal 1 (backend):  cd backend && go run ./cmd/server"
echo "  Terminal 2 (frontend): cd frontend && npm run dev"
echo ""
echo "Then open: http://localhost:5173"
echo ""
echo "Test accounts:"
echo "  admin@qrt.com    / password123  (C-Level)"
echo "  lead@qrt.com     / password123  (Team Lead)"
echo "  member@qrt.com   / password123  (Member)"
echo "  trainee@qrt.com  / password123  (Trainee)"
