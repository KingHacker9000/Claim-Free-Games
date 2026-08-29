import { access, mkdir } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { config } from './config.js';
import { notify } from './notifier.js';

let processes: ChildProcess[] = [];

async function firstExisting(paths: string[]) {
  for (const p of paths) try { await access(p); return p; } catch {}
  return undefined;
}

async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const p = spawn(command, args, { stdio: 'ignore' });
    p.once('error', reject);
    p.once('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}

export async function startRemoteAssist(reason: string, click?: string) {
  const display = process.env.DISPLAY;
  if (!display) throw new Error('Cannot start remote assist without DISPLAY');
  if (!config.vncPassword) throw new Error('VNC_PASSWORD is not configured');
  const novnc = await firstExisting(['/usr/share/novnc', '/usr/share/novnc/']);
  if (!novnc) throw new Error('noVNC web files not found; install novnc');

  await mkdir(config.dataDir, { recursive: true });
  const authFile = join(config.dataDir, '.vnc-pass');
  await run('x11vnc', ['-storepasswd', config.vncPassword, authFile]);

  const x11vnc = spawn('x11vnc', ['-display', display, '-forever', '-shared', '-localhost', '-rfbport', '5900', '-rfbauth', authFile], { stdio: 'ignore' });
  const websockify = spawn('websockify', ['--web', novnc, `${config.remoteAssistBind}:${config.remoteAssistPort}`, 'localhost:5900'], { stdio: 'ignore' });
  x11vnc.on('error', e => console.error('x11vnc:', e));
  websockify.on('error', e => console.error('websockify:', e));
  processes.push(x11vnc, websockify);

  const url = config.remoteAssistUrl || `http://localhost:${config.remoteAssistPort}/vnc.html?autoconnect=true&resize=remote`;
  await notify('Claim Free Games needs you', `${reason}\nOpen the remote browser: ${url}`, { priority: 5, click: config.remoteAssistUrl || click || url });
  return url;
}

export function stopRemoteAssist() {
  for (const p of processes) if (!p.killed) p.kill('SIGTERM');
  processes = [];
}
