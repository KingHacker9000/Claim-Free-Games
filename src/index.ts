import { mkdir } from 'node:fs/promises';
import { config } from './config.js';
import { authorizationUrl, discoverFreeOffers, exchangeAuthorizationCode, fetchEntitlements, isOwned, quickPurchase, refreshSession, waitForOwnership } from './epic-api.js';
import { claimWithBrowser, testBrowserAssist } from './browser.js';
import { loadSession, loadState, saveSession, saveState } from './storage.js';
import { notify } from './notifier.js';
import type { EpicSession, FreeOffer } from './types.js';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getFreshSession(): Promise<EpicSession> {
  const old = await loadSession();
  if (!old) throw new Error('AUTH_REQUIRED: run `npm run auth` first');
  const fresh = await refreshSession(old);
  await saveSession(fresh); // Epic rotates refresh tokens; persist immediately.
  return fresh;
}

async function auth(args: string[]) {
  const raw = args.find(x => x.startsWith('--code='))?.slice(7) || process.env.EPIC_AUTH_CODE;
  if (!raw) {
    console.log('\nOpen this URL in any browser, sign in, and copy the authorizationCode from the JSON page:\n');
    console.log(authorizationUrl());
    console.log('\nThen run:\n  npm run auth -- --code=PASTE_CODE_HERE\n');
    return;
  }
  const session = await exchangeAuthorizationCode(raw.trim());
  await saveSession(session);
  console.log(`Authenticated as ${session.displayName || session.display_name || session.account_id} (${session.country || 'country unknown'}).`);
}

async function apiClaim(session: EpicSession, offer: FreeOffer) {
  const response = await quickPurchase(session, offer);
  console.log(`[api] ${offer.title}: ${JSON.stringify(response)}`);
  return await waitForOwnership(session, offer);
}

async function run() {
  await mkdir(config.dataDir, { recursive: true });
  const state = await loadState();
  let session: EpicSession;
  try { session = await getFreshSession(); }
  catch (e: any) {
    await notify('Claim Free Games: sign-in needed', String(e?.message || e), { priority: 5 });
    throw e;
  }

  const country = session.country || config.country;
  const offers = await discoverFreeOffers(country);
  console.log(`Found ${offers.length} currently-free offer(s) for ${country}.`);
  let entitlements = await fetchEntitlements(session);
  let failures = 0;

  for (const offer of offers) {
    const key = `${offer.namespace}:${offer.offerId}`;
    if (isOwned(offer, entitlements)) {
      console.log(`[owned] ${offer.title}`);
      state.offers[key] = { title: offer.title, status: 'owned', method: 'existing', updatedAt: new Date().toISOString() };
      continue;
    }

    // Stay silent on routine daily checks. Only alert when a newly-seen giveaway
    // is actually missing from the account and a claim attempt is about to start.
    if (!state.offers[key]) {
      await notify(
        'New free Epic game detected',
        `${offer.title} is free and not in your library. Starting the claim now.`,
        { priority: 4, click: offer.url },
      );
    }

    let claimed = false;
    let apiError = '';
    try {
      claimed = await apiClaim(session, offer);
    } catch (e: any) {
      apiError = String(e?.message || e);
      console.warn(`[api fallback] ${offer.title}: ${apiError}`);
    }

    if (claimed) {
      state.offers[key] = { title: offer.title, status: 'claimed', method: 'api', updatedAt: new Date().toISOString() };
      await notify('Free game claimed', `${offer.title} was claimed through the Epic API.`, { click: offer.url });
      entitlements = await fetchEntitlements(session);
      continue;
    }

    // API did not produce an entitlement. Escalate to a real, headed browser on Xvfb.
    const browserResult = await claimWithBrowser(offer).catch(e => {
      console.error(`[browser] ${offer.title}:`, e);
      return false;
    });
    // Browser UI is not authoritative. Verify against Epic account data.
    claimed = browserResult && await waitForOwnership(session, offer, 4).catch(() => false);
    if (claimed) {
      state.offers[key] = { title: offer.title, status: 'claimed', method: 'browser', updatedAt: new Date().toISOString(), message: apiError || undefined };
      await notify('Free game claimed', `${offer.title} was claimed through browser fallback.`, { click: offer.url });
      entitlements = await fetchEntitlements(session);
    } else {
      failures++;
      state.offers[key] = { title: offer.title, status: 'failed', updatedAt: new Date().toISOString(), message: apiError || 'Browser fallback failed or ownership could not be verified' };
      await notify('Free game claim failed', `${offer.title} still is not owned. Open it manually before ${offer.endDate}.`, { priority: 5, click: offer.url });
    }
    await saveState(state);
    await sleep(1000);
  }

  await saveState(state);
  if (failures) throw new Error(`${failures} free-game claim(s) failed`);
}

async function doctor() {
  const s = await loadSession();
  console.log(`Node: ${process.version}`);
  console.log(`Data dir: ${config.dataDir}`);
  console.log(`Epic session: ${s ? 'present' : 'missing'}`);
  console.log(`ntfy: ${config.ntfyUrl ? 'configured' : 'not configured'}`);
  console.log(`Remote assist URL: ${config.remoteAssistUrl || 'not configured'}`);
  if (s) {
    const fresh = await refreshSession(s);
    await saveSession(fresh);
    const country = fresh.country || config.country;
    const offers = await discoverFreeOffers(country);
    const entitlements = await fetchEntitlements(fresh);
    console.log(`Epic API: OK (${fresh.displayName || fresh.display_name || fresh.account_id}, ${country})`);
    console.log(`Current freebies: ${offers.length}; entitlements: ${entitlements.length}`);
  }
}

async function notifyTest() {
  if (!config.ntfyUrl) throw new Error('NTFY_URL is not configured in .env');
  await notify('Claim-Free-Games test', 'Phone notifications from your Raspberry Pi are working.', { priority: 4 });
  console.log('Notification request sent successfully.');
}

async function assistTest(args: string[]) {
  if (!config.vncPassword) throw new Error('VNC_PASSWORD is not configured in .env');
  const raw = args.find(x => x.startsWith('--seconds='))?.slice('--seconds='.length);
  const seconds = raw ? Math.max(15, Math.min(Number(raw) || 120, 900)) : 120;
  await testBrowserAssist(seconds);
}

const [command = 'run', ...args] = process.argv.slice(2);
try {
  if (command === 'auth') await auth(args);
  else if (command === 'doctor') await doctor();
  else if (command === 'notify-test') await notifyTest();
  else if (command === 'assist-test') await assistTest(args);
  else if (command === 'run') await run();
  else throw new Error(`Unknown command: ${command}`);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
}
