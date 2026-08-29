#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -m)" != "aarch64" ]]; then
  echo "Warning: this installer is intended for a 64-bit Raspberry Pi OS/Ubuntu host."
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_NAME="${SUDO_USER:-$USER}"

sudo apt-get update
sudo apt-get install -y chromium xvfb x11vnc novnc websockify ca-certificates

cd "$ROOT"
if ! command -v node >/dev/null || [[ "$(node -p 'Number(process.versions.node.split(`.`)[0])')" -lt 22 ]]; then
  echo "Node.js 22+ is required. Install it first, then rerun this script."
  exit 1
fi
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
npm run build

# Prefer system Chromium on Raspberry Pi to avoid browser-binary architecture surprises.
if [[ ! -f .env ]]; then cp .env.example .env; fi
if ! grep -q '^BROWSER_EXECUTABLE_PATH=' .env; then
  echo 'BROWSER_EXECUTABLE_PATH=/usr/bin/chromium' >> .env
fi
if grep -q '^VNC_PASSWORD=change-this-password$' .env; then
  VNC_PASS="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 18 || true)"
  sed -i "s/^VNC_PASSWORD=.*/VNC_PASSWORD=$VNC_PASS/" .env
  echo "Generated VNC password: $VNC_PASS"
fi

sed -e "s|__USER__|$USER_NAME|g" -e "s|__INSTALL_DIR__|$ROOT|g" systemd/claim-free-games.service | sudo tee /etc/systemd/system/claim-free-games.service >/dev/null
sudo cp systemd/claim-free-games.timer /etc/systemd/system/claim-free-games.timer
sudo systemctl daemon-reload
sudo systemctl enable claim-free-games.timer

echo
echo "Installed. Next steps:"
echo "  1) npm run auth"
echo "  2) edit .env and set NTFY_URL + REMOTE_ASSIST_URL"
echo "  3) npm run doctor"
echo "  4) sudo systemctl start claim-free-games.service"
echo "  5) sudo systemctl start claim-free-games.timer"
