#!/usr/bin/env bash
# First-time DigitalOcean droplet setup (Ubuntu 22.04/24.04).
# Clone the backend onto the droplet, then run as root from the repo:
#   sudo bash deploy/setup-droplet.sh
set -euo pipefail

APP_DIR=/var/www/getleaning-backend
APP_USER=getleaning
NODE_MAJOR=22
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [[ $EUID -ne 0 ]]; then
  echo "Run this script as root (sudo)."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg build-essential python3 git rsync nginx ufw

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"

mkdir -p "$APP_DIR"
if [[ "$REPO_DIR" != "$APP_DIR" ]]; then
  rsync -a --delete --exclude node_modules --exclude dist --exclude uploads --exclude .env "$REPO_DIR/" "$APP_DIR/"
fi

if [[ ! -f "$APP_DIR/.env" && -f "$APP_DIR/.env.production.example" ]]; then
  cp "$APP_DIR/.env.production.example" "$APP_DIR/.env"
  echo "Created $APP_DIR/.env from the production example — edit secrets before starting the API."
fi

mkdir -p "$APP_DIR/uploads"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

cp "$REPO_DIR/deploy/nginx.conf" /etc/nginx/sites-available/getleaning-api
ln -sfn /etc/nginx/sites-available/getleaning-api /etc/nginx/sites-enabled/getleaning-api
rm -f /etc/nginx/sites-enabled/default

cp "$REPO_DIR/deploy/getleaning-api.service" /etc/systemd/system/getleaning-api.service
systemctl daemon-reload

ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable

nginx -t
systemctl enable --now nginx

echo
echo "Next:"
echo "  1. Edit $APP_DIR/.env (DATABASE_URL, JWT_SECRET, FRONTEND_URL, PUBLIC_APP_URL)"
echo "  2. Edit /etc/nginx/sites-available/getleaning-api — set your API hostname"
echo "  3. sudo -u $APP_USER bash $APP_DIR/deploy/release.sh"
echo "  4. systemctl enable --now getleaning-api"
echo "  5. Point DNS A record to this droplet, then: apt-get install -y certbot python3-certbot-nginx && certbot --nginx -d api.example.com"
echo "  6. Confirm Postgres listens on 127.0.0.1 and DATABASE_URL uses getlearning_db"
