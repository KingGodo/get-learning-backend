#!/usr/bin/env bash
# Build, migrate, and restart. On the droplet:
#   sudo bash /var/www/getleaning-backend/deploy/release.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_USER=getleaning
export PATH="/usr/bin:/bin:${PATH}"

build() {
  cd "$APP_DIR"
  npm ci
  npx prisma generate
  npx prisma migrate deploy
  npm run build
  mkdir -p uploads
}

if [[ "${1:-}" == "--build-only" ]]; then
  build
  exit 0
fi

if [[ $EUID -eq 0 ]]; then
  sudo -u "$APP_USER" env PATH="$PATH" bash "$APP_DIR/deploy/release.sh" --build-only
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
  systemctl enable getleaning-api
  systemctl restart getleaning-api
  systemctl --no-pager --full status getleaning-api
  exit 0
fi

build
echo "Build finished. Restart the API with: sudo systemctl restart getleaning-api"
