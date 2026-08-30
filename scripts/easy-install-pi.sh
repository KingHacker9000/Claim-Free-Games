#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/KingHacker9000/Claim-Free-Games.git"
INSTALL_DIR="${CFG_INSTALL_DIR:-$HOME/Claim-Free-Games}"

echo
printf '%s\n' '🎮 Claim Free Games — Raspberry Pi easy installer'
printf '%s\n' 'This will install the app, its browser fallback, and a once-daily timer.'
echo

sudo apt-get update
sudo apt-get install -y git curl ca-certificates

if [[ -d "$INSTALL_DIR/.git" ]]; then
  git -C "$INSTALL_DIR" fetch origin
  git -C "$INSTALL_DIR" checkout main
  git -C "$INSTALL_DIR" pull --ff-only origin main
else
  git clone --branch main "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
chmod +x scripts/install-pi.sh
CFG_EASY_INSTALL=1 ./scripts/install-pi.sh

# Prefer Tailscale for private remote browser access. Otherwise use the first
# normal LAN address; x11vnc remains password protected either way.
REMOTE_IP=""
if command -v tailscale >/dev/null 2>&1; then
  REMOTE_IP="$(tailscale ip -4 2>/dev/null | head -n1 || true)"
fi
if [[ -z "$REMOTE_IP" ]]; then
  REMOTE_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
fi

if [[ -n "$REMOTE_IP" ]]; then
  awk '!/^(REMOTE_ASSIST_BIND|REMOTE_ASSIST_URL)=/' .env > .env.easy
  cat >> .env.easy <<EOF2
REMOTE_ASSIST_BIND=$REMOTE_IP
REMOTE_ASSIST_URL=http://$REMOTE_IP:6080/vnc.html?autoconnect=true&resize=remote
EOF2
  mv .env.easy .env
  chmod 600 .env
fi

# Give first-time users a private ntfy topic by default. They can keep it,
# replace it in the wizard, or leave the field blank to disable phone alerts.
if ! grep -q '^NTFY_URL=https://ntfy.sh/' .env; then
  TOPIC="claim-free-games-$(tr -dc 'a-z0-9' </dev/urandom | head -c 24 || true)"
  sed -i "s|^NTFY_URL=.*|NTFY_URL=https://ntfy.sh/$TOPIC|" .env
fi

echo
echo 'Opening the setup wizard. Use one of the URLs printed below on your phone or computer.'
echo 'When you click Finish, this installer will enable the daily check automatically.'
echo
npm run setup

sudo systemctl enable --now claim-free-games.timer

echo
echo '✅ Claim Free Games is installed.'
echo 'It checks once per day and stays silent unless a new unowned giveaway is found or something needs attention.'
echo
systemctl list-timers claim-free-games.timer --no-pager || true
