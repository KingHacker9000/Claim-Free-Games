import { config } from './config.js';
import { authorizationUrl, discoverFreeOffers, exchangeAuthorizationCode, fetchEntitlements, refreshSession } from './epic-api.js';
import { testBrowserAssist } from './browser.js';
import { runClaimCycle } from './claimer.js';
import { loadSession, saveSession } from './storage.js';
import { notify } from './notifier.js';

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
  else if (command === 'run') await runClaimCycle();
  else throw new Error(`Unknown command: ${command}`);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
}
