import { config } from './config.js';

export type NotificationOptions = { priority?: number; click?: string };
export type NotificationEvent = { title: string; message: string; priority: number; click?: string };
export type NotificationSink = (event: NotificationEvent) => void | Promise<void>;

let sink: NotificationSink | undefined;

export function setNotificationSink(next?: NotificationSink) {
  sink = next;
}

export async function notify(title: string, message: string, opts: NotificationOptions = {}) {
  const event: NotificationEvent = { title, message, priority: opts.priority ?? 3, click: opts.click };
  console.log(`[notify] ${title}: ${message}`);

  if (sink) {
    try { await sink(event); }
    catch (e) { console.warn('local notification failed:', e); }
  }

  if (!config.ntfyUrl) return;
  const headers: Record<string, string> = {
    Title: title,
    Priority: String(event.priority),
    Tags: 'video_game',
  };
  if (opts.click) headers.Click = opts.click;
  const res = await fetch(config.ntfyUrl, { method: 'POST', headers, body: message });
  if (!res.ok) console.warn(`ntfy failed: ${res.status} ${await res.text()}`);
}
