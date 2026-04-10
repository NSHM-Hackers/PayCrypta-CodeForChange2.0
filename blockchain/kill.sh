echo "Cleaning up blockchain processes..."
# Kill any running blockchain processes
pkill -f "ganache-cli" || true
pkill -f "ganache" || true
pkill -f "ganache_blockchain_app.py" || true