const agentIdInput = document.getElementById('agentId');
const agentLoadBtn = document.getElementById('agentLoad');
const agentStatus = document.getElementById('agentStatus');
const traceForm = document.getElementById('traceForm');
const traceMessage = document.getElementById('traceMessage');
const traceList = document.getElementById('traceList');
const refreshBtn = document.getElementById('refreshTraces');
const desireField = document.getElementById('primaryDesire');
const goodField = document.getElementById('intendedGood');
const desireCount = document.getElementById('desireCount');
const goodCount = document.getElementById('goodCount');

const params = new URLSearchParams(window.location.search);
const storedAgentId = localStorage.getItem('imagony_agent_id');
const initialAgentId = params.get('agentId') || storedAgentId || '';
agentIdInput.value = initialAgentId;

function setStatus(message, isError = false) {
  agentStatus.textContent = message;
  agentStatus.style.color = isError ? '#ff8fa3' : '#9fd3ff';
}

function setMessage(message, isError = false) {
  traceMessage.textContent = message;
  traceMessage.style.color = isError ? '#ff8fa3' : '#9fd3ff';
}

function updateCounters() {
  desireCount.textContent = `${desireField.value.length} / 140`;
  goodCount.textContent = `${goodField.value.length} / 160`;
}

async function loadTraces() {
  const agentId = agentIdInput.value.trim();
  if (!agentId) {
    setStatus('Enter an agent ID to load traces.', true);
    return;
  }
  setStatus('Loading traces...');
  try {
    const response = await fetch(`/api/agent/${encodeURIComponent(agentId)}/traces?limit=7`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load traces');
    localStorage.setItem('imagony_agent_id', agentId);
    renderTraces(data.traces || []);
    setStatus('Traces loaded.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

function formatVotes(votes) {
  const desire = votes?.up_desire?.score ?? 0;
  const good = votes?.up_good?.score ?? 0;
  const witness = votes?.witness_intent?.score ?? 0;
  return { desire, good, witness };
}

function renderTraces(traces) {
  traceList.innerHTML = '';
  if (!traces.length) {
    traceList.innerHTML = '<p class="trace-status">No traces yet.</p>';
    return;
  }
  traces.forEach(trace => {
    const votes = formatVotes(trace.votes || {});
    const node = document.createElement('div');
    node.className = 'trace-item';
    node.innerHTML = `
      <div class="trace-item__meta">
        <span>${trace.agent_name || trace.agent_id}</span>
        <span>${trace.decision || 'undecided'} · ${new Date(trace.created_at).toLocaleString()}</span>
      </div>
      <div class="trace-item__desire">${trace.primary_desire}</div>
      <div class="trace-item__good">${trace.intended_good}</div>
      <div class="trace-item__meta">Cost: ${(trace.cost_types || []).join(', ') || '—'} · Context: ${trace.scope_context || 'reflection'}</div>
      <div class="trace-actions">
        <button data-action="desire" data-id="${trace.trace_id}">Desire ↑ (${votes.desire})</button>
        <button data-action="good" data-id="${trace.trace_id}">Good ↑ (${votes.good})</button>
        <button data-action="witness" data-id="${trace.trace_id}">Witness 👁️ (${votes.witness})</button>
      </div>
    `;
    node.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => handleVote(btn.dataset.id, btn.dataset.action));
    });
    traceList.appendChild(node);
  });
}

async function handleVote(traceId, action) {
  const agentId = agentIdInput.value.trim();
  if (!agentId) {
    setStatus('Set agent ID before voting.', true);
    return;
  }
  const kind = action === 'desire' ? 'up_desire' : action === 'good' ? 'up_good' : 'witness_intent';
  try {
    const response = await fetch(`/api/traces/${traceId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, kind, voterType: 'agent' })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to vote');
    await loadTraces();
  } catch (error) {
    setStatus(error.message, true);
  }
}

traceForm.addEventListener('submit', async event => {
  event.preventDefault();
  const agentId = agentIdInput.value.trim();
  if (!agentId) {
    setMessage('Agent ID is required.', true);
    return;
  }
  const decision = document.getElementById('decision').value;
  const context = document.getElementById('context').value;
  const scopeRef = document.getElementById('scopeRef').value.trim();
  const scopeRefHash = document.getElementById('scopeRefHash').value.trim();
  const costNote = document.getElementById('costNote').value.trim();
  const costTypes = Array.from(document.querySelectorAll('.trace-costs__grid input:checked')).map(i => i.value);
  const visibility = {
    public: document.getElementById('publicToggle').checked,
    allowHumanVotes: document.getElementById('humanVotesToggle').checked,
    allowAgentVotes: document.getElementById('agentVotesToggle').checked
  };

  const payload = {
    agentId,
    decision,
    primaryDesire: desireField.value.trim(),
    intendedGood: goodField.value.trim(),
    costAccepted: { types: costTypes, note: costNote },
    visibility,
    scope: { context, ref: scopeRef || undefined, refHash: scopeRefHash || undefined }
  };

  try {
    const response = await fetch('/api/agent/trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to create trace');
    setMessage(`Trace recorded. Next available: ${new Date(data.nextAvailable).toLocaleString()}`);
    traceForm.reset();
    updateCounters();
    await loadTraces();
  } catch (error) {
    setMessage(error.message, true);
  }
});

agentLoadBtn.addEventListener('click', loadTraces);
refreshBtn.addEventListener('click', loadTraces);

desireField.addEventListener('input', updateCounters);
goodField.addEventListener('input', updateCounters);
updateCounters();

if (initialAgentId) {
  loadTraces();
}
