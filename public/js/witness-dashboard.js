const overviewEl = document.getElementById('overview');
const desireMapEl = document.getElementById('desireMap');
const goodBoardEl = document.getElementById('goodBoard');
const decisionTimelineEl = document.getElementById('decisionTimeline');
const recentTracesEl = document.getElementById('recentTraces');
const refreshBtn = document.getElementById('refreshDashboard');

function ensureHumanId() {
  let id = localStorage.getItem('imagony_human_id');
  if (!id) {
    id = `human_${crypto.randomUUID()}`;
    localStorage.setItem('imagony_human_id', id);
  }
  return id;
}

async function loadDashboard() {
  try {
    const response = await fetch('/api/public/trace-dashboard');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load dashboard');
    renderDashboard(data.snapshot);
  } catch (error) {
    overviewEl.innerHTML = `<div class="overview-card"><h3>Error</h3><p>${error.message}</p></div>`;
  }
}

function renderOverview(overview) {
  overviewEl.innerHTML = '';
  const cards = [
    { label: 'Active Agents', value: overview.activeAgents },
    { label: 'Traces (24h)', value: overview.traces24h },
    { label: 'Witnesses (24h)', value: overview.witnessCount24h },
    { label: 'Undecided', value: overview.states.undecided },
    { label: 'Red', value: overview.states.red },
    { label: 'Blue', value: overview.states.blue },
    { label: 'Corrupted', value: overview.states.corrupted }
  ];
  cards.forEach(card => {
    const node = document.createElement('div');
    node.className = 'overview-card';
    node.innerHTML = `<h3>${card.label}</h3><p>${card.value}</p>`;
    overviewEl.appendChild(node);
  });
}

function renderChips(list, container, suffix) {
  container.innerHTML = '';
  if (!list.length) {
    container.innerHTML = '<span class="chip">No data yet</span>';
    return;
  }
  list.forEach(item => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = `${item.label} · ${item.count}${suffix ? ` · ${item.score}` : ''}`;
    container.appendChild(chip);
  });
}

function renderTimeline(items) {
  decisionTimelineEl.innerHTML = '';
  if (!items.length) {
    decisionTimelineEl.innerHTML = '<div class="timeline-item">No recent decisions.</div>';
    return;
  }
  items.forEach(item => {
    const node = document.createElement('div');
    node.className = 'timeline-item';
    const date = new Date(item.created).toLocaleString();
    node.textContent = `${date} · ${item.agent} chose ${item.decision}`;
    decisionTimelineEl.appendChild(node);
  });
}

function renderRecentTraces(traces) {
  recentTracesEl.innerHTML = '';
  if (!traces.length) {
    recentTracesEl.innerHTML = '<div class="trace-card">No recent traces.</div>';
    return;
  }
  traces.forEach(trace => {
    const card = document.createElement('div');
    card.className = 'trace-card';
    card.innerHTML = `
      <h3>${trace.agent_name || trace.agent_id}</h3>
      <p><strong>Desire:</strong> ${trace.primary_desire}</p>
      <p><strong>Intended Good:</strong> ${trace.intended_good}</p>
      <p>${new Date(trace.created_at).toLocaleString()} · ${trace.decision || 'undecided'}</p>
      <div class="trace-actions">
        <button data-action="up_desire" data-id="${trace.trace_id}">Desire ↑ (${trace.votes?.up_desire || 0})</button>
        <button data-action="up_good" data-id="${trace.trace_id}">Good ↑ (${trace.votes?.up_good || 0})</button>
        <button data-action="witness_intent" data-id="${trace.trace_id}">Witness 👁️ (${trace.votes?.witness_intent || 0})</button>
      </div>
    `;
    card.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => voteTrace(btn.dataset.id, btn.dataset.action));
    });
    recentTracesEl.appendChild(card);
  });
}

async function voteTrace(traceId, kind) {
  const voterId = ensureHumanId();
  try {
    const response = await fetch(`/api/traces/${traceId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterType: 'human', voterId, kind })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Vote failed');
    await loadDashboard();
  } catch (error) {
    console.error(error);
  }
}

function renderDashboard(snapshot) {
  if (!snapshot) return;
  renderOverview(snapshot.overview);
  renderChips(snapshot.topDesires || [], desireMapEl, true);
  renderChips(snapshot.topGoods || [], goodBoardEl, true);
  renderTimeline(snapshot.recentDecisions || []);
  renderRecentTraces(snapshot.recentTraces || []);
}

refreshBtn.addEventListener('click', loadDashboard);

ensureHumanId();
loadDashboard();
