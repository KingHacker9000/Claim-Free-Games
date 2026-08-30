import { app, BrowserWindow, ipcMain, Menu, nativeImage, Notification, shell, Tray } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const TRAY_ICON = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAuklEQVR4nO2W3Q2AIAyELXEOGVFG0RF1EXwyMfLTK2Ax0XusTftRzuowfF3EJUyL97VNdkfJPqa2eK1GNHGb5cXtyue8cwIt7j1V7+6HYAKtm3P1Te6hBgTFglraHVF3E/4A3QGgTXjdgsh2k+SzE7iv4JKVXAyQatYSAv4YcUJgY9fR3YRZgJSBECOiYq/Arpirr3HJWwB5oOWJiwCkkgC/24TfAsj9uz+hs5+JBbWaBwAaENqT/sXqANErOEdAmTAXAAAAAElFTkSuQmCC';

type DesktopSettings = {
  setupComplete: boolean;
  dailyChecks: boolean;
  ntfyUrl: string;
  lastCheckAt?: string;
  lastSummary?: unknown;
};

let mainWindow: BrowserWindow | null = null;
let authWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let running = false;
let quitting = false;
let scheduler: NodeJS.Timeout | undefined;
const __dirname = dirname(fileURLToPath(import.meta.url));

const settingsPath = () => join(app.getPath('userData'), 'settings.json');
const dataDir = () => join(app.getPath('userData'), 'data');

async function loadSettings(): Promise<DesktopSettings> {
  try {
    return { setupComplete: false, dailyChecks: true, ntfyUrl: '', ...JSON.parse(await readFile(settingsPath(), 'utf8')) };
  } catch (e: any) {
    if (e?.code !== 'ENOENT') console.warn('settings:', e);
    return { setupComplete: false, dailyChecks: true, ntfyUrl: '' };
  }
}

async function saveSettings(settings: DesktopSettings) {
  await mkdir(dirname(settingsPath()), { recursive: true });
  await writeFile(settingsPath(), JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 });
  process.env.NTFY_URL = settings.ntfyUrl || '';
}

async function configureCoreEnvironment() {
  process.env.DATA_DIR = dataDir();
  process.env.CFG_DESKTOP = '1';
  if (app.isPackaged) process.env.PLAYWRIGHT_BROWSERS_PATH = join(process.resourcesPath, 'patchright-browsers');
  const settings = await loadSettings();
  process.env.NTFY_URL = settings.ntfyUrl || '';
}

async function core() {
  const [epic, storage, claimer, notifier] = await Promise.all([
    import('../src/epic-api.js'),
    import('../src/storage.js'),
    import('../src/claimer.js'),
    import('../src/notifier.js'),
  ]);
  return { epic, storage, claimer, notifier };
}

function showMainWindow() {
  if (!mainWindow) return createMainWindow();
  mainWindow.show();
  mainWindow.focus();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 860,
    height: 720,
    minWidth: 700,
    minHeight: 600,
    title: 'Claim Free Games',
    backgroundColor: '#0b1020',
    webPreferences: {
      preload: app.isPackaged
        ? join(app.getAppPath(), 'desktop', 'preload.cjs')
        : join(__dirname, '../../desktop/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadFile(join(__dirname, '../../desktop/ui/index.html'));
  mainWindow.on('close', e => {
    if (!quitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  return mainWindow;
}

async function setAutoStart(enabled: boolean) {
  if (process.platform === 'linux') {
    const autostart = join(homedir(), '.config', 'autostart', 'claim-free-games.desktop');
    if (!enabled) {
      if (existsSync(autostart)) await import('node:fs/promises').then(fs => fs.unlink(autostart).catch(() => {}));
      return;
    }
    const exe = process.env.APPIMAGE || process.execPath;
    await mkdir(dirname(autostart), { recursive: true });
    await writeFile(autostart, `[Desktop Entry]\nType=Application\nName=Claim Free Games\nExec="${exe.replaceAll('"', '\\"')}" --background\nX-GNOME-Autostart-enabled=true\n`, 'utf8');
  } else {
    app.setLoginItemSettings({ openAtLogin: enabled, args: ['--background'] });
  }
}

async function installNotificationSink() {
  const { notifier } = await core();
  notifier.setNotificationSink(async event => {
    if (!Notification.isSupported()) return;
    const n = new Notification({ title: event.title, body: event.message });
    if (event.click) n.on('click', () => shell.openExternal(event.click!).catch(() => {}));
    n.show();
  });
}

async function getStatus() {
  const settings = await loadSettings();
  const { storage } = await core();
  const session = await storage.loadSession();
  const nextCheckAt = settings.lastCheckAt && settings.dailyChecks
    ? new Date(new Date(settings.lastCheckAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
    : undefined;
  return {
    version: app.getVersion(),
    connected: !!session,
    displayName: session?.displayName || session?.display_name || session?.account_id || '',
    country: session?.country || '',
    setupComplete: settings.setupComplete,
    dailyChecks: settings.dailyChecks,
    ntfyUrl: settings.ntfyUrl,
    lastCheckAt: settings.lastCheckAt,
    nextCheckAt,
    lastSummary: settings.lastSummary,
    running,
  };
}

async function runNow(source: 'manual' | 'scheduled' = 'manual') {
  if (running) return { ok: false, error: 'A check is already running.' };
  running = true;
  mainWindow?.webContents.send('run-state', { running: true, source });
  try {
    const { claimer } = await core();
    const summary = await claimer.runClaimCycle({ throwOnFailure: false });
    const settings = await loadSettings();
    settings.lastCheckAt = new Date().toISOString();
    settings.lastSummary = summary;
    await saveSettings(settings);
    mainWindow?.webContents.send('run-state', { running: false, summary });
    return { ok: true, summary };
  } catch (e: any) {
    const settings = await loadSettings();
    settings.lastCheckAt = new Date().toISOString();
    settings.lastSummary = { error: String(e?.message || e) };
    await saveSettings(settings);
    mainWindow?.webContents.send('run-state', { running: false, error: String(e?.message || e) });
    return { ok: false, error: String(e?.message || e) };
  } finally {
    running = false;
  }
}

async function maybeRunScheduled() {
  const settings = await loadSettings();
  if (!settings.setupComplete || !settings.dailyChecks || running) return;
  const last = settings.lastCheckAt ? new Date(settings.lastCheckAt).getTime() : 0;
  if (!last || Date.now() - last >= 24 * 60 * 60 * 1000) await runNow('scheduled');
}

function startScheduler() {
  if (scheduler) clearInterval(scheduler);
  scheduler = setInterval(() => void maybeRunScheduled(), 60 * 60 * 1000);
  setTimeout(() => void maybeRunScheduled(), 15_000);
}

async function connectEpic() {
  if (authWindow) { authWindow.focus(); return { ok: true }; }
  const { epic, storage } = await core();
  authWindow = new BrowserWindow({
    width: 980,
    height: 760,
    title: 'Connect Epic Games',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, partition: 'epic-auth' },
  });

  const inspectForCode = async () => {
    if (!authWindow || authWindow.isDestroyed()) return;
    try {
      const text = await authWindow.webContents.executeJavaScript('document.body?.innerText || ""', true) as string;
      if (!text.includes('authorizationCode')) return;
      const parsed = JSON.parse(text);
      const code = parsed?.authorizationCode;
      if (!code) return;
      const session = await epic.exchangeAuthorizationCode(String(code));
      await storage.saveSession(session);
      mainWindow?.webContents.send('epic-connected', {
        displayName: session.displayName || session.display_name || session.account_id,
        country: session.country || '',
      });
      authWindow.close();
    } catch {}
  };

  authWindow.webContents.on('did-finish-load', () => void inspectForCode());
  authWindow.webContents.on('did-navigate', () => setTimeout(() => void inspectForCode(), 300));
  authWindow.on('closed', () => { authWindow = null; });
  await authWindow.loadURL(epic.authorizationUrl());
  return { ok: true };
}

function createTray() {
  const icon = nativeImage.createFromDataURL(`data:image/png;base64,${TRAY_ICON}`).resize({ width: 18, height: 18 });
  tray = new Tray(icon);
  tray.setToolTip('Claim Free Games');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Claim Free Games', click: showMainWindow },
    { label: 'Check now', click: () => void runNow('manual') },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('double-click', showMainWindow);
}

ipcMain.handle('status', getStatus);
ipcMain.handle('epic:connect', connectEpic);
ipcMain.handle('epic:submit-code', async (_e, raw: string) => {
  try {
    const code = (() => {
      const trimmed = String(raw || '').trim();
      try { return JSON.parse(trimmed)?.authorizationCode || trimmed; } catch { return trimmed; }
    })();
    const { epic, storage } = await core();
    const session = await epic.exchangeAuthorizationCode(code);
    await storage.saveSession(session);
    return { ok: true, displayName: session.displayName || session.display_name || session.account_id, country: session.country || '' };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
});
ipcMain.handle('run-now', () => runNow('manual'));
ipcMain.handle('settings:save', async (_e, patch: Partial<DesktopSettings>) => {
  const settings = { ...(await loadSettings()), ...patch };
  await saveSettings(settings);
  await setAutoStart(settings.setupComplete && settings.dailyChecks);
  return getStatus();
});
ipcMain.handle('notification:test', async (_e, ntfyUrl: string) => {
  const settings = await loadSettings();
  settings.ntfyUrl = String(ntfyUrl || '').trim();
  await saveSettings(settings);
  const { notifier } = await core();
  await notifier.notify('Claim Free Games test', 'Notifications are working on this device.', { priority: 4 });
  return { ok: true };
});
ipcMain.handle('open:data', async () => shell.openPath(dataDir()));
ipcMain.handle('open:external', async (_e, url: string) => shell.openExternal(url));

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { /* stay in tray */ });
app.on('activate', showMainWindow);

app.whenReady().then(async () => {
  await configureCoreEnvironment();
  await installNotificationSink();
  createMainWindow();
  createTray();
  startScheduler();
  if (process.argv.includes('--background')) mainWindow?.hide();
});
