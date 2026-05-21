#!/bin/bash
echo "=== Trading Dashboard ==="
echo ""

cd "$(dirname "$0")"

echo "[1/2] Installing Python dependencies..."
pip3 install -r backend/requirements.txt --quiet --break-system-packages 2>&1 | tail -1
echo "  Done."

echo "[2/2] Starting services..."
python3 backend/app.py --break-system-packages &
FLASK_PID=$!
echo "  Flask backend running on http://localhost:5000 (PID: $FLASK_PID)"

sleep 2

echo ""
echo "  Open frontend/index.html in your browser, or serve it with:"
echo "    cd frontend && python -m http.server 8080"
echo ""
echo "Press Ctrl+C to stop all services."

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $FLASK_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

wait $FLASK_PID
