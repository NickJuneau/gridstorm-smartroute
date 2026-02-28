#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [[ ! -d ".venv" ]]; then
  python -m venv .venv
fi

source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

BACKEND_HOST="${BACKEND_HOST:-0.0.0.0}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FALLBACK_MOCK="${FALLBACK_MOCK:-0}"

if [[ "${1:-}" == "--mock" ]]; then
  FALLBACK_MOCK=1
fi

export FALLBACK_MOCK
echo "Starting backend on ${BACKEND_HOST}:${BACKEND_PORT} (FALLBACK_MOCK=${FALLBACK_MOCK})"
echo "OCR fallback for scanned PDFs requires Tesseract + Poppler installed on your system."

uvicorn app.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" --reload
