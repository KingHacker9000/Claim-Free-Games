const $ = id => document.getElementById(id);
let current = null;

function fmtDate(value) {
  if (!value) return 'Not run yet';
  return new Date(value).toLocaleString();
}

function summaryText(summary) {
  if (!summary) return 'Run a check to see results here.';
  if (summary.error) return `Last run failed: ${summary.error}`;
  return `Checked ${summary.checked} giveaway${summary.checked === 1 ? '' : 's'} · Already owned ${summary.owned} · API claims ${summary.claimedApi} · Browser claims ${summary.claimedBrowser} · Failed ${summary.failed}`;
}

async function refresh() {
  current = await window.cfg.status();
  $('version').textContent = `v${current.version}`;
  const ready = current.connected && current.setupComplete;
  $('setup').classList.toggle('hidden', ready);
  $('dashboard').classList.toggle('hidden', !ready);

  if (!ready) {
    $('epic-status').textContent = current.connected ? `Connected as ${current.displayName}${current.country ? ` (${current.country})` : ''}` : 'Not connected yet.';
    $('epic-status').className = current.connected ? 'good' : 'muted';
    $('setup-ntfy').value = current.ntfyUrl || '';
    $('setup-daily').checked = current.dailyChecks !== false;
    return;
  }

  $('account-name').textContent = current.displayName || 'Epic account';
  $('account-country').textContent = current.country ? `Store region: ${current.country}` : '';
  $('daily-toggle').checked = !!current.dailyChecks;
  $('auto-title').textContent = current.dailyChecks ? 'Daily checks on' : 'Daily checks off';
  $('next-check').textContent = current.dailyChecks ? (current.nextCheckAt ? `Next due around ${fmtDate(current.nextCheckAt)}` : 'A check will run automatically after startup.') : 'Automatic checks are paused.';
  $('ntfy-url').value = current.ntfyUrl || '';
  $('last-check').textContent = fmtDate(current.lastCheckAt);
  $('summary').textContent = summaryText(current.lastSummary);
  $('run-now').disabled = !!current.running;
  $('run-now').textContent = current.running ? 'Checking…' : 'Check now';
}

$('connect-epic').onclick = async () => {
  $('setup-error').textContent = '';
  await window.cfg.connectEpic();
};
$('submit-code').onclick = async () => {
  const result = await window.cfg.submitEpicCode($('auth-code').value);
  if (!result.ok) $('setup-error').textContent = result.error;
  else await refresh();
};
$('setup-test-notify').onclick = async () => {
  try { await window.cfg.testNotification($('setup-ntfy').value); $('setup-error').textContent = 'Test notification sent.'; }
  catch (e) { $('setup-error').textContent = String(e); }
};
$('finish-setup').onclick = async () => {
  if (!current?.connected) { $('setup-error').textContent = 'Connect your Epic account first.'; return; }
  await window.cfg.saveSettings({ setupComplete:true, dailyChecks:$('setup-daily').checked, ntfyUrl:$('setup-ntfy').value.trim() });
  await refresh();
};
$('run-now').onclick = async () => {
  $('dashboard-error').textContent = '';
  $('run-now').disabled = true;
  $('run-now').textContent = 'Checking…';
  const result = await window.cfg.runNow();
  if (!result.ok) $('dashboard-error').textContent = result.error;
  await refresh();
};
$('daily-toggle').onchange = async () => { await window.cfg.saveSettings({ dailyChecks:$('daily-toggle').checked }); await refresh(); };
$('save-notify').onclick = async () => { await window.cfg.saveSettings({ ntfyUrl:$('ntfy-url').value.trim() }); await refresh(); };
$('test-notify').onclick = async () => { await window.cfg.testNotification($('ntfy-url').value.trim()); };
$('open-data').onclick = () => window.cfg.openData();

window.cfg.onEpicConnected(() => refresh());
window.cfg.onRunState(() => refresh());
refresh();
