#!/usr/bin/env bash
#
# Triggered by mcp-webhook on a push to main. Pulls origin/main, reinstalls
# deps, rebuilds, and restarts mcp-travelcode. Single instance enforced via
# flock so concurrent webhooks don't trample each other.
#
set -euo pipefail

REPO=/opt/mcp-travelcode
LOG=/var/log/mcp-deploy.log
LOCK=/var/lock/mcp-deploy.lock

# Single-writer guarantee: queue if another deploy is in flight, give up
# after 5 minutes rather than piling up indefinitely.
exec 9>"$LOCK"
if ! flock -w 300 9; then
  echo "[$(date -Is)] deploy: failed to acquire lock after 300s, aborting" >> "$LOG"
  exit 1
fi

exec >> "$LOG" 2>&1

echo "[$(date -Is)] deploy starting (pid $$)"
cd "$REPO"

git fetch --quiet origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "  already up-to-date at $LOCAL"
  exit 0
fi

echo "  $LOCAL  ->  $REMOTE"
git reset --hard origin/main
npm ci --silent
npm run build
sudo -n /bin/systemctl restart mcp-travelcode

echo "[$(date -Is)] deploy done at $REMOTE"
