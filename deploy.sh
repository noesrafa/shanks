#!/bin/bash
set -e

cd /root/shanks

echo "[$(date)] Pulling latest changes..."
git pull origin main

echo "[$(date)] Installing dependencies..."
npm install

echo "[$(date)] Building..."
npm run build

echo "[$(date)] Restarting service..."
systemctl restart shanks

echo "[$(date)] Deploy complete!"
