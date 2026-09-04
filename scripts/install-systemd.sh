#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_NAME="${SUDO_USER:-$USER}"

sed \
  -e "s|__USER__|$USER_NAME|g" \
  -e "s|__INSTALL_DIR__|$ROOT|g" \
  "$ROOT/systemd/claim-free-games.service" \
  | sudo tee /etc/systemd/system/claim-free-games.service >/dev/null

sudo cp "$ROOT/systemd/claim-free-games.timer" /etc/systemd/system/claim-free-games.timer
sudo systemctl daemon-reload

if grep -q '__USER__\|__INSTALL_DIR__' /etc/systemd/system/claim-free-games.service; then
  echo 'ERROR: unresolved placeholders remain in installed systemd service.' >&2
  exit 1
fi

sudo systemd-analyze verify /etc/systemd/system/claim-free-games.service

echo "Installed systemd unit for user $USER_NAME at $ROOT"
