import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

if (existsSync('.env')) process.loadEnvFile('.env');

const int = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const config = {
  get dataDir() { return resolve(process.env.DATA_DIR || 'data'); },
  get locale() { return process.env.EPIC_LOCALE || 'en-US'; },
  get country() { return process.env.EPIC_COUNTRY || 'US'; },
  get browserExecutable() { return process.env.BROWSER_EXECUTABLE_PATH || undefined; },
  get humanTimeoutMs() { return int('BROWSER_HUMAN_TIMEOUT_MS', 15 * 60_000); },
  get remoteAssistPort() { return int('REMOTE_ASSIST_PORT', 6080); },
  get remoteAssistBind() { return process.env.REMOTE_ASSIST_BIND || '0.0.0.0'; },
  get vncPassword() { return process.env.VNC_PASSWORD || ''; },
  get remoteAssistUrl() { return process.env.REMOTE_ASSIST_URL || ''; },
  get ntfyUrl() { return process.env.NTFY_URL || ''; },
  get desktopMode() { return process.env.CFG_DESKTOP === '1'; },
};
