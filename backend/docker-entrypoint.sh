#!/bin/sh
set -e

echo "[entrypoint] Running prisma migrate deploy..."
npx prisma migrate deploy

echo "[entrypoint] Starting NestJS..."
exec node dist/src/main.js
