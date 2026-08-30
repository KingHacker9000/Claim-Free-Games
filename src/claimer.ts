import { mkdir } from 'node:fs/promises';
import { config } from './config.js';
import { discoverFreeOffers, fetchEntitlements, isOwned, quickPurchase, refreshSession, waitForOwnership } from './epic-api.js';
import { claimWithBrowser } from './browser.js';
import { loadSession, loadState, saveSession, saveState } from './storage.js';
import { notify } from './notifier.js';
import type { EpicSession, FreeOffer } from './types.js';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export type ClaimRunResult = {
  title: string;
  status: 'owned' | 'claimed' | 'failed';
  method?: 'existing' | 'api' | 'browser';
  message?: string;
};

export type ClaimRunSummary = {
  country: string;
  checked: number;
  owned: number;
  claimedApi: number;
  claimedBrowser: number;
  failed: number;
  results: ClaimRunResult[];
};

export async function getFreshSession(): Promise<EpicSession> {
  const old = await loadSession();
  if (!old) throw new Error('AUTH_REQUIRED: connect your Epic account first');
  const fresh = await refreshSession(old);
  await saveSession(fresh);
  return fresh;
}

async function apiClaim(session: EpicSession, offer: FreeOffer) {
  const response = await quickPurchase(session, offer);
  console.log(`[api] ${offer.title}: ${JSON.stringify(response)}`);
  return await waitForOwnership(session, offer);
}

export async function runClaimCycle(options: { throwOnFailure?: boolean } = {}): Promise<ClaimRunSummary> {
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
  const summary: ClaimRunSummary = { country, checked: offers.length, owned: 0, claimedApi: 0, claimedBrowser: 0, failed: 0, results: [] };

  for (const offer of offers) {
    const key = `${offer.namespace}:${offer.offerId}`;
    if (isOwned(offer, entitlements)) {
      console.log(`[owned] ${offer.title}`);
      summary.owned++;
      summary.results.push({ title: offer.title, status: 'owned', method: 'existing' });
      state.offers[key] = { title: offer.title, status: 'owned', method: 'existing', updatedAt: new Date().toISOString() };
      continue;
    }

    if (!state.offers[key]) {
      await notify('New free Epic game detected', `${offer.title} is free and not in your library. Starting the claim now.`, { priority: 4, click: offer.url });
    }

    let claimed = false;
    let apiError = '';
    try { claimed = await apiClaim(session, offer); }
    catch (e: any) {
      apiError = String(e?.message || e);
      console.warn(`[api fallback] ${offer.title}: ${apiError}`);
    }

    if (claimed) {
      summary.claimedApi++;
      summary.results.push({ title: offer.title, status: 'claimed', method: 'api' });
      state.offers[key] = { title: offer.title, status: 'claimed', method: 'api', updatedAt: new Date().toISOString() };
      await saveState(state);
      await notify('Free game claimed', `${offer.title} was claimed through the Epic API.`, { click: offer.url });
      entitlements = await fetchEntitlements(session);
      continue;
    }

    await claimWithBrowser(offer).catch(e => console.error(`[browser] ${offer.title}:`, e));
    // The storefront UI is never authoritative. Always verify the entitlement,
    // even if the browser could not recognize its own success page.
    claimed = await waitForOwnership(session, offer, 4).catch(() => false);

    if (claimed) {
      summary.claimedBrowser++;
      summary.results.push({ title: offer.title, status: 'claimed', method: 'browser', message: apiError || undefined });
      state.offers[key] = { title: offer.title, status: 'claimed', method: 'browser', updatedAt: new Date().toISOString(), message: apiError || undefined };
      await notify('Free game claimed', `${offer.title} was claimed through browser fallback.`, { click: offer.url });
      entitlements = await fetchEntitlements(session);
    } else {
      summary.failed++;
      const message = apiError || 'Browser fallback failed or ownership could not be verified';
      summary.results.push({ title: offer.title, status: 'failed', message });
      state.offers[key] = { title: offer.title, status: 'failed', updatedAt: new Date().toISOString(), message };
      await notify('Free game claim failed', `${offer.title} still is not owned. Open it manually before ${offer.endDate}.`, { priority: 5, click: offer.url });
    }

    await saveState(state);
    await sleep(1000);
  }

  await saveState(state);
  if (summary.failed && options.throwOnFailure !== false) throw new Error(`${summary.failed} free-game claim(s) failed`);
  return summary;
}
