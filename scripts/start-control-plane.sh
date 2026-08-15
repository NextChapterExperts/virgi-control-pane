#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "🚀 Starte VIRKI Control Plane..."
echo "👉 Backend API: http://localhost:8080"
echo "👉 Web Konsole: http://localhost:8280"

cd "${ROOT_DIR}"
PYTHONPATH=. .venv/bin/uvicorn server.main:app --host 0.0.0.0 --port 8080 --reload &
BACKEND_PID=$!

cd "${ROOT_DIR}/web"
npm run dev &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
