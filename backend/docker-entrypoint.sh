#!/bin/sh
set -e

echo "[entrypoint] Resolving database URL..."

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -n "${DATABASE_PRIVATE_URL:-}" ]; then
    export DATABASE_URL="$DATABASE_PRIVATE_URL"
    echo "[entrypoint] Using DATABASE_PRIVATE_URL"
  elif [ -n "${DATABASE_PUBLIC_URL:-}" ]; then
    export DATABASE_URL="$DATABASE_PUBLIC_URL"
    echo "[entrypoint] Using DATABASE_PUBLIC_URL"
  elif [ -n "${POSTGRES_URL:-}" ]; then
    export DATABASE_URL="$POSTGRES_URL"
    echo "[entrypoint] Using POSTGRES_URL"
  elif [ -n "${POSTGRES_PRIVATE_URL:-}" ]; then
    export DATABASE_URL="$POSTGRES_PRIVATE_URL"
    echo "[entrypoint] Using POSTGRES_PRIVATE_URL"
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] ERROR: DATABASE_URL is not set."
  echo "[entrypoint] Fix on Railway:"
  echo "  1. Add a PostgreSQL service to the project"
  echo "  2. Open auco-ai -> Variables -> Variable References"
  echo "  3. Add DATABASE_URL from the Postgres service (or DATABASE_PRIVATE_URL)"
  echo "  4. Redeploy"
  exit 1
fi

echo "[entrypoint] DATABASE_URL is set (host hidden)"

echo "[entrypoint] Running prisma migrate deploy..."
npx prisma migrate deploy

echo "[entrypoint] Starting NestJS..."
exec node dist/src/main.js