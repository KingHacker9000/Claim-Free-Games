import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import { authorizationUrl, exchangeAuthorizationCode } from './epic-api.js';
import { loadSession, saveSession } from './storage.js';
import { notify } from './notifier.js';
import { config } from './config.js';

const port = Number(process.env.SETUP_PORT || 8787);
const token = randomBytes(18).toString('hex');
const htmlPath = resolve('setup/index.html');

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function body(req: IncomingMessage) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error('Request too large');
  }
  return raw ? JSON.parse(raw) : {};
}

async function updateEnv(values: Record<string, string>) {
  let text = '';
  try { text = await readFile('.env', 'utf8'); } catch {}
  const lines = text.split(/\r?\n/).filter(Boolean);
  const keys = new Set(Object.keys(values));
  const kept = lines.filter(line => !keys.has(line.split('=', 1)[0]));
  for (const [key, value] of Object.entries(values)) kept.push(`${key}=${value.replace(/[\r\n]/g, '')}`);
  await writeFile('.env', kept.join('\n') + '\n', { mode: 0o600 });
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
}

function localAddresses() {
  const out: string[] = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const item of entries || []) if (item.family === 'IPv4' && !item.internal) out.push(item.address);
  }
  return [...new Set(out)];
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/' && req.method === 'GET') {
      const html = await readFile(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
      return;
    }

    if (req.headers['x-setup-token'] !== token) return json(res, 403, { error: 'Invalid setup token' });

    if (url.pathname === '/api/status' && req.method === 'GET') {
      const session = await loadSession();
      return json(res, 200, {
        connected: !!session,
        displayName: session?.displayName || session?.display_name || session?.account_id || '',
        country: session?.country || '',
        authUrl: authorizationUrl(),
        ntfyUrl: config.ntfyUrl,
        remoteAssistUrl: config.remoteAssistUrl,
        vncPassword: config.vncPassword,
      });
    }

    if (url.pathname === '/api/auth' && req.method === 'POST') {
      const data = await body(req);
      const raw = String(data.code || '').trim();
      let code = raw;
      try { code = JSON.parse(raw)?.authorizationCode || raw; } catch {}
      if (!code) return json(res, 400, { error: 'Paste the authorizationCode or the JSON response.' });
      const session = await exchangeAuthorizationCode(code);
      await saveSession(session);
      return json(res, 200, { ok: true, displayName: session.displayName || session.display_name || session.account_id, country: session.country || '' });
    }

    if (url.pathname === '/api/settings' && req.method === 'POST') {
      const data = await body(req);
      await updateEnv({
        NTFY_URL: String(data.ntfyUrl || '').trim(),
        REMOTE_ASSIST_URL: String(data.remoteAssistUrl || config.remoteAssistUrl || '').trim(),
        REMOTE_ASSIST_BIND: String(data.remoteAssistBind || config.remoteAssistBind || '0.0.0.0').trim(),
      });
      return json(res, 200, { ok: true });
    }

    if (url.pathname === '/api/notify-test' && req.method === 'POST') {
      const data = await body(req);
      if (data.ntfyUrl !== undefined) await updateEnv({ NTFY_URL: String(data.ntfyUrl || '').trim() });
      if (!config.ntfyUrl) return json(res, 400, { error: 'Enter an ntfy topic URL first.' });
      await notify('Claim Free Games test', 'Your Raspberry Pi notifications are working.', { priority: 4 });
      return json(res, 200, { ok: true });
    }

    if (url.pathname === '/api/finish' && req.method === 'POST') {
      if (!await loadSession()) return json(res, 400, { error: 'Connect your Epic account first.' });
      json(res, 200, { ok: true });
      setTimeout(() => server.close(), 250);
      return;
    }

    json(res, 404, { error: 'Not found' });
  } catch (e: any) {
    json(res, 500, { error: String(e?.message || e) });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log('\nClaim Free Games setup wizard\n');
  const addresses = localAddresses();
  if (!addresses.length) console.log(`Open: http://localhost:${port}/?token=${token}`);
  for (const address of addresses) console.log(`Open: http://${address}:${port}/?token=${token}`);
  console.log('\nKeep this terminal open until the wizard says setup is complete.\n');
});
