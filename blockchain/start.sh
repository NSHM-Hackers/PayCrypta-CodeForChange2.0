#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/venv"

cd "$SCRIPT_DIR"

if [ ! -d "$VENV_DIR" ]; then
	echo "Virtual environment not found at $VENV_DIR. Run setup.sh first."
	exit 1
fi

source "$VENV_DIR/bin/activate"

# Start Ganache in the background
# Output is redirected to ganache.log
echo "Starting Ganache on port 7545..."
nohup ganache -p 7545 > ganache.log 2>&1 &

# Wait for Ganache to initialize
sleep 5

# Start the Flask Blockchain App
# We use the virtual environment Python here.
# If you want the API to also run in the background, use nohup here as well.
echo "Starting Blockchain Flask API..."
python ganache_blockchain_app.py