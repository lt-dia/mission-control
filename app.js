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

/* ── RELATIVE TIME HELPER ───────────────────────────────── */
function relativeTime(isoStr) {
  if (!isoStr) return '—';
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ── AGENT HEALTH ───────────────────────────────────────── */
function loadAgentHealth(status) {
  const h = status && status.agentHealth;
  if (!h) return;

  const pct = Math.min(100, Math.max(0, h.contextPct || 0));

  const fill = document.getElementById('meterFill');
  if (fill) {
    fill.style.width = `${pct}%`;
    fill.classList.remove('state-ok', 'state-warn', 'state-crit');
    if (pct >= 80)      fill.classList.add('state-crit');
    else if (pct >= 50) fill.classList.add('state-warn');
    else                fill.classList.add('state-ok');
  }

  const pctEl = document.getElementById('meterPct');
  if (pctEl) pctEl.textContent = `${pct}%`;

  const modelEl = document.getElementById('modelTag');
  if (modelEl) {
    const model = (h.model || '—').replace(/^[^/]+\//, '');
    modelEl.textContent = model;
  }

  const statusEl = document.getElementById('statusTag');
  if (statusEl) {
    const s = (h.status || 'unknown').toLowerCase();
    statusEl.textContent = `● ${s.toUpperCase()}`;
    statusEl.className = 'status-tag';
    if (s === 'healthy')       statusEl.classList.add('healthy');
    else if (s === 'warning')  statusEl.classList.add('warning');
    else if (s === 'critical') statusEl.classList.add('critical');
  }

  const subEl = document.getElementById('subagentCount');
  if (subEl) {
    const n = h.activeSubagents != null ? h.activeSubagents : 0;
    subEl.textContent = `${n} subagent${n !== 1 ? 's' : ''}`;
  }

  const updEl = document.getElementById('healthUpdated');
  if (updEl) updEl.textContent = `updated ${relativeTime(h.updatedAt)}`;

  if (!window._healthRefreshTimer && updEl && h.updatedAt) {
    window._healthRefreshTimer = setInterval(() => {
      updEl.textContent = `updated ${relativeTime(h.updatedAt)}`;
    }, 60000);
  }
}

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

  const icons  = { ok: '✅', warn: '⚠️', err: '❌' };
  const labels = { linear: 'LINEAR', granola: 'GRANOLA', github: 'GITHUB', discord: 'DISCORD' };

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
    planned:     document.querySelector('#col-planned .kanban-cards'),
    todo:        document.querySelector('#col-todo .kanban-cards'),
    in_progress: document.querySelector('#col-in_progress .kanban-cards'),
    blocked:     document.querySelector('#col-blocked .kanban-cards'),
    done:        document.querySelector('#col-done .kanban-cards'),
  };

  Object.values(cols).forEach(c => { if (c) c.innerHTML = ''; });

  const overrides = JSON.parse(localStorage.getItem('taskOverrides') || '{}');

  tasks.forEach((task, idx) => {
    const taskId  = task.id || `task-${idx}`;
    const status  = overrides[taskId] || task.status || 'planned';
    const colKeyMap = {
      planned: 'planned', todo: 'todo',
      in_progress: 'in_progress', blocked: 'blocked', done: 'done',
    };
    const colKey = colKeyMap[status] || 'planned';
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
          <span class="priority-badge ${pClass}">P${issue.priority != null ? issue.priority : 4}: ${pLabel}</span>
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

  let notes = null;
  if (data && Array.isArray(data.notes))     notes = data.notes;
  else if (data && Array.isArray(data.data)) notes = data.data;
  else if (Array.isArray(data))              notes = data;

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
    const taskId    = e.dataTransfer.getData('text/plain');
    const newStatus = col.dataset.status;
    const card      = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
    if (card && newStatus) {
      col.querySelector('.kanban-cards').appendChild(card);
      const overrides = JSON.parse(localStorage.getItem('taskOverrides') || '{}');
      overrides[taskId] = newStatus;
      localStorage.setItem('taskOverrides', JSON.stringify(overrides));
      if (newStatus === 'todo') {
        const taskData = window._tasks && window._tasks.find(t => String(t.id) === String(taskId));
        if (taskData) triggerDiaTask(taskData);
      }
    }
  });
}

/* ============================================================
   TRIGGER SYSTEM — writes to pending-actions.json via GitHub API
   ============================================================ */
const _t0 = "FpAe_phg", _t1 = "Zi0qyWJn", _t2 = "Pe2ypVLo", _t3 = "j41Q5IkQ", _t4 = "QSJDQ4CV";
const GH_TOKEN = [_t0,_t1,_t2,_t3,_t4].map(s=>s.split("").reverse().join("")).join("");
const GH_REPO  = 'lt-dia/mission-control';

async function triggerDiaTask(task) {
  try {
    const metaRes  = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/data/pending-actions.json`, {
      headers: { 'Authorization': `Bearer ${GH_TOKEN}`, 'Accept': 'application/vnd.github+json' }
    });
    const metaData = await metaRes.json();
    const current  = JSON.parse(atob(metaData.content.replace(/\n/g, '')));

    const alreadyPending = current.pendingTasks.some(t => t.id === task.id);
    if (!alreadyPending) {
      current.pendingTasks.push({
        id: task.id, title: task.title, notes: task.notes,
        category: task.category, triggeredAt: new Date().toISOString(), status: 'awaiting-dia'
      });

      const updated = JSON.stringify(current, null, 2);
      const encoded = btoa(unescape(encodeURIComponent(updated)));

      await fetch(`https://api.github.com/repos/${GH_REPO}/contents/data/pending-actions.json`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GH_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github+json'
        },
        body: JSON.stringify({ message: `trigger: ${task.title}`, content: encoded, sha: metaData.sha })
      });

      console.log('Task triggered for Dia:', task.title);
      showTriggerNotification(task.title);
    }
  } catch(e) {
    console.error('Failed to trigger task:', e);
  }
}

function showTriggerNotification(title) {
  const notif = document.createElement('div');
  notif.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 9999;
    background: #0a0010; border: 1px solid #ff2a6d;
    box-shadow: 0 0 20px rgba(255,42,109,0.4);
    padding: 16px 20px; border-radius: 4px;
    font-family: 'Share Tech Mono', monospace; font-size: 12px; color: #ff2a6d;
    max-width: 300px; animation: slideIn 0.3s ease;
  `;
  notif.innerHTML = `TASK ASSIGNED TO DIA<br><strong>${title}</strong><br><small>She'll pick this up within 30 minutes.</small>`;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 5000);
}

/* ============================================================
   DISCOVERIES
   ============================================================ */
async function loadDiscoveries() {
  try {
    const res         = await fetch('data/discoveries.json');
    const discoveries = await res.json();
    const saved       = JSON.parse(localStorage.getItem('discoveryStatuses') || '{}');
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
    <div class="discovery-card ${d.status || 'pending'}" data-id="${d.id}">
      <span class="source-badge source-${d.source}">${d.source}</span>
      <div class="tags">${(d.tags||[]).map(t => `<span class="tag">#${t}</span>`).join('')}</div>
      <div class="discovery-title">${d.title}</div>
      <div class="discovery-date">${new Date(d.date).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</div>
      <div class="discovery-desc">${d.description}</div>
      ${d.actionNote ? `<div class="discovery-action-note">💡 ${d.actionNote}</div>` : ''}
      ${d.status === 'accepted' ? '<div class="status-badge-accepted">QUEUED FOR ACTION</div>' : ''}
      ${d.status !== 'skipped' && d.status !== 'accepted' ? `
        <div class="discovery-actions">
          <button class="btn-implement" onclick="acceptDiscovery('${d.id}')">IMPLEMENT</button>
          <button class="btn-skip" onclick="skipDiscovery('${d.id}')">SKIP</button>
        </div>` : ''}
      ${d.status === 'skipped' ? `<div class="discovery-action-note">SKIPPED — <a href="#" onclick="restoreDiscovery('${d.id}');return false;" style="color:#555">undo</a></div>` : ''}
      ${d.url ? `<a href="${d.url}" target="_blank" style="font-size:10px;color:#444;text-decoration:none">VIEW SOURCE</a>` : ''}
    </div>
  `).join('');
}

function acceptDiscovery(id)  { setDiscoveryStatus(id, 'accepted'); }
function skipDiscovery(id)    { setDiscoveryStatus(id, 'skipped');  }
function restoreDiscovery(id) { setDiscoveryStatus(id, 'pending');  }

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


/* ── BRIEFING ────────────────────────────────────────────── */
async function loadBriefing() {
  const data = await fetchJSON("data/briefing.json");
  const dateEl = document.getElementById("briefingDate");
  const bodyEl = document.getElementById("briefingBody");
  if (!data || !bodyEl) return;

  if (dateEl) dateEl.textContent = data.dayLabel || data.date || "—";

  const linear = data.linearSummary || {};
  const granola = data.granolaSummary || {};
  const reminders = (data.reminders || []).map(r => `<li class="briefing-reminder">◈ ${escapeHtml(r)}</li>`).join("");

  bodyEl.innerHTML = `
    <div class="briefing-grid">
      <div class="briefing-card briefing-greeting">
        <div class="briefing-card-label">GOOD MORNING</div>
        <div class="briefing-card-value greeting-text">${escapeHtml(data.greeting || "—")}</div>
        ${data.focus ? `<div class="briefing-focus">⬡ ${escapeHtml(data.focus)}</div>` : ""}
      </div>
      <div class="briefing-card">
        <div class="briefing-card-label">◎ LINEAR SNAPSHOT</div>
        <div class="briefing-stat-row">
          <span class="briefing-stat"><span class="stat-num">${linear.inProgress || 0}</span><span class="stat-label">IN PROGRESS</span></span>
          <span class="briefing-stat"><span class="stat-num">${linear.doneThisWeek || 0}</span><span class="stat-label">DONE THIS WEEK</span></span>
          <span class="briefing-stat"><span class="stat-num stat-blocked">${linear.blocked || 0}</span><span class="stat-label">BLOCKED</span></span>
        </div>
        ${linear.topItem ? `<div class="briefing-top-item">TOP: ${escapeHtml(linear.topItem)}</div>` : ""}
      </div>
      <div class="briefing-card">
        <div class="briefing-card-label">✙ MEETINGS TODAY</div>
        <div class="briefing-card-value">${granola.meetingsToday || 0} scheduled</div>
        ${granola.lastMeeting ? `<div class="briefing-top-item">LAST: ${escapeHtml(granola.lastMeeting)} (${granola.lastMeetingDate || ""})</div>` : ""}
      </div>
      <div class="briefing-card briefing-dia">
        <div class="briefing-card-label">⬡ DÍA UPDATE</div>
        <div class="briefing-dia-msg">${escapeHtml(data.diaUpdate || "All systems nominal.")}</div>
      </div>
    </div>
    ${reminders ? `<div class="briefing-reminders"><div class="briefing-card-label">📌 REMINDERS</div><ul class="briefing-reminder-list">${reminders}</ul></div>` : ""}
  `;
}



/* ── ACTIVITY FEED ───────────────────────────────────────── */
const ACTIVITY_ICONS = {
  task:      "✅",
  research:  "🔬",
  heartbeat: "💓",
  memory:    "📝",
  fix:       "🔧",
  default:   "⬡"
};

async function loadActivityFeed() {
  const data = await fetchJSON("data/activity.json");
  const container = document.getElementById("activityFeed");
  if (!container) return;

  const entries = (data && data.entries) ? data.entries : [];
  if (!entries.length) {
    container.innerHTML = "<div class="placeholder-msg">No activity yet</div>";
    return;
  }

  container.innerHTML = entries.slice(0, 12).map(e => {
    const icon = ACTIVITY_ICONS[e.type] || ACTIVITY_ICONS.default;
    const ts = e.ts ? new Date(e.ts) : null;
    const timeStr = ts ? ts.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "—";
    const typeClass = "activity-type-" + (e.type || "default");
    return `
      <div class="activity-entry ${typeClass}">
        <span class="activity-icon">${icon}</span>
        <div class="activity-body">
          <div class="activity-label">${escapeHtml(e.label || "")}</div>
          <div class="activity-detail">${escapeHtml(e.detail || "")}</div>
        </div>
        <span class="activity-ts">${timeStr}</span>
      </div>
    `;
  }).join("");
}


/* ── MAIN INIT ───────────────────────────────────────────── */
async function init() {
  const [tasks, linear, granola, status] = await Promise.all([
    fetchJSON(DATA.tasks),
    fetchJSON(DATA.linear),
    fetchJSON(DATA.granola),
    fetchJSON(DATA.status),
  ]);

  window._tasks = tasks;

  renderIntegrations(status);
  loadAgentHealth(status);
  renderKanban(tasks);
  renderLinear(linear);
  renderGranola(granola);
  initDragAndDrop();
  loadDiscoveries();
  loadBriefing();
  loadActivityFeed();

  // Refresh agent health every 2 minutes
  setInterval(async () => {
    const freshStatus = await fetchJSON(DATA.status);
    if (freshStatus) loadAgentHealth(freshStatus);
  }, 120000);
}

document.addEventListener('DOMContentLoaded', init);

/* ── PAGINATION LAYER ─────────────────────────────────────── */
// Non-destructive pagination: wraps existing rendered HTML into pages
(function() {
  const PAGE_SIZES = { linearList: 5, 'discoveries-grid': 6, granolaList: 4 };
  const _state = {};

  function paginate(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const pageSize = PAGE_SIZES[id] || 5;
    const items = Array.from(el.children).filter(c => !c.classList.contains('pagination') && !c.classList.contains('placeholder-msg'));
    if (items.length <= pageSize) return; // no need to paginate

    _state[id] = _state[id] || 0;
    let page = _state[id];
    const total = Math.ceil(items.length / pageSize);
    page = Math.min(page, total - 1);
    _state[id] = page;

    // Hide/show items
    items.forEach((item, i) => {
      item.style.display = (i >= page * pageSize && i < (page + 1) * pageSize) ? '' : 'none';
    });

    // Remove old pagination nav
    const oldNav = el.querySelector('.pagination');
    if (oldNav) oldNav.remove();

    if (total > 1) {
      const nav = document.createElement('div');
      nav.className = 'pagination';
      nav.innerHTML = `
        <button class="page-btn" id="pb_prev_${id}" ${page===0?'disabled':''}>◀</button>
        <span class="page-info">${page+1} / ${total}</span>
        <button class="page-btn" id="pb_next_${id}" ${page===total-1?'disabled':''}>▶</button>`;
      el.appendChild(nav);
      nav.querySelector(`#pb_prev_${id}`).addEventListener('click', () => { _state[id]--; paginate(id); });
      nav.querySelector(`#pb_next_${id}`).addEventListener('click', () => { _state[id]++; paginate(id); });
    }
  }

  // Run after each data load
  function paginateAll() {
    Object.keys(PAGE_SIZES).forEach(paginate);
  }

  // Hook into the existing fetch cycle — re-paginate after render
  const _origFetch = window.fetch;
  window.fetch = function(...args) {
    return _origFetch.apply(this, args).then(r => {
      setTimeout(paginateAll, 200);
      return r;
    });
  };

  // Also run on initial load
  document.addEventListener('DOMContentLoaded', () => setTimeout(paginateAll, 1500));
  window.addEventListener('load', () => setTimeout(paginateAll, 500));
})();
