# Claim-Free-Games v2

A Raspberry-Pi-friendly Epic Games giveaway claimer. v2 deliberately does **not** scrape the free-games page with Selenium.

## Strategy

1. **API discovery** — query Epic's free-games promotions JSON and extract current zero-cost offers.
2. **API ownership check** — query account entitlements and skip anything already owned.
3. **API claim** — submit the free offer through Epic's Launcher `quickPurchase` order endpoint.
4. **Verify** — re-query entitlements. A UI/API response alone is never treated as proof of ownership.
5. **Browser fallback** — only if the API transaction does not produce an entitlement, launch a persistent headed Chromium via Patchright on a virtual X display.
6. **Human fallback** — if Epic asks for login/CAPTCHA or the checkout DOM changes, start noVNC, send an ntfy phone alert, wait for you to finish, then verify ownership and continue.

Normal runs therefore use no browser at all.

## Raspberry Pi 5 setup

Requirements: 64-bit Raspberry Pi OS or Ubuntu and Node.js 22+.

```bash
git clone https://github.com/KingHacker9000/Claim-Free-Games.git
cd Claim-Free-Games
git switch v2-api-browser-fallback
chmod +x scripts/install-pi.sh
./scripts/install-pi.sh
```

### One-time Epic API login

No Epic password is stored by this project.

```bash
npm run auth
```

The command prints an Epic login URL. Open it on any device, sign in, copy the `authorizationCode` from the JSON response, then run:

```bash
npm run auth -- --code=PASTE_CODE_HERE
```

The OAuth session is stored at `data/session.json` with mode `0600`. Epic refresh tokens rotate, so the new session is written atomically after every refresh.

### Phone notifications + remote browser

Install the **ntfy** app on your phone and subscribe to a long random/private topic. Edit `.env`:

```bash
NTFY_URL=https://ntfy.sh/a-long-random-private-topic
REMOTE_ASSIST_URL=http://pi5:6080/vnc.html?autoconnect=true&resize=remote
VNC_PASSWORD=use-a-strong-password
```

If you use Tailscale, use the Pi's Tailscale hostname/IP for `REMOTE_ASSIST_URL`. The noVNC server is started only when human intervention is required. x11vnc itself binds to localhost and requires the configured VNC password; websockify exposes the browser page on `REMOTE_ASSIST_BIND` (default `0.0.0.0`). Prefer accessing that port only through your LAN/Tailscale and do not port-forward it to the public internet.

Run a health check:

```bash
npm run doctor
```

Test a claim cycle now:

```bash
npm run claim
```

Then enable/start the timer:

```bash
sudo systemctl start claim-free-games.timer
systemctl list-timers claim-free-games.timer
journalctl -u claim-free-games.service -f
```

The included timer checks every 6 hours with a random delay, so it also handles periods where Epic changes giveaways daily.

## State layout

```text
data/
  session.json        # Epic OAuth refresh/access tokens; 0600
  state.json          # claim history/status
  browser-profile/    # persistent browser login used only for fallback
  screenshots/        # browser failure evidence
```

## Failure model

The API is primary because it is much less sensitive to storefront DOM changes. Browser fallback uses stable test IDs/roles where possible. If browser automation cannot safely determine what changed, it asks for human intervention rather than clicking arbitrary elements.

A claim is marked successful only when an Epic entitlement matching the giveaway namespace/catalog item appears on the account.

## Security notes

- Never commit `.env`, `data/session.json`, or `data/browser-profile`.
- This repo does not store your Epic email/password.
- Treat the OAuth session file like a password.
- `quickPurchase` is an Epic Launcher service endpoint and is not a documented public consumer API; Epic may change it. That is why the browser fallback is kept as a separate path.

## Legacy version

The old `Buy_Free_Games.py` / packaged executables remain in the repository history. v2 does not depend on them or the bundled ChromeDriver.
