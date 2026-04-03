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

  // Apply any saved drag-drop overrides
  const overrides = JSON.parse(localStorage.getItem('taskOverrides') || '{}');

  tasks.forEach((task, idx) => {
    const taskId = task.id || `task-${idx}`;
    const status = overrides[taskId] || task.status || 'planned';

    // Map drag-drop status values to column keys
    const colKeyMap = { todo: 'planned', in_progress: 'in_progress', blocked: 'blocked', done: 'done' };
    const colKey = colKeyMap[status] || status;
    const target = cols[colKey] || cols['planned'];
    if (!target) return;

    const card = document.createElement('div');
    card.className = `task-card kanban-card ${status}`;
    card.draggable = true;
    card.dataset.taskId = taskId;
    card.innerHTML = `
      <span class="drag-handle">⠿</span>
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

/* ============================================================
   DRAG AND DROP
   ============================================================ */
function initDragAndDrop() {
  document.addEventListener('dragstart', e => {
    const card = e.target.closest('.task-card');
    if (!card) return;
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', card.dataset.taskId);
    e.dataTransfer.effectAllowed = 'move';
  });
  document.addEventListener('dragend', e => {
    const card = e.target.closest('.task-card');
    if (card) card.classList.remove('dragging');
    document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
  });
  document.addEventListener('dragover', e => {
    e.preventDefault();
    const col = e.target.closest('.kanban-col');
    if (col) {
      document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
      col.classList.add('drag-over');
    }
  });
  document.addEventListener('drop', e => {
    e.preventDefault();
    const col = e.target.closest('.kanban-col');
    if (!col) return;
    col.classList.remove('drag-over');
    const taskId = e.dataTransfer.getData('text/plain');
    const newStatus = col.dataset.status;
    const card = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
    if (card && newStatus) {
      col.querySelector('.kanban-cards').appendChild(card);
      // persist to localStorage
      const overrides = JSON.parse(localStorage.getItem('taskOverrides') || '{}');
      overrides[taskId] = newStatus;
      localStorage.setItem('taskOverrides', JSON.stringify(overrides));
    }
  });
}

/* ============================================================
   DISCOVERIES
   ============================================================ */
async function loadDiscoveries() {
  try {
    const res = await fetch('data/discoveries.json');
    const discoveries = await res.json();
    const saved = JSON.parse(localStorage.getItem('discoveryStatuses') || '{}');
    discoveries.forEach(d => { if (saved[d.id]) d.status = saved[d.id]; });
    window._discoveries = discoveries;
    renderDiscoveries(discoveries, 'all');
    initDiscoveryFilters();
  } catch(e) { console.error('discoveries load failed', e); }
}

function renderDiscoveries(discoveries, filter) {
  const grid = document.getElementById('discoveries-grid');
  if (!grid) return;
  const filtered = filter === 'all' ? discoveries : discoveries.filter(d => d.status === filter);
  grid.innerHTML = filtered.map(d => `
    <div class="discovery-card ${d.status}" data-discovery-id="${d.id}">
      <span class="source-badge source-${d.source}">${d.source}</span>
      <div class="tags">${(d.tags||[]).map(t => `<span class="tag">#${t}</span>`).join('')}</div>
      <div class="discovery-title">${d.title}</div>
      <div class="discovery-date">${new Date(d.date).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</div>
      <div class="discovery-desc">${d.description}</div>
      ${d.actionNote ? `<div class="discovery-action-note">💡 ${d.actionNote}</div>` : ''}
      ${d.status === 'accepted' ? '<div class="status-badge-accepted">⚡ QUEUED FOR ACTION</div>' : ''}
      ${d.status !== 'skipped' && d.status !== 'accepted' ? `
      <div class="discovery-actions">
        <button class="btn-implement" onclick="acceptDiscovery('${d.id}')">✅ IMPLEMENT</button>
        <button class="btn-skip" onclick="skipDiscovery('${d.id}')">❌ SKIP</button>
      </div>` : ''}
      ${d.status === 'skipped' ? '<div style="font-size:10px;color:#555;margin-top:8px;">SKIPPED — <a href="#" onclick="restoreDiscovery(\''+d.id+'\'); return false;" style="color:#666;">undo</a></div>' : ''}
      ${d.url ? `<div style="margin-top:8px;"><a href="${d.url}" target="_blank" style="font-size:10px;color:#444;text-decoration:none;">→ VIEW SOURCE</a></div>` : ''}
    </div>
  `).join('');
}

function acceptDiscovery(id) {
  setDiscoveryStatus(id, 'accepted');
}
function skipDiscovery(id) {
  setDiscoveryStatus(id, 'skipped');
}
function restoreDiscovery(id) {
  setDiscoveryStatus(id, 'pending');
}
function setDiscoveryStatus(id, status) {
  const saved = JSON.parse(localStorage.getItem('discoveryStatuses') || '{}');
  saved[id] = status;
  localStorage.setItem('discoveryStatuses', JSON.stringify(saved));
  if (window._discoveries) {
    const d = window._discoveries.find(x => x.id === id);
    if (d) d.status = status;
    const activeFilter = document.querySelector('.filter-btn.active');
    renderDiscoveries(window._discoveries, activeFilter ? activeFilter.dataset.filter : 'all');
  }
}
function initDiscoveryFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDiscoveries(window._discoveries || [], btn.dataset.filter);
    });
  });
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
  initDragAndDrop();
  loadDiscoveries();
}

document.addEventListener('DOMContentLoaded', init);
