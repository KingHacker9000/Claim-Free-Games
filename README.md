<div align="center">

# 🎮 Claim Free Games

**Automatically claim Epic Games Store giveaways — on your PC, Mac, Linux machine, or Raspberry Pi.**

![Version](https://img.shields.io/badge/version-2.1.0-6f5cff)
![Windows](https://img.shields.io/badge/Windows-10%2F11-0078D4?logo=windows)
![macOS](https://img.shields.io/badge/macOS-Intel%20%2B%20Apple%20Silicon-000?logo=apple)
![Linux](https://img.shields.io/badge/Linux-AppImage%20%2B%20deb-FCC624?logo=linux&logoColor=black)
![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-64--bit-C51A4A?logo=raspberrypi&logoColor=white)

**API first · browser fallback · quiet by default · no stored Epic password**

</div>

---

Claim Free Games checks Epic's current giveaways once a day and claims anything missing from your library.

Most runs never open a browser. The app discovers giveaways through Epic's store API, checks your account entitlements, then attempts the free order through the Launcher purchase service. A claim only counts as successful after the entitlement actually appears on your account.

If Epic rejects the API route, a real Chromium session takes over. If Epic asks for login, CAPTCHA, or a changed checkout flow, the app asks you to finish that step and then verifies ownership again.

## Pick your install

| Where do you want it to run? | Best option | Experience |
|---|---|---|
| **Windows 10/11** | Download the Windows installer from **Releases** | Install → connect Epic → done |
| **macOS** | Download the DMG for Intel or Apple Silicon | Drag/install → connect Epic → done |
| **Desktop Linux** | Download AppImage or `.deb` | Open app → connect Epic → done |
| **Raspberry Pi / always-on Linux** | Run the Pi easy installer below | One command → browser setup wizard → done |

> Desktop builds are generated automatically by GitHub Actions. Unsigned Windows/macOS community builds may show an OS trust warning until the project is code-signed.

## 🖥️ Desktop app — Windows, macOS, Linux

The desktop edition is designed for people who do **not** want to use a terminal.

### First launch

1. Open **Claim Free Games**.
2. Click **Connect Epic account**.
3. Sign in to Epic in the temporary login window.
4. Optionally add an [ntfy](https://ntfy.sh/) topic for phone alerts.
5. Click **Finish setup**.

That's it.

The app lives in your system tray and starts with your computer. It performs one silent check per day while the machine is on.

### Notifications

Routine checks do not bother you. You only get notified when:

- a new giveaway is detected that you do not own;
- a game was successfully claimed;
- a claim failed;
- Epic needs you to sign in, solve a CAPTCHA, or finish checkout.

Desktop users always get native OS notifications. ntfy is optional if you also want the same alerts on your phone.

### Browser fallback on desktop

Release installers bundle the compatible Patchright Chromium build. If fallback is needed, that browser appears visibly on your desktop so you can interact with it directly.

---

## 🍓 Raspberry Pi — easiest always-on setup

For a Raspberry Pi, Debian, or Ubuntu box, paste this one command:

```bash
curl -fsSL https://raw.githubusercontent.com/KingHacker9000/Claim-Free-Games/main/scripts/easy-install-pi.sh | bash
```

The installer will:

- install Node.js 22+ and the required Linux packages;
- install Chromium, Xvfb, x11vnc, noVNC, and websockify;
- install Claim Free Games;
- create a strong VNC password;
- prefer your Tailscale IP for private remote browser access when Tailscale is already installed;
- otherwise configure LAN-only remote access;
- generate a private ntfy topic you can keep or change;
- start a temporary browser-based setup wizard;
- enable the once-daily systemd timer after setup finishes.

The terminal prints a URL such as:

```text
http://192.168.1.50:8787/?token=...
```

Open that URL on your phone or computer and follow the three setup steps.

### Pi human fallback

The normal Pi run is browserless. If a real browser is required, Chromium runs on Xvfb. When Epic requires human input, noVNC starts temporarily and you receive a link to the browser.

For access away from home, install [Tailscale](https://tailscale.com/) on the Pi and your phone. Do not expose noVNC directly to the public internet.

---

## How claiming works

```text
once-daily check
      │
      ▼
Epic giveaway discovery
      │
      ▼
account entitlement check
      │
      ├── already owned ───────────────► silent exit
      │
      ▼
🔔 new unowned game detected
      │
      ▼
Launcher quickPurchase API
      │
      ├── entitlement appears ─────────► ✅ claimed
      │
      ▼
headed Chromium fallback
      │
      ├── entitlement appears ─────────► ✅ claimed
      │
      ▼
login / CAPTCHA / changed checkout
      │
      ├── desktop: visible browser
      │
      └── Pi: ntfy → noVNC
      │
      ▼
verify entitlement again
```

## Why API first?

The old version of this project was a Selenium script driven by fragile page XPaths. v2+ deliberately avoids that as the normal path.

The browser is now an **exception handler**, not the primary automation engine. This makes routine checks faster and much less sensitive to storefront redesigns.

## Advanced / CLI installation

If you prefer to manage the service yourself:

```bash
git clone https://github.com/KingHacker9000/Claim-Free-Games.git
cd Claim-Free-Games
npm install
npm run auth
npm run doctor
npm run claim
```

Useful commands:

| Command | Purpose |
|---|---|
| `npm run auth` | Epic OAuth setup from the terminal |
| `npm run setup` | Launch the Pi/browser setup wizard |
| `npm run doctor` | Verify auth, API access, and configuration |
| `npm run claim` | Run a claim cycle now |
| `npm run notify-test` | Test ntfy |
| `npm run assist-test -- --seconds=180` | Safely test Pi noVNC fallback |
| `npm test` | Unit tests |

## Building the desktop app

The desktop UI is Electron, but the claiming engine is shared with the headless/Pi version.

For local desktop development:

```bash
npm install
npm install --no-save electron@43.4.0 electron-builder@26.15.3
npm run browser:install
npm run desktop:dev
```

Release builds are produced by `.github/workflows/release.yml` for:

- Windows x64 — NSIS `.exe`
- macOS Apple Silicon — `.dmg` + `.zip`
- macOS Intel — `.dmg` + `.zip`
- Linux x64 — AppImage + `.deb`
- Raspberry Pi / Linux host — standalone easy-installer `.sh`

Run the workflow manually with a release tag such as `v2.1.0`, or push a `v*` tag. The workflow builds the installers, bundles the matching Chromium binary, runs tests, and creates the GitHub Release.

## Pi service status

```bash
systemctl list-timers claim-free-games.timer
journalctl -u claim-free-games.service -f
```

The timer runs approximately every 24 hours with randomized delay and `Persistent=true`, so a missed check runs after the Pi comes back online.

## Your data

Desktop data lives in the operating system's normal application-data directory. Pi/CLI data lives under `data/` in the installation directory.

```text
data/
├── session.json        # Epic OAuth tokens — secret
├── state.json          # previous giveaway/claim state
├── browser-profile/    # persistent fallback browser login
└── screenshots/        # failure screenshots
```

The project never asks you to save your Epic password. Treat `session.json` like a password because it contains OAuth tokens.

## Security notes

- Epic password entry happens on Epic's own login page.
- The desktop login window uses an in-memory browser session for initial OAuth setup.
- Pi remote browser access is password protected and should stay on your LAN or Tailscale.
- Setup wizard API calls are protected by a random temporary setup token.
- The Launcher `quickPurchase` endpoint is not a documented public consumer API and can change; the browser fallback exists for that reason.

## Project layout

```text
src/
├── epic-api.ts        # OAuth, discovery, entitlements, quickPurchase
├── claimer.ts         # shared orchestration + entitlement verification
├── browser.ts         # Patchright Chromium fallback
├── remote-assist.ts   # Pi noVNC escalation
├── notifier.ts        # ntfy + desktop notification hook
├── setup-server.ts    # browser setup wizard for Pi/headless hosts
├── storage.ts         # secure session/state persistence
└── index.ts           # CLI

desktop/
├── main.ts            # Electron tray app + daily scheduler
├── preload.cjs        # sandboxed renderer bridge
└── ui/                # zero-framework setup/dashboard UI
```

## Disclaimer

This is an unofficial community project and is not affiliated with or endorsed by Epic Games. Epic may change store APIs, authentication, or checkout behavior at any time.

---

<div align="center">

**Install it once. Let it stay quiet until there is actually a free game to claim.**

</div>
