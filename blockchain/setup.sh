#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/venv"

cd "$SCRIPT_DIR"

# 1. Update system packages
echo "Updating system..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js and NPM (Required for Ganache)
echo "Installing Node.js and NPM..."
sudo apt install -y nodejs npm

# 3. Install Python3 and Pip
echo "Installing Python and Pip..."
sudo apt install -y python3 python3-pip python3-venv

# 4. Create and activate Python virtual environment in blockchain folder
echo "Creating Python virtual environment in blockchain folder..."
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

# 5. Install Ganache CLI globally
echo "Installing Ganache CLI..."
sudo npm install -g ganache

# 6. Install Python libraries in virtual environment
echo "Installing Python dependencies in virtual environment..."
pip install --upgrade pip
pip install -r requirements.txt

# 7. Pre-install the Solidity compiler version
echo "Installing Solidity Compiler 0.8.0..."
python -c "import solcx; solcx.install_solc('0.8.0')"

# 8. Start Ganache temporarily to deploy the contract
echo "Starting Ganache for initial deployment..."
nohup ganache -p 7545 > ganache_setup.log 2>&1 &
GANACHE_PID=$!

# Wait for Ganache to boot up
sleep 5

# 9. Run the deployment script using virtual environment Python
echo "Deploying the smart contract..."
python deploy.py

# 10. Clean up Ganache
kill $GANACHE_PID
deactivate
echo "Setup complete! contract_config.json has been generated."