import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

if (existsSync('.env')) process.loadEnvFile('.env');

const int = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const config = {
  dataDir: resolve(process.env.DATA_DIR || 'data'),
  locale: process.env.EPIC_LOCALE || 'en-US',
  country: process.env.EPIC_COUNTRY || 'US',
  browserExecutable: process.env.BROWSER_EXECUTABLE_PATH || undefined,
  humanTimeoutMs: int('BROWSER_HUMAN_TIMEOUT_MS', 15 * 60_000),
  remoteAssistPort: int('REMOTE_ASSIST_PORT', 6080),
  remoteAssistBind: process.env.REMOTE_ASSIST_BIND || '0.0.0.0',
  vncPassword: process.env.VNC_PASSWORD || '',
  remoteAssistUrl: process.env.REMOTE_ASSIST_URL || '',
  ntfyUrl: process.env.NTFY_URL || '',
};
