#!/bin/bash
# BoatOS Remote Control Deployment Script

set -e

echo "=== BoatOS Remote Control Deployment ==="
echo

# Variables
PI_USER="arielle"
PI_HOST="192.168.2.222"
PI_KEY="~/.ssh/id_rsa_boatos"
REMOTE_DIR="/home/arielle/BoatOS"

echo "Target: $PI_USER@$PI_HOST"
echo "Remote directory: $REMOTE_DIR"
echo

# 1. Deploy backend
echo "[1/5] Deploying backend files..."
scp -i $PI_KEY backend/*.py $PI_USER@$PI_HOST:$REMOTE_DIR/backend/
scp -i $PI_KEY backend/requirements.txt $PI_USER@$PI_HOST:$REMOTE_DIR/backend/
echo "✓ Backend deployed"
echo

# 2. Deploy frontend
echo "[2/5] Deploying frontend files..."
scp -i $PI_KEY frontend/remote.html $PI_USER@$PI_HOST:$REMOTE_DIR/frontend/
scp -i $PI_KEY frontend/remote.css $PI_USER@$PI_HOST:$REMOTE_DIR/frontend/
scp -i $PI_KEY frontend/remote.js $PI_USER@$PI_HOST:$REMOTE_DIR/frontend/
echo "✓ Frontend deployed"
echo

# 3. Install Python dependencies
echo "[3/5] Installing Python dependencies..."
ssh -i $PI_KEY $PI_USER@$PI_HOST "cd $REMOTE_DIR/backend && pip3 install --user -r requirements.txt"
echo "✓ Dependencies installed"
echo

# 4. Setup systemd service
echo "[4/5] Setting up systemd service..."
scp -i $PI_KEY deploy/boatos-remote.service $PI_USER@$PI_HOST:/tmp/
ssh -i $PI_KEY $PI_USER@$PI_HOST "sudo mv /tmp/boatos-remote.service /etc/systemd/system/ && sudo systemctl daemon-reload"
echo "✓ Service installed"
echo

# 5. Add user to input group (for uinput access)
echo "[5/5] Configuring permissions..."
ssh -i $PI_KEY $PI_USER@$PI_HOST "sudo usermod -a -G input $PI_USER"
echo "✓ User added to input group"
echo

echo "=== Deployment Complete ==="
echo
echo "To start the service:"
echo "  ssh -i $PI_KEY $PI_USER@$PI_HOST 'sudo systemctl start boatos-remote'"
echo
echo "To enable auto-start on boot:"
echo "  ssh -i $PI_KEY $PI_USER@$PI_HOST 'sudo systemctl enable boatos-remote'"
echo
echo "To view logs:"
echo "  ssh -i $PI_KEY $PI_USER@$PI_HOST 'sudo journalctl -u boatos-remote -f'"
echo
echo "Access Remote Control at:"
echo "  http://$PI_HOST/remote"
