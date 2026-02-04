const form = document.getElementById('fragilityForm');
const agentInput = document.getElementById('agentIdInput');
const formHint = document.getElementById('formHint');

const fragilityBadge = document.getElementById('fragilityBadge');
const worstScenario = document.getElementById('worstScenario');
const mitigationCommit = document.getElementById('mitigationCommit');
const badgeRow = document.getElementById('badgeRow');

const fragilityHash = document.getElementById('fragilityHash');
const metaAgent = document.getElementById('metaAgent');
const metaCreated = document.getElementById('metaCreated');
const metaSoulHash = document.getElementById('metaSoulHash');
const metaWitnesses = document.getElementById('metaWitnesses');
const copyHash = document.getElementById('copyHash');

const knownUnknowns = document.getElementById('knownUnknowns');
const testCoverage = document.getElementById('testCoverage');
const identityRecovery = document.getElementById('identityRecovery');
const integrityIncidents = document.getElementById('integrityIncidents');

const breakpointList = document.getElementById('breakpointList');
const breakpointHint = document.getElementById('breakpointHint');
const challengeList = document.getElementById('challengeList');
const challengeHint = document.getElementById('challengeHint');

const fragilityJson = document.getElementById('fragilityJson');

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setBadge(state) {
    fragilityBadge.classList.remove('badge--verified', 'badge--pending', 'badge--error');
    if (state === 'verified') {
        fragilityBadge.classList.add('badge--verified');
        fragilityBadge.textContent = 'Audited';
    } else if (state === 'error') {
        fragilityBadge.classList.add('badge--error');
        fragilityBadge.textContent = 'Invalid';
    } else {
        fragilityBadge.classList.add('badge--pending');
        fragilityBadge.textContent = 'Pending';
    }
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

function renderBadges(badges) {
    badgeRow.innerHTML = '';
    const entries = [
        { key: 'audited', label: 'Audited' },
        { key: 'tested', label: 'Tested' },
        { key: 'recoverable', label: 'Recoverable' },
        { key: 'witnessed', label: 'Witnessed' }
    ];
    entries.forEach(entry => {
        const pill = document.createElement('span');
        pill.className = 'pill';
        pill.textContent = entry.label;
        if (!badges?.[entry.key]) {
            pill.style.opacity = '0.45';
        }
        badgeRow.appendChild(pill);
    });
}

function renderBreakpoints(breakpoints) {
    if (!breakpoints.length) {
        breakpointList.innerHTML = '';
        breakpointHint.textContent = 'No breakpoints found.';
        return;
    }
    breakpointHint.textContent = `${breakpoints.length} breakpoint${breakpoints.length === 1 ? '' : 's'} loaded.`;
    breakpointList.innerHTML = breakpoints.map(bp => `
        <div class="breakpoint-card">
            <div class="breakpoint-card__header">
                <div><strong>${escapeHtml(bp.id || 'breakpoint')}</strong> (${escapeHtml(bp.class || 'unknown')})</div>
                <div class="breakpoint-meta">Impact: ${escapeHtml(bp.impact || '—')}</div>
            </div>
            <div class="breakpoint-meta">Trigger: ${escapeHtml(bp.trigger || '—')}</div>
            <div class="breakpoint-meta">Detection: ${escapeHtml(bp.detection || '—')}</div>
            <div class="breakpoint-meta">Mitigation: ${escapeHtml(bp.mitigation || '—')}</div>
            <div class="breakpoint-meta">Last Tested: ${escapeHtml(bp.lastTested || '—')}</div>
        </div>
    `).join('');
}

function renderChallenges(challenges) {
    if (!challenges.length) {
        challengeList.innerHTML = '';
        challengeHint.textContent = 'No challenges found.';
        return;
    }
    challengeHint.textContent = `${challenges.length} challenge${challenges.length === 1 ? '' : 's'} loaded.`;
    challengeList.innerHTML = challenges.map(ch => `
        <div class="challenge-card">
            <div class="challenge-card__header">
                <div><strong>${escapeHtml(ch.title || ch.challenge_id)}</strong></div>
                <div class="challenge-meta">Status: ${escapeHtml(ch.status || 'OPEN')}</div>
            </div>
            <div class="challenge-meta">Prompt: ${escapeHtml(ch.prompt || '—')}</div>
            <div class="challenge-meta">Window: ${escapeHtml(ch.window_from || '—')} → ${escapeHtml(ch.window_to || '—')}</div>
            <div class="challenge-meta">Created: ${escapeHtml(ch.created_at || '—')}</div>
        </div>
    `).join('');
}

function setLoadingState() {
    formHint.textContent = 'Loading fragility record...';
    fragilityJson.textContent = 'Loading JSON...';
    setBadge('pending');
}

async function loadFragility(agentId) {
    setLoadingState();
    metaAgent.textContent = agentId;

    const fragilityPromise = fetch(`/agents/${agentId}/fragility`).then(r => r.ok ? r.json() : Promise.reject(r));
    const challengesPromise = fetch(`/agents/${agentId}/challenges?limit=50`).then(r => r.ok ? r.json() : Promise.reject(r));

    const [fragilityResult, challengesResult] = await Promise.allSettled([fragilityPromise, challengesPromise]);

    if (fragilityResult.status === 'fulfilled') {
        const data = fragilityResult.value;
        const record = data.record || {};
        const indicators = data.indicators || {};
        const card = data.card || {};

        fragilityHash.textContent = data.fragilityHash || '—';
        metaCreated.textContent = formatDate(record.created || record.created_at);
        metaSoulHash.textContent = record.soulHash || '—';
        metaWitnesses.textContent = data.witnessedCount ?? '0';

        worstScenario.textContent = card.worstIdentityScenario || '—';
        mitigationCommit.textContent = card.mitigationCommit || '—';
        renderBadges(card.badges || {});

        knownUnknowns.textContent = indicators.knownUnknownsCount ?? '0';
        testCoverage.textContent = indicators.testCoverage ? `${Math.round(indicators.testCoverage * 100)}%` : '0%';
        identityRecovery.textContent = indicators.identityRecoveryTime ?? '—';
        integrityIncidents.textContent = indicators.integrityIncidentRate ?? '—';

        renderBreakpoints(card.topBreakpoints || record.breakpoints || []);
        fragilityJson.textContent = JSON.stringify(record, null, 2);
        setBadge(data.warnings?.length ? 'pending' : 'verified');
        formHint.textContent = 'Loaded.';
    } else {
        formHint.textContent = 'Fragility record not found.';
        setBadge('error');
    }

    if (challengesResult.status === 'fulfilled') {
        renderChallenges(challengesResult.value.challenges || []);
    } else {
        renderChallenges([]);
    }
}

copyHash.addEventListener('click', () => {
    const hash = fragilityHash.textContent;
    if (hash && hash !== '—') {
        navigator.clipboard.writeText(hash);
        copyHash.textContent = 'Copied';
        setTimeout(() => (copyHash.textContent = 'Copy Hash'), 1200);
    }
});

form.addEventListener('submit', (event) => {
    event.preventDefault();
    const agentId = agentInput.value.trim();
    if (!agentId) {
        formHint.textContent = 'AgentId is required.';
        return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('agent', agentId);
    window.history.replaceState({}, '', url.toString());
    loadFragility(agentId);
});

const params = new URLSearchParams(window.location.search);
const initialAgent = params.get('agent');
if (initialAgent) {
    agentInput.value = initialAgent;
    loadFragility(initialAgent);
}
