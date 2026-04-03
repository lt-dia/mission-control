
/* ============================================================
   THEME ENGINE — Slack-style slide-in panel
   Light / Dark / Surprise Me + named presets + color customizer
   Persists to localStorage
   ============================================================ */

const THEMES = {
  synthwave84: {
    name: 'SYNTHWAVE 84',
    emoji: '🌆',
    bg: '#0a0010',
    bgCard: '#0f0020',
    bgCard2: '#130028',
    pink: '#ff2a6d',
    cyan: '#05d9e8',
    purple: '#7b2fff',
    dim: '#3d1a5e',
    text: '#d1f7ff',
    textDim: '#7a8fa6',
    gridColor: 'rgba(5, 217, 232, 0.07)',
  },
  light: {
    name: 'DAYTIME OPS',
    emoji: '☀️',
    bg: '#f0f2f5',
    bgCard: '#ffffff',
    bgCard2: '#e8ecf0',
    pink: '#e0135a',
    cyan: '#0077c8',
    purple: '#5a2da0',
    dim: '#c0c8d4',
    text: '#1a1e2b',
    textDim: '#667080',
    gridColor: 'rgba(0, 119, 200, 0.06)',
  },
  matrixGreen: {
    name: 'MATRIX',
    emoji: '💚',
    bg: '#000a00',
    bgCard: '#001200',
    bgCard2: '#001a00',
    pink: '#00ff41',
    cyan: '#00dd33',
    purple: '#00aa22',
    dim: '#003300',
    text: '#00ff41',
    textDim: '#006622',
    gridColor: 'rgba(0, 255, 65, 0.06)',
  },
  midnightBlue: {
    name: 'MIDNIGHT',
    emoji: '🌙',
    bg: '#050a18',
    bgCard: '#0a1228',
    bgCard2: '#0d1830',
    pink: '#4fc3f7',
    cyan: '#81d4fa',
    purple: '#5c6bc0',
    dim: '#1a2540',
    text: '#e3f2fd',
    textDim: '#607d8b',
    gridColor: 'rgba(79, 195, 247, 0.06)',
  },
  redAlert: {
    name: 'RED ALERT',
    emoji: '🚨',
    bg: '#0d0000',
    bgCard: '#1a0000',
    bgCard2: '#200000',
    pink: '#ff4444',
    cyan: '#ff7700',
    purple: '#cc2200',
    dim: '#3d0000',
    text: '#ffdddd',
    textDim: '#884444',
    gridColor: 'rgba(255, 68, 68, 0.07)',
  },
  deepSea: {
    name: 'DEEP SEA',
    emoji: '🌊',
    bg: '#010d14',
    bgCard: '#021825',
    bgCard2: '#031e2e',
    pink: '#00e5ff',
    cyan: '#26c6da',
    purple: '#0077b6',
    dim: '#01304a',
    text: '#b2ebf2',
    textDim: '#4a7a8a',
    gridColor: 'rgba(0, 229, 255, 0.06)',
  },
  goldenHour: {
    name: 'GOLDEN HOUR',
    emoji: '🌅',
    bg: '#0d0800',
    bgCard: '#1a1000',
    bgCard2: '#201600',
    pink: '#ffab40',
    cyan: '#ffd740',
    purple: '#ff6d00',
    dim: '#3d2200',
    text: '#fff8e1',
    textDim: '#8d6e63',
    gridColor: 'rgba(255, 171, 64, 0.07)',
  },
  vaporwave: {
    name: 'VAPORWAVE',
    emoji: '🌸',
    bg: '#0a0118',
    bgCard: '#110228',
    bgCard2: '#150330',
    pink: '#ff71ce',
    cyan: '#b967ff',
    purple: '#fffb96',
    dim: '#2d0058',
    text: '#fffb96',
    textDim: '#7b5c9e',
    gridColor: 'rgba(255, 113, 206, 0.07)',
  },
};

function applyTheme(key, overrides) {
  const theme = overrides || THEMES[key];
  if (!theme) return;
  const root = document.documentElement;
  root.style.setProperty('--bg', theme.bg);
  root.style.setProperty('--bg-card', theme.bgCard);
  root.style.setProperty('--bg-card2', theme.bgCard2);
  root.style.setProperty('--pink', theme.pink);
  root.style.setProperty('--cyan', theme.cyan);
  root.style.setProperty('--purple', theme.purple);
  root.style.setProperty('--dim', theme.dim);
  root.style.setProperty('--text', theme.text);
  root.style.setProperty('--text-dim', theme.textDim);
  root.style.setProperty('--grid-color', theme.gridColor);
  // Recompute glow values
  root.style.setProperty('--glow-pink', `0 0 8px ${theme.pink}, 0 0 20px ${theme.pink}44`);
  root.style.setProperty('--glow-cyan', `0 0 8px ${theme.cyan}, 0 0 20px ${theme.cyan}44`);
  root.style.setProperty('--glow-purple', `0 0 8px ${theme.purple}, 0 0 24px ${theme.purple}44`);

  // Update active swatch indicator
  document.querySelectorAll('.theme-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.theme === (overrides ? 'custom' : key));
  });

  const label = document.getElementById('themeCurrent');
  if (label) {
    const name = overrides ? 'CUSTOM' : (THEMES[key]?.name || key.toUpperCase());
    label.textContent = `ACTIVE: ${name}`;
  }
}

function randomDarkHex() {
  const r = Math.floor(Math.random() * 60);
  const g = Math.floor(Math.random() * 60);
  const b = Math.floor(Math.random() * 60);
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

function randomVibrantHex() {
  const channels = [Math.floor(Math.random()*256), Math.floor(Math.random()*256), Math.floor(Math.random()*256)];
  const maxIdx = channels.indexOf(Math.max(...channels));
  channels[maxIdx] = 180 + Math.floor(Math.random() * 76);
  return '#' + channels.map(v => v.toString(16).padStart(2,'0')).join('');
}

function surpriseMe() {
  const bg     = randomDarkHex();
  const bgCard = randomDarkHex();
  const bgCard2 = randomDarkHex();
  const pink   = randomVibrantHex();
  const cyan   = randomVibrantHex();
  const purple = randomVibrantHex();
  const text   = '#' + [200+Math.floor(Math.random()*55), 220+Math.floor(Math.random()*35), 230+Math.floor(Math.random()*25)].map(v=>v.toString(16).padStart(2,'0')).join('');

  const custom = { bg, bgCard, bgCard2, pink, cyan, purple, dim: bg+'99', text, textDim: text+'88', gridColor: cyan+'18' };

  applyTheme('custom', custom);
  localStorage.setItem('mc-theme', 'custom');
  localStorage.setItem('mc-theme-custom', JSON.stringify(custom));

  // Sync pickers so user can tweak individual values
  const map = { 'cc-bg': bg, 'cc-bgCard': bgCard, 'cc-pink': pink, 'cc-cyan': cyan, 'cc-purple': purple, 'cc-text': text };
  Object.entries(map).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val; });

  // flash
  document.body.style.transition = 'filter 0.15s';
  document.body.style.filter = 'brightness(1.5)';
  setTimeout(() => { document.body.style.filter = ''; }, 150);
}

function buildSwatches(container) {
  container.innerHTML = Object.entries(THEMES).map(([key, t]) => `
    <div class="theme-swatch" data-theme="${key}"
         style="background:${t.bgCard}; border-color:${t.dim};"
         title="${t.name}" onclick="selectSwatch('${key}')">
      <span class="swatch-check">✓</span>
      <span class="swatch-emoji">${t.emoji}</span>
      <span class="swatch-name" style="color:${t.cyan}">${t.name}</span>
    </div>
  `).join('');
}

window.selectSwatch = function(key) {
  applyTheme(key);
  localStorage.setItem('mc-theme', key);
};

function buildCustomizer(container) {
  container.innerHTML = `
    <div class="color-row">
      <label>BACKGROUND</label>
      <input type="color" id="cc-bg" value="#0a0010">
    </div>
    <div class="color-row">
      <label>CARD</label>
      <input type="color" id="cc-bgCard" value="#0f0020">
    </div>
    <div class="color-row">
      <label>ACCENT 1</label>
      <input type="color" id="cc-pink" value="#ff2a6d">
    </div>
    <div class="color-row">
      <label>ACCENT 2</label>
      <input type="color" id="cc-cyan" value="#05d9e8">
    </div>
    <div class="color-row">
      <label>ACCENT 3</label>
      <input type="color" id="cc-purple" value="#7b2fff">
    </div>
    <div class="color-row">
      <label>TEXT</label>
      <input type="color" id="cc-text" value="#d1f7ff">
    </div>
    <button class="theme-apply-custom-btn" onclick="applyCustomTheme()">⬡ APPLY CUSTOM</button>
  `;
}

window.applyCustomTheme = function() {
  const get = id => document.getElementById(id)?.value;
  const c = {
    bg: get('cc-bg'),
    bgCard: get('cc-bgCard'),
    bgCard2: get('cc-bgCard') + 'cc',
    pink: get('cc-pink'),
    cyan: get('cc-cyan'),
    purple: get('cc-purple'),
    dim: get('cc-bg') + '88',
    text: get('cc-text'),
    textDim: get('cc-text') + '88',
    gridColor: `${get('cc-cyan')}11`,
  };
  applyTheme('custom', c);
  localStorage.setItem('mc-theme', 'custom');
  localStorage.setItem('mc-theme-custom', JSON.stringify(c));
};

function initThemeEngine() {
  // Build panel HTML into body
  const panel = document.createElement('div');
  panel.innerHTML = `
    <div class="theme-overlay" id="themeOverlay" onclick="closeThemePanel()"></div>
    <div class="theme-panel" id="themePanel">
      <div class="theme-panel-header">
        <div class="theme-panel-title">🎨 THEMES</div>
        <button class="theme-close-btn" onclick="closeThemePanel()">✕</button>
      </div>
      <div class="theme-quick-row">
        <button class="theme-quick-btn" onclick="selectSwatch('light')">☀️ LIGHT</button>
        <button class="theme-quick-btn" onclick="selectSwatch('synthwave84')">🌆 DARK</button>
        <button class="theme-quick-btn theme-surprise-btn" onclick="surpriseMe()">✨ SURPRISE ME</button>
      </div>
      <div class="theme-section-label">PRESETS</div>
      <div class="theme-swatches" id="themeSwatches"></div>
      <div class="theme-section-label">CUSTOMIZE</div>
      <div class="theme-customizer" id="themeCustomizer"></div>
      <div class="theme-current-label" id="themeCurrent">ACTIVE: SYNTHWAVE 84</div>
    </div>
  `;
  document.body.appendChild(panel);

  buildSwatches(document.getElementById('themeSwatches'));
  buildCustomizer(document.getElementById('themeCustomizer'));

  // Inject toggle button into header-right
  const headerRight = document.querySelector('.header-right');
  if (headerRight) {
    const btn = document.createElement('button');
    btn.className = 'theme-toggle-btn';
    btn.textContent = '🎨 THEME';
    btn.onclick = toggleThemePanel;
    headerRight.insertBefore(btn, headerRight.firstChild);
  }

  // Restore saved theme
  const saved = localStorage.getItem('mc-theme');
  if (saved === 'custom') {
    const custom = JSON.parse(localStorage.getItem('mc-theme-custom') || 'null');
    if (custom) applyTheme('custom', custom);
  } else if (saved && THEMES[saved]) {
    applyTheme(saved);
  } else {
    applyTheme('synthwave84');
  }
}

window.toggleThemePanel = function() {
  document.getElementById('themePanel')?.classList.toggle('open');
  document.getElementById('themeOverlay')?.classList.toggle('open');
};
window.closeThemePanel = function() {
  document.getElementById('themePanel')?.classList.remove('open');
  document.getElementById('themeOverlay')?.classList.remove('open');
};
window.surpriseMe = surpriseMe;

document.addEventListener('DOMContentLoaded', initThemeEngine);
