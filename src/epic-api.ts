import type { Entitlement, EpicSession, FreeOffer } from './types.js';
import { config } from './config.js';

// Epic Games Launcher OAuth client used by Legendary and other launcher-compatible clients.
const CLIENT_ID = '34a02cf8f4414e29b15921876da36f9a';
const CLIENT_SECRET = 'daafbccc737745039dffe53d94fc76cf';
const ACCOUNT = 'https://account-public-service-prod03.ol.epicgames.com';
const ENTITLEMENTS = 'https://entitlement-public-service-prod08.ol.epicgames.com';
const ORDERS = 'https://orderprocessor-public-service-ecomprod01.ol.epicgames.com';
const FREE_GAMES = 'https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions';
const USER_AGENT = 'UELauncher/18.0.0 Claim-Free-Games/2';

const basic = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`;

async function readError(res: Response) {
  const text = await res.text();
  try { return JSON.stringify(JSON.parse(text)); } catch { return text; }
}

async function oauth(body: URLSearchParams): Promise<EpicSession> {
  const res = await fetch(`${ACCOUNT}/account/api/oauth/token`, {
    method: 'POST',
    headers: { Authorization: basic, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
    body,
  });
  if (!res.ok) throw new Error(`Epic OAuth ${res.status}: ${await readError(res)}`);
  return await res.json() as EpicSession;
}

export function authorizationUrl() {
  const redirect = `https://www.epicgames.com/id/api/redirect?clientId=${CLIENT_ID}&responseType=code`;
  return `https://www.epicgames.com/id/login?redirectUrl=${encodeURIComponent(redirect)}`;
}

export function exchangeAuthorizationCode(code: string) {
  return oauth(new URLSearchParams({ grant_type: 'authorization_code', code, token_type: 'eg1' }));
}

export function refreshSession(session: EpicSession) {
  return oauth(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: session.refresh_token, token_type: 'eg1' }));
}

export function extractFreeOffers(payload: any, now = new Date()): FreeOffer[] {
  const elements = payload?.data?.Catalog?.searchStore?.elements ?? [];
  const out: FreeOffer[] = [];
  for (const e of elements) {
    const promos = e?.promotions?.promotionalOffers ?? [];
    for (const group of promos) for (const p of group?.promotionalOffers ?? []) {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      const free = p?.discountSetting?.discountPercentage === 0;
      if (!free || !(start <= now && now < end)) continue;
      const slug = e?.catalogNs?.mappings?.find((m: any) => m.pageType === 'productHome')?.pageSlug
        ?? e?.offerMappings?.find((m: any) => m.pageType === 'productHome')?.pageSlug
        ?? e?.productSlug?.replace(/\/home$/, '')
        ?? e?.urlSlug;
      if (!e?.id || !e?.namespace || !slug) continue;
      out.push({
        title: e.title ?? slug,
        namespace: e.namespace,
        offerId: e.id,
        catalogItemIds: (e.items ?? []).map((x: any) => x.id).filter(Boolean),
        slug,
        url: `https://store.epicgames.com/en-US/p/${slug}`,
        startDate: p.startDate,
        endDate: p.endDate,
      });
      break;
    }
  }
  return [...new Map(out.map(x => [`${x.namespace}:${x.offerId}`, x])).values()];
}

export async function discoverFreeOffers(country: string): Promise<FreeOffer[]> {
  const url = new URL(FREE_GAMES);
  url.searchParams.set('locale', config.locale);
  url.searchParams.set('country', country);
  url.searchParams.set('allowCountries', country);
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Free-game discovery ${res.status}: ${await readError(res)}`);
  return extractFreeOffers(await res.json());
}

export async function fetchEntitlements(session: EpicSession): Promise<Entitlement[]> {
  const all: Entitlement[] = [];
  for (let start = 0; ; start += 1000) {
    const url = new URL(`${ENTITLEMENTS}/entitlement/api/account/${session.account_id}/entitlements`);
    url.searchParams.set('start', String(start));
    url.searchParams.set('count', '1000');
    const res = await fetch(url, { headers: { Authorization: `bearer ${session.access_token}`, 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`Entitlements ${res.status}: ${await readError(res)}`);
    const page = await res.json() as Entitlement[];
    all.push(...page);
    if (page.length < 1000) return all;
  }
}

export function isOwned(offer: FreeOffer, entitlements: Entitlement[]) {
  const ids = new Set([offer.offerId, ...offer.catalogItemIds]);
  return entitlements.some(e => e.namespace === offer.namespace && !!e.catalogItemId && ids.has(e.catalogItemId) && e.status !== 'REVOKED');
}

export async function quickPurchase(session: EpicSession, offer: FreeOffer) {
  const country = session.country || config.country;
  const url = new URL(`${ORDERS}/orderprocessor/api/shared/accounts/${session.account_id}/orders/quickPurchase`);
  url.searchParams.set('country', country);
  url.searchParams.set('locale', config.locale);
  const body = {
    salesChannel: 'Launcher-purchase-client',
    entitlementSource: 'Launcher-purchase-client',
    returnSplitPaymentItems: false,
    lineOffers: [{ offerId: offer.offerId, quantity: 1, namespace: offer.namespace }],
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 429 && attempt === 0) {
      const wait = Math.min(Number(res.headers.get('retry-after') || 5), 60);
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;
    }
    const text = await res.text();
    let result: any = text;
    try { result = JSON.parse(text); } catch {}
    if (!res.ok) throw new Error(`quickPurchase ${res.status}: ${typeof result === 'string' ? result : JSON.stringify(result)}`);
    return result;
  }
  throw new Error('quickPurchase rate-limited twice');
}

export async function waitForOwnership(session: EpicSession, offer: FreeOffer, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    if (isOwned(offer, await fetchEntitlements(session))) return true;
    if (i + 1 < attempts) await new Promise(r => setTimeout(r, 2500));
  }
  return false;
}
