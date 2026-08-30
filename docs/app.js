const REPO = 'KingHacker9000/Claim-Free-Games';
const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;

function detectPlatform() {
  const raw = `${navigator.userAgentData?.platform || ''} ${navigator.platform || ''} ${navigator.userAgent || ''}`.toLowerCase();
  if (/windows|win32|win64/.test(raw)) return 'windows';
  if (/macintosh|mac os|macintel/.test(raw)) return 'mac';
  if (/linux/.test(raw) && !/android/.test(raw)) return 'linux';
  if (/iphone|ipad|android/.test(raw)) return 'mobile';
  return 'other';
}

function revealRecommendedPlatform() {
  const platform = detectPlatform();
  document.querySelectorAll('[data-platform-card]').forEach(card => card.classList.remove('is-recommended'));
  const card = document.querySelector(`[data-platform-card="${platform}"]`);
  if (card) card.classList.add('is-recommended');

  const cta = document.getElementById('recommended-download');
  if (!cta) return;
  if (platform === 'windows') {
    cta.textContent = 'Download for Windows';
    cta.dataset.preferredAsset = 'windows';
  } else if (platform === 'mac') {
    cta.textContent = 'Choose your Mac download';
    cta.href = '#download';
  } else if (platform === 'linux') {
    cta.textContent = 'Download for Linux';
    cta.dataset.preferredAsset = 'linux-appimage';
  } else if (platform === 'mobile') {
    cta.textContent = 'Set up a Raspberry Pi';
    cta.href = '#raspberry-pi';
  }
}

function findAsset(assets, matcher) {
  return assets.find(asset => matcher.test(asset.name));
}

async function loadLatestRelease() {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const release = await response.json();
    const assets = release.assets || [];
    const version = String(release.tag_name || '').replace(/^v/, '') || '2.1.0';

    document.querySelectorAll('[data-version]').forEach(el => { el.textContent = version; });

    const map = {
      windows: findAsset(assets, /Setup\.exe$/i),
      'mac-arm': findAsset(assets, /arm64\.dmg$/i),
      'mac-x64': findAsset(assets, /x64\.dmg$/i),
      'linux-appimage': findAsset(assets, /\.AppImage$/i),
      'linux-deb': findAsset(assets, /\.deb$/i),
      pi: findAsset(assets, /Pi-Installer\.sh$/i)
    };

    for (const [key, asset] of Object.entries(map)) {
      if (!asset) continue;
      document.querySelectorAll(`[data-asset="${key}"]`).forEach(link => {
        link.href = asset.browser_download_url;
        link.dataset.directDownload = 'true';
      });
    }

    const preferred = document.getElementById('recommended-download');
    if (preferred?.dataset.preferredAsset && map[preferred.dataset.preferredAsset]) {
      preferred.href = map[preferred.dataset.preferredAsset].browser_download_url;
      preferred.dataset.directDownload = 'true';
    }
  } catch (error) {
    console.info('Live release metadata unavailable; falling back to GitHub Releases.', error);
    document.querySelectorAll('[data-asset]').forEach(link => { link.href = RELEASES_URL; });
  }
}

async function copyPiCommand() {
  const command = document.getElementById('pi-command')?.textContent?.trim();
  const button = document.getElementById('copy-pi-command');
  if (!command || !button) return;

  try {
    await navigator.clipboard.writeText(command);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = command;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  const old = button.textContent;
  button.textContent = 'Copied ✓';
  setTimeout(() => { button.textContent = old; }, 1800);
}

function setupRevealAnimations() {
  const nodes = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    nodes.forEach(node => node.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -40px' });

  nodes.forEach(node => observer.observe(node));
}

function setupExternalLinks() {
  document.querySelectorAll('a[href^="https://github.com/"]').forEach(link => {
    if (!link.hasAttribute('rel')) link.setAttribute('rel', 'noopener');
  });
}

revealRecommendedPlatform();
setupRevealAnimations();
setupExternalLinks();
document.getElementById('copy-pi-command')?.addEventListener('click', copyPiCommand);
loadLatestRelease();
