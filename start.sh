#!/usr/bin/env bash
# Start the progress tracker HTTP server
# Usage: ./start.sh [port]

cd "$(dirname "$0")"
python3 server.py "${1:-8765}"
