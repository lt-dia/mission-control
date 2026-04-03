/* ============================================================
   MISSION CONTROL — app.js
   Reads data/*.json (same-origin, no CORS) and renders UI
   ============================================================ */

const DATA = {
  tasks:   'data/tasks.json',
  linear:  'data/linear.json',
  granola: 'data/granola.json',
  status:  'data/status.json',
};

async function fetchJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn(`[Mission Control] Failed to fetch ${path}:`, e.message);
    return null;
  }
}

/* ── TIMESTAMP ──────────────────────────────────────────── */
function updateClock() {
  const el = document.getElementById('footerTime');
  if (el) el.textContent = new Date().toUTCString().toUpperCase();
}
setInterval(updateClock, 1000);
updateClock();

/* ── INTEGRATIONS STATUS ─────────────────────────────────── */
function renderIntegrations(status) {
  const container = document.getElementById('integrationsList');
  if (!container) return;

  const defaults = [
    { name: 'LINEAR',  key: 'linear',  defaultState: 'ok'   },
    { name: 'GRANOLA', key: 'granola', defaultState: 'ok'   },
    { name: 'GITHUB',  key: 'github',  defaultState: 'warn' },
    { name: 'DISCORD', key: 'discord', defaultState: 'ok'   },
  ];

  const integrations = (status && status.integrations)
    ? status.integrations
    : defaults.reduce((acc, d) => { acc[d.key] = d.defaultState; return acc; }, {});

  const icons = { ok: '✅', warn: '⚠️', err: '❌' };
  const labels = {
    linear:  'LINEAR',
    granola: 'GRANOLA',
    github:  'GITHUB',
    discord: 'DISCORD',
  };

  container.innerHTML = defaults.map(d => {
    const state = integrations[d.key] || d.defaultState;
    const icon  = icons[state] || '❓';
    return `<div class="integration-item ${state}">${icon} ${labels[d.key]}</div>`;
  }).join('');

  if (status && status.lastUpdated) {
    const el = document.getElementById('lastUpdated');
    if (el) {
      const d = new Date(status.lastUpdated);
      el.textContent = `LAST SYNC: ${d.toUTCString().toUpperCase()}`;
    }
  }
}

/* ── KANBAN ──────────────────────────────────────────────── */
function renderKanban(tasks) {
  if (!tasks || !tasks.length) return;

  const cols = {
    planned:     document.querySelector('#col-planned    .kanban-cards'),
    in_progress: document.querySelector('#col-in_progress .kanban-cards'),
    blocked:     document.querySelector('#col-blocked    .kanban-cards'),
    done:        document.querySelector('#col-done       .kanban-cards'),
  };

  // Clear
  Object.values(cols).forEach(c => { if (c) c.innerHTML = ''; });

  tasks.forEach(task => {
    const status = task.status || 'planned';
    const target = cols[status] || cols['planned'];
    if (!target) return;

    const card = document.createElement('div');
    card.className = `kanban-card ${status}`;
    card.innerHTML = `
      <div class="kanban-card-title">${escapeHtml(task.title)}</div>
      ${task.notes ? `<div class="kanban-card-notes">${escapeHtml(task.notes)}</div>` : ''}
    `;
    target.appendChild(card);
  });
}

/* ── LINEAR ──────────────────────────────────────────────── */
function priorityClass(p) {
  const map = { 0: 'p0', 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4' };
  return map[p] || 'p4';
}
function priorityLabel(p) {
  const map = { 0: 'URGENT', 1: 'HIGH', 2: 'MEDIUM', 3: 'LOW', 4: 'NONE' };
  return map[p] || 'NONE';
}

function renderLinear(data) {
  const container = document.getElementById('linearList');
  if (!container) return;

  const issues = (data && data.data && data.data.issues && data.data.issues.nodes)
    ? data.data.issues.nodes
    : (Array.isArray(data) ? data : null);

  if (!issues || !issues.length) {
    container.innerHTML = '<div class="placeholder-msg">No Linear tickets found — awaiting sync</div>';
    return;
  }

  container.innerHTML = issues.map(issue => {
    const pClass = priorityClass(issue.priority);
    const pLabel = priorityLabel(issue.priority);
    const state  = (issue.state && issue.state.name) ? issue.state.name.toUpperCase() : '—';
    const date   = issue.updatedAt ? new Date(issue.updatedAt).toLocaleDateString() : '';
    return `
      <div class="linear-card">
        <div class="linear-card-top">
          <div class="linear-card-title">${escapeHtml(issue.title)}</div>
          <div class="priority-badge ${pClass}">P${issue.priority ?? 4}: ${pLabel}</div>
        </div>
        <div class="linear-card-meta">
          <span class="linear-state-badge">◈ ${state}</span>
          <span class="linear-date">${date}</span>
        </div>
      </div>
    `;
  }).join('');
}

/* ── GRANOLA ─────────────────────────────────────────────── */
function renderGranola(data) {
  const container = document.getElementById('granolaList');
  if (!container) return;

  // Granola API returns { notes: [...] } or { data: [...] }
  let notes = null;
  if (data && Array.isArray(data.notes)) notes = data.notes;
  else if (data && Array.isArray(data.data)) notes = data.data;
  else if (Array.isArray(data)) notes = data;

  if (!notes || !notes.length) {
    container.innerHTML = '<div class="placeholder-msg">No meeting notes found — awaiting sync</div>';
    return;
  }

  container.innerHTML = notes.slice(0, 5).map(note => {
    const title = note.title || note.name || 'Untitled Meeting';
    const raw   = note.created_at || note.date || note.updatedAt || '';
    const date  = raw ? new Date(raw).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    return `
      <div class="granola-note">
        <div class="granola-note-title">◉ ${escapeHtml(title)}</div>
        <div class="granola-note-date">${date}</div>
      </div>
    `;
  }).join('');
}

/* ── UTILITY ─────────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── MAIN INIT ───────────────────────────────────────────── */
async function init() {
  const [tasks, linear, granola, status] = await Promise.all([
    fetchJSON(DATA.tasks),
    fetchJSON(DATA.linear),
    fetchJSON(DATA.granola),
    fetchJSON(DATA.status),
  ]);

  renderIntegrations(status);
  renderKanban(tasks);
  renderLinear(linear);
  renderGranola(granola);
}

document.addEventListener('DOMContentLoaded', init);
