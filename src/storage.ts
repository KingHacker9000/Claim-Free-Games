import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ClaimState, EpicSession } from './types.js';
import { config } from './config.js';

const sessionPath = join(config.dataDir, 'session.json');
const statePath = join(config.dataDir, 'state.json');

async function readJson<T>(path: string): Promise<T | null> {
  try { return JSON.parse(await readFile(path, 'utf8')) as T; }
  catch (e: any) { if (e?.code === 'ENOENT') return null; throw e; }
}

async function atomicJson(path: string, value: unknown, mode = 0o600) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2) + '\n', { mode });
  await chmod(tmp, mode);
  await rename(tmp, path);
}

export const loadSession = () => readJson<EpicSession>(sessionPath);
export const saveSession = (session: EpicSession) => atomicJson(sessionPath, session, 0o600);
export const loadState = async (): Promise<ClaimState> => (await readJson<ClaimState>(statePath)) ?? { offers: {} };
export const saveState = (state: ClaimState) => atomicJson(statePath, state, 0o600);
