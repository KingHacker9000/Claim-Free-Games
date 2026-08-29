import { config } from './config.js';

export async function notify(title: string, message: string, opts: { priority?: number; click?: string } = {}) {
  console.log(`[notify] ${title}: ${message}`);
  if (!config.ntfyUrl) return;
  const headers: Record<string, string> = {
    Title: title,
    Priority: String(opts.priority ?? 3),
    Tags: 'video_game',
  };
  if (opts.click) headers.Click = opts.click;
  const res = await fetch(config.ntfyUrl, { method: 'POST', headers, body: message });
  if (!res.ok) console.warn(`ntfy failed: ${res.status} ${await res.text()}`);
}
