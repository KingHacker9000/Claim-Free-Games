#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -m)" != "aarch64" ]]; then
  echo "Warning: this installer is intended for a 64-bit Raspberry Pi OS/Ubuntu host."
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_NAME="${SUDO_USER:-$USER}"

sudo apt-get update
sudo apt-get install -y chromium xvfb x11vnc novnc websockify ca-certificates curl gnupg

# Raspberry Pi OS/Debian 13 currently ships an older Node release. Install the
# NodeSource 22.x LTS package system-wide so npm is also available to systemd.
NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'Number(process.versions.node.split(`.`)[0])' 2>/dev/null || echo 0)"
fi

if [[ "$NODE_MAJOR" -lt 22 ]] || ! command -v npm >/dev/null 2>&1; then
  echo "Installing Node.js 22 LTS + npm from NodeSource..."
  NODE_SETUP="$(mktemp)"
  curl -fsSL https://deb.nodesource.com/setup_22.x -o "$NODE_SETUP"
  sudo -E bash "$NODE_SETUP"
  rm -f "$NODE_SETUP"
  sudo apt-get install -y nodejs
  hash -r
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: Node.js/npm installation failed."
  exit 1
fi
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(`.`)[0])')"
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  echo "ERROR: Node.js 22+ is required, but found $(node --version)."
  exit 1
fi

echo "Using $(node --version) with npm $(npm --version)"

cd "$ROOT"
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
