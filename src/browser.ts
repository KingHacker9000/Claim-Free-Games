import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type BrowserContext, type FrameLocator, type Page } from 'patchright';
import { config } from './config.js';
import type { FreeOffer } from './types.js';
import { notify } from './notifier.js';
import { startRemoteAssist, stopRemoteAssist } from './remote-assist.js';

let xvfb: ChildProcess | undefined;

async function ensureDisplay() {
  if (process.env.DISPLAY || process.platform !== 'linux') return;
  process.env.DISPLAY = ':99';
  xvfb = spawn('Xvfb', [':99', '-screen', '0', '1440x900x24', '-nolisten', 'tcp'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 700));
  if (xvfb.exitCode !== null) throw new Error('Xvfb failed to start. Install xvfb or set DISPLAY.');
}

async function humanGate(page: Page, reason: string, gameUrl: string, done: () => Promise<boolean>) {
  await startRemoteAssist(reason, gameUrl);
  const deadline = Date.now() + config.humanTimeoutMs;
  while (Date.now() < deadline) {
    if (await done().catch(() => false)) { stopRemoteAssist(); return true; }
    await page.waitForTimeout(2000);
  }
  stopRemoteAssist();
  return false;
}

async function loggedIn(page: Page) {
  const nav = page.locator('egs-navigation');
  if (!await nav.count()) return false;
  return await nav.getAttribute('isloggedin') === 'true';
}

async function findCheckout(_context: BrowserContext, page: Page): Promise<FrameLocator | null> {
  await page.locator('#webPurchaseContainer iframe').waitFor({ state: 'attached', timeout: 30_000 }).catch(() => {});
  if (await page.locator('#webPurchaseContainer iframe').count()) return page.frameLocator('#webPurchaseContainer iframe');
  return null;
}

async function hasCaptcha(frame: FrameLocator) {
  return await frame.locator('iframe[id*="captcha"], iframe[src*="hcaptcha"], .h-captcha').count() > 0;
}

export async function claimWithBrowser(offer: FreeOffer): Promise<boolean> {
  await ensureDisplay();
  const profile = join(config.dataDir, 'browser-profile');
  const shots = join(config.dataDir, 'screenshots');
  await mkdir(profile, { recursive: true });
  await mkdir(shots, { recursive: true });

  const context = await chromium.launchPersistentContext(profile, {
    headless: false,
    executablePath: config.browserExecutable,
    viewport: { width: 1440, height: 900 },
    locale: config.locale,
    handleSIGINT: false,
    args: ['--hide-crash-restore-bubble', '--disable-dev-shm-usage'],
  });
  const page = context.pages()[0] ?? await context.newPage();
  try {
    await context.addCookies([
      { name: 'OptanonAlertBoxClosed', value: new Date(Date.now() - 5 * 86400_000).toISOString(), domain: '.epicgames.com', path: '/' },
      { name: 'HasAcceptedAgeGates', value: 'general:18', domain: 'store.epicgames.com', path: '/' },
    ]);
    await page.goto(offer.url, { waitUntil: 'domcontentloaded' });

    if (!await loggedIn(page)) {
      const ok = await humanGate(page, 'Epic browser session is signed out. Please sign in once; the profile will persist on the Pi.', offer.url, () => loggedIn(page));
      if (!ok) return false;
      await page.goto(offer.url, { waitUntil: 'domcontentloaded' });
    }

    const purchase = page.locator('button[data-testid="purchase-cta-button"]').first();
    await purchase.waitFor({ timeout: 45_000 });
    let label = (await purchase.innerText()).trim().toLowerCase();
    if (label.includes('in library') || label.includes('owned')) return true;

    const continueButton = page.getByRole('button', { name: /^continue$/i });
    if (await continueButton.count()) await continueButton.first().click().catch(() => {});
    await purchase.click({ delay: 15 });
    await page.getByRole('button', { name: /yes, buy now/i }).click().catch(() => {});

    const eula = page.locator('input#agree');
    if (await eula.count()) {
      await eula.check();
      await page.getByRole('button', { name: /^accept$/i }).click();
    }

    const frame = await findCheckout(context, page);
    if (!frame) {
      const ok = await humanGate(page, `Checkout UI changed for ${offer.title}. Complete the free order manually.`, offer.url, async () => {
        await page.goto(offer.url, { waitUntil: 'domcontentloaded' }).catch(() => {});
        label = (await purchase.innerText().catch(() => '')).trim().toLowerCase();
        return label.includes('in library') || label.includes('owned');
      });
      return ok;
    }

    if (await frame.locator(':text-matches("unavailable in your region", "i")').count()) return false;
    const placeOrder = frame.getByRole('button', { name: /place order/i });
    await placeOrder.waitFor({ timeout: 45_000 }).catch(() => {});

    if (await hasCaptcha(frame)) {
      return await humanGate(page, `Epic requested a CAPTCHA before claiming ${offer.title}. Solve it and finish the order.`, offer.url, async () => {
        return await page.getByText(/thanks for your order/i).count() > 0;
      });
    }

    if (await placeOrder.count()) await placeOrder.click({ delay: 15 });
    const accept = frame.getByRole('button', { name: /i accept/i });
    if (await accept.count()) await accept.click().catch(() => {});

    const success = page.getByText(/thanks for your order/i);
    if (await success.waitFor({ state: 'attached', timeout: 60_000 }).then(() => true).catch(() => false)) return true;

    if (await hasCaptcha(frame)) {
      return await humanGate(page, `Epic requested a CAPTCHA for ${offer.title}. Solve it and finish the order.`, offer.url, async () => await success.count() > 0);
    }

    await page.screenshot({ path: join(shots, `${offer.offerId}-failed.png`), fullPage: true });
    await notify('Browser claim failed', `${offer.title}: checkout did not report success.`, { priority: 4, click: offer.url });
    return false;
  } finally {
    stopRemoteAssist();
    await context.close().catch(() => {});
    if (xvfb && !xvfb.killed) xvfb.kill('SIGTERM');
    xvfb = undefined;
  }
}
