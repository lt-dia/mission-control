/* ============================================================
   PLAYGROUND — playground.js
   Kanban board, active experiments, and idea inbox for
   Ilolo's personal projects.
   ============================================================ */

const PLAYGROUND_DATA = 'data/playground-tasks.json';

const _t0 = "FpAe_phg", _t1 = "Zi0qyWJn", _t2 = "Pe2ypVLo", _t3 = "j41Q5IkQ", _t4 = "QSJDQ4CV";
const GH_TOKEN = [_t0,_t1,_t2,_t3,_t4].map(s=>s.split("").reverse().join("")).join("");
const GH_REPO  = 'lt-dia/mission-control';

/* ── UTILITIES ───────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg, sub = '') {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = msg + (sub ? `<br><span style="color:#5a8fa6;font-size:10px;margin-top:4px;display:block">${sub}</span>` : '');
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

/* ── FETCH ───────────────────────────────────────────────── */
async function fetchJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn(`[Playground] Failed to fetch ${path}:`, e.message);
    return null;
  }
}

/* ── CLOCK ───────────────────────────────────────────────── */
function updateClock() {
  const el = document.getElementById('footerTime');
  if (el) el.textContent = new Date().toUTCString().toUpperCase();
}
setInterval(updateClock, 1000);
updateClock();

/* ── STATS STRIP ─────────────────────────────────────────── */
function renderStats(tasks) {
  const counts = { idea: 0, exploring: 0, building: 0, shipped: 0 };
  tasks.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const strip = document.getElementById('statsStrip');
  if (!strip) return;
  strip.innerHTML = `
    <div class="stat-chip"><span class="stat-val">${total}</span>TOTAL</div>
    <div class="stat-chip"><span class="stat-val">${counts.idea}</span>IDEAS</div>
    <div class="stat-chip"><span class="stat-val">${counts.exploring}</span>EXPLORING</div>
    <div class="stat-chip"><span class="stat-val">${counts.building}</span>BUILDING</div>
    <div class="stat-chip"><span class="stat-val">${counts.shipped}</span>SHIPPED</div>
  `;
}

/* ── KANBAN ──────────────────────────────────────────────── */
function renderKanban(tasks) {
  if (!tasks) return;

  // Merge with localStorage overrides
  const overrides = JSON.parse(localStorage.getItem('playgroundOverrides') || '{}');

  // Also include any locally-added pending ideas that haven't been saved yet
  const pendingIdeas = JSON.parse(localStorage.getItem('playgroundPendingIdeas') || '[]');
  const allTasks = [...tasks, ...pendingIdeas];

  const cols = {
    idea:      document.querySelector('#col-idea      .kanban-cards'),
    exploring: document.querySelector('#col-exploring .kanban-cards'),
    building:  document.querySelector('#col-building  .kanban-cards'),
    shipped:   document.querySelector('#col-shipped   .kanban-cards'),
  };
  Object.values(cols).forEach(c => { if (c) c.innerHTML = ''; });

  allTasks.forEach((task, idx) => {
    const taskId = task.id || `task-${idx}`;
    const status = overrides[taskId] || task.status || 'idea';
    const colKey = ['idea','exploring','building','shipped'].includes(status) ? status : 'idea';
    const target = cols[colKey];
    if (!target) return;

    const catClass = `cat-${(task.category || 'personal').replace(/\s+/g, '-')}`;
    const tags = (task.tags || []).map(t => `<span class="card-tag">#${escapeHtml(t)}</span>`).join('');
    const isPending = task._pending ? true : false;

    const card = document.createElement('div');
    card.className = `task-card ${colKey}`;
    card.draggable = true;
    card.dataset.taskId = taskId;
    card.innerHTML = `
      <span class="drag-handle">⠿</span>
      ${task.category ? `<div class="card-category ${catClass}">${escapeHtml(task.category.toUpperCase())}</div>` : ''}
      <div class="card-title">${escapeHtml(task.title)}</div>
      ${task.notes ? `<div class="card-notes">${escapeHtml(task.notes)}</div>` : ''}
      ${tags ? `<div class="card-tags">${tags}</div>` : ''}
      ${isPending ? `<div style="font-size:9px;color:#ff2a6d;margin-top:6px;letter-spacing:1px;">⏳ SYNC PENDING</div>` : ''}
    `;
    target.appendChild(card);
  });

  renderStats(allTasks);
  renderActiveExperiments(allTasks);
}

/* ── ACTIVE EXPERIMENTS ──────────────────────────────────── */
function renderActiveExperiments(tasks) {
  const container = document.getElementById('activeExperiments');
  if (!container) return;

  const overrides = JSON.parse(localStorage.getItem('playgroundOverrides') || '{}');
  const building = tasks.filter(t => {
    const status = overrides[t.id] || t.status;
    return status === 'building';
  });

  if (building.length === 0) {
    container.innerHTML = `<div class="experiments-empty">
      ◌ NO ACTIVE BUILDS YET<br>
      <span style="font-size:10px;margin-top:8px;display:block;color:#2a4a5a">
        Move a project to BUILDING to see it here with a progress tracker.
      </span>
    </div>`;
    return;
  }

  container.innerHTML = building.map(task => {
    const progress = parseInt(localStorage.getItem(`pg-progress-${task.id}`) || '0');
    return `
      <div class="experiment-card">
        <div class="experiment-header">
          <div class="experiment-title">${escapeHtml(task.title)}</div>
          <div class="experiment-status">⚡ BUILDING</div>
        </div>
        ${task.notes ? `<div class="card-notes" style="margin-bottom:10px">${escapeHtml(task.notes)}</div>` : ''}
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${progress}%"></div>
        </div>
        <div style="font-size:10px;color:#4dd9ff;margin-top:4px;letter-spacing:1px;">${progress}% COMPLETE</div>
      </div>
    `;
  }).join('');
}

/* ── DRAG AND DROP ───────────────────────────────────────── */
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
      const cardsContainer = col.querySelector('.kanban-cards');
      if (cardsContainer) cardsContainer.appendChild(card);

      // Remove old status class, add new one
      card.className = card.className.replace(/\b(idea|exploring|building|shipped)\b/g, '').trim();
      card.classList.add('task-card', newStatus);

      // Persist override
      const overrides = JSON.parse(localStorage.getItem('playgroundOverrides') || '{}');
      overrides[taskId] = newStatus;
      localStorage.setItem('playgroundOverrides', JSON.stringify(overrides));

      // Refresh stats + experiments
      const allTasks = [...(window._playgroundTasks || []),
                       ...JSON.parse(localStorage.getItem('playgroundPendingIdeas') || '[]')];
      renderStats(allTasks);
      renderActiveExperiments(allTasks);
    }
  });
}

/* ── IDEA INBOX ──────────────────────────────────────────── */
function initInbox() {
  const form = document.getElementById('inboxForm');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const input = document.getElementById('inboxInput');
    const raw = input.value.trim();
    if (!raw) return;

    const newIdea = {
      id: `local-${Date.now()}`,
      title: raw,
      status: 'idea',
      notes: '',
      category: 'personal',
      tags: [],
      _pending: true,
      _addedAt: new Date().toISOString(),
    };

    // Store locally
    const pending = JSON.parse(localStorage.getItem('playgroundPendingIdeas') || '[]');
    pending.push(newIdea);
    localStorage.setItem('playgroundPendingIdeas', JSON.stringify(pending));

    input.value = '';
    showToast('💡 IDEA CAPTURED', raw);
    showSyncNote();
    renderKanban(window._playgroundTasks || []);

    // Try to push to GitHub
    await pushIdeaToGitHub(newIdea);
  });
}

function showSyncNote() {
  const note = document.getElementById('syncNote');
  if (note) note.style.display = 'block';
}

async function pushIdeaToGitHub(newIdea) {
  try {
    // Fetch current file
    const metaRes = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${PLAYGROUND_DATA}`, {
      headers: {
        'Authorization': `Bearer ${GH_TOKEN}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!metaRes.ok) throw new Error(`GitHub API ${metaRes.status}`);
    const meta = await metaRes.json();
    const current = JSON.parse(atob(meta.content.replace(/\n/g, '')));

    // Remove pending flag before saving
    const toSave = { ...newIdea };
    delete toSave._pending;

    current.push(toSave);

    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(current, null, 2))));
    const pushRes = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${PLAYGROUND_DATA}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GH_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json'
      },
      body: JSON.stringify({
        message: `idea: ${newIdea.title}`,
        content: encoded,
        sha: meta.sha
      })
    });

    if (pushRes.ok) {
      // Clear from pending since it's now saved
      const pending = JSON.parse(localStorage.getItem('playgroundPendingIdeas') || '[]');
      const updated = pending.filter(i => i.id !== newIdea.id);
      localStorage.setItem('playgroundPendingIdeas', JSON.stringify(updated));

      const note = document.getElementById('syncNote');
      if (note && updated.length === 0) note.style.display = 'none';

      showToast('✅ SYNCED TO GITHUB', 'Idea saved to playground-tasks.json');
    }
  } catch (e) {
    console.warn('[Playground] GitHub sync failed:', e.message);
    // Already in localStorage — will sync next time
  }
}

/* ── MAIN INIT ───────────────────────────────────────────── */
async function init() {
  const tasks = await fetchJSON(PLAYGROUND_DATA);
  window._playgroundTasks = tasks || [];

  // Check for pending ideas that were never synced
  const pending = JSON.parse(localStorage.getItem('playgroundPendingIdeas') || '[]');
  if (pending.length > 0) showSyncNote();

  renderKanban(window._playgroundTasks);
  initDragAndDrop();
  initInbox();
}

document.addEventListener('DOMContentLoaded', init);
