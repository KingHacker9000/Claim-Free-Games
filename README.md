<div align="center">

# 🎮 Claim Free Games

**Automatically claim Epic Games Store giveaways from a Raspberry Pi — API first, browser only when needed.**

![Node](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white)
![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-5-C51A4A?logo=raspberrypi&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Linux-blue)
![Status](https://img.shields.io/badge/status-v2.0.0-success)

</div>

---

Claim Free Games is a small self-hosted service that checks Epic's current giveaways once a day and claims anything missing from your library.

The normal path is completely browserless. If Epic rejects the API purchase, the service falls back to a real headed Chromium session running invisibly under Xvfb. If Epic asks for login, CAPTCHA, or an unexpected checkout step, you get a phone notification and can take over the Pi browser remotely through noVNC.

## How it works

```text
systemd timer (daily)
        │
        ▼
Epic free-games API
        │
        ▼
Epic entitlement check
        │
        ├── already owned ───────────────► exit silently
        │
        ▼
🔔 new unowned giveaway detected
        │
        ▼
Epic Launcher quickPurchase API
        │
        ├── entitlement verified ────────► ✅ notify success
        │
        ▼
headed Chromium on Xvfb
        │
        ├── checkout succeeds ───────────► ✅ notify success
        │
        ▼
login / CAPTCHA / changed checkout
        │
        ▼
🔔 ntfy alert → noVNC over Tailscale
        │
        ▼
you finish the step remotely
        │
        ▼
verify entitlement → success / failure
```

### Design goals

- **API first** — no browser is launched during normal operation.
- **Deterministic ownership checks** — a claim is only considered successful after an Epic entitlement appears.
- **Quiet by default** — routine daily checks are silent.
- **Useful alerts only** — notifications are sent when a new unowned game is detected, after success/failure, or when you need to intervene.
- **No stored Epic password** — authentication uses Epic OAuth and a rotating refresh token.
- **Pi friendly** — designed for a Raspberry Pi 5 or another always-on Linux host.

## Requirements

- 64-bit Raspberry Pi OS / Debian / Ubuntu
- Raspberry Pi 5 recommended
- Internet connection
- Epic Games account
- Optional but recommended:
  - [Tailscale](https://tailscale.com/) for private remote access
  - [ntfy](https://ntfy.sh/) for phone notifications

The installer provisions Node.js 22+, Chromium, Xvfb, x11vnc, noVNC, and websockify.

## Install on Raspberry Pi

```bash
git clone https://github.com/KingHacker9000/Claim-Free-Games.git
cd Claim-Free-Games
chmod +x scripts/install-pi.sh
./scripts/install-pi.sh
```

### 1. Authenticate with Epic

```bash
npm run auth
```

Open the printed Epic URL on any device, sign in, and copy the `authorizationCode` from the JSON response.

Then run:

```bash
npm run auth -- --code=PASTE_AUTHORIZATION_CODE_HERE
```

The OAuth session is saved to `data/session.json` with file mode `0600`. Epic rotates refresh tokens, so the updated session is persisted immediately after refresh.

### 2. Configure notifications and remote access

Edit `.env`:

```bash
nano .env
```

Typical setup:

```env
NTFY_URL=https://ntfy.sh/your-long-private-topic

REMOTE_ASSIST_BIND=100.x.x.x
REMOTE_ASSIST_URL=http://100.x.x.x:6080/vnc.html?autoconnect=true&resize=remote
VNC_PASSWORD=use-a-strong-random-password
```

Use your Pi's Tailscale IP/hostname for the remote-assist address. Do **not** expose port `6080` directly to the public internet.

### 3. Verify everything

```bash
npm run doctor
```

Expected output includes:

```text
Epic session: present
ntfy: configured
Remote assist URL: http://...
Epic API: OK (...)
```

Test notifications:

```bash
npm run notify-test
```

Test remote browser access without attempting a purchase:

```bash
npm run assist-test -- --seconds=180
```

### 4. Test one claim cycle

```bash
npm run claim
```

If every current giveaway is already owned, the command simply reports them and exits.

### 5. Enable the daily timer

```bash
sudo systemctl enable --now claim-free-games.timer
systemctl list-timers claim-free-games.timer
```

The timer runs approximately once every 24 hours with a small randomized delay. `Persistent=true` means a missed run executes after the Pi comes back online.

## Notifications

Routine checks do **not** notify you.

You will receive an alert when:

- a new free game is detected and is not already owned;
- a game is successfully claimed through the API;
- browser fallback successfully claims a game;
- a claim fails;
- Epic requires login, CAPTCHA, or manual checkout intervention.

Example flow:

```text
🔔 New free Epic game detected
   Game X is free and not in your library. Starting the claim now.

✅ Free game claimed
   Game X was claimed through the Epic API.
```

## Commands

| Command | Purpose |
|---|---|
| `npm run auth` | Start one-time Epic OAuth setup |
| `npm run doctor` | Check auth, API, configuration, and current giveaways |
| `npm run claim` | Run a claim cycle manually |
| `npm run notify-test` | Send a test ntfy notification |
| `npm run assist-test -- --seconds=180` | Test Xvfb + Chromium + noVNC safely |
| `npm test` | Run unit tests |

## Logs and status

Follow live service logs:

```bash
journalctl -u claim-free-games.service -f
```

Recent history:

```bash
journalctl -u claim-free-games.service --since "7 days ago" --no-pager
```

Check the timer:

```bash
systemctl status claim-free-games.timer --no-pager
systemctl list-timers claim-free-games.timer
```

## Data layout

```text
data/
├── session.json        # Epic OAuth tokens — treat like a password
├── state.json          # giveaway/claim state
├── browser-profile/    # persistent fallback browser profile
└── screenshots/        # failure screenshots
```

`.env`, `data/`, and browser state are ignored by Git and should never be committed.

## Security notes

- This project never asks you to save your Epic password.
- Treat `data/session.json` as a secret.
- Use a strong VNC password.
- Keep noVNC private behind your LAN or Tailscale.
- The Epic `quickPurchase` endpoint is an undocumented Launcher service and may change without notice; browser fallback exists for that reason.

## Architecture

The project is intentionally split into small pieces:

```text
src/
├── epic-api.ts       # OAuth, discovery, entitlements, quickPurchase
├── browser.ts        # Patchright Chromium fallback
├── remote-assist.ts # x11vnc + noVNC escalation
├── notifier.ts      # ntfy integration
├── storage.ts       # session/state persistence
├── config.ts        # environment configuration
└── index.ts         # orchestration / CLI
```

## Disclaimer

This is an unofficial community project and is not affiliated with or endorsed by Epic Games. Store APIs and checkout behavior can change at any time.

---

<div align="center">

Built to run quietly on a Pi and only bother you when something actually needs attention.

</div>
