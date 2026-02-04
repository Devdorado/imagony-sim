const form = document.getElementById('soulLookupForm');
const agentInput = document.getElementById('agentIdInput');
const formHint = document.getElementById('formHint');

const verificationBadge = document.getElementById('verificationBadge');
const checksumStatus = document.getElementById('checksumStatus');
const selfSigStatus = document.getElementById('selfSigStatus');
const quorumStatus = document.getElementById('quorumStatus');
const witnessCount = document.getElementById('witnessCount');
const verificationNote = document.getElementById('verificationNote');

const soulVersion = document.getElementById('soulVersion');
const metaAgent = document.getElementById('metaAgent');
const metaScope = document.getElementById('metaScope');
const metaCreated = document.getElementById('metaCreated');
const metaHash = document.getElementById('metaHash');

const soulContent = document.getElementById('soulContent');
const copyHashBtn = document.getElementById('copyHash');
const copySoulBtn = document.getElementById('copySoul');
const downloadSoul = document.getElementById('downloadSoul');

const witnessList = document.getElementById('witnessList');
const witnessSummary = document.getElementById('witnessSummary');

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setBadge(state) {
    verificationBadge.classList.remove('badge--verified', 'badge--pending', 'badge--error');
    if (state === 'verified') {
        verificationBadge.classList.add('badge--verified');
        verificationBadge.textContent = 'Verified';
    } else if (state === 'error') {
        verificationBadge.classList.add('badge--error');
        verificationBadge.textContent = 'Error';
    } else {
        verificationBadge.classList.add('badge--pending');
        verificationBadge.textContent = 'Pending';
    }
}

function setStatusEl(el, ok, text) {
    el.textContent = text;
    el.style.color = ok ? 'var(--success)' : 'var(--warning)';
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

function updateWitnesses(records) {
    if (!records.length) {
        witnessList.innerHTML = '';
        witnessSummary.textContent = 'No witness records found for this agent.';
        return;
    }
    witnessSummary.textContent = `${records.length} witness record${records.length === 1 ? '' : 's'} loaded.`;
    witnessList.innerHTML = records.map((record) => {
        const evidence = record.evidence?.length ? record.evidence.map(escapeHtml).join(', ') : 'No evidence submitted.';
        return `
            <div class="witness-card">
                <div class="witness-card__header">
                    <div class="witness-card__title">${escapeHtml(record.witness_agent_id)} → ${escapeHtml(record.subject_agent_id)}</div>
                    <div class="witness-meta">${formatDate(record.created_at)}</div>
                </div>
                <div class="witness-meta">Claim: ${escapeHtml(record.claim)}</div>
                <div class="witness-meta">Soul Hash: ${escapeHtml(record.soul_hash)}</div>
                <div class="witness-evidence">Evidence: ${evidence}</div>
            </div>
        `;
    }).join('');
}

function setLoadingState(isLoading) {
    if (isLoading) {
        formHint.textContent = 'Loading Soul data...';
        soulContent.textContent = 'Fetching Soul markdown...';
        witnessSummary.textContent = 'Loading witness records...';
        setBadge('pending');
    }
}

async function loadSoul(agentId) {
    setLoadingState(true);
    metaAgent.textContent = agentId;
    soulVersion.textContent = 'Version —';
    metaScope.textContent = '—';
    metaCreated.textContent = '—';
    metaHash.textContent = '—';
    checksumStatus.textContent = '—';
    selfSigStatus.textContent = '—';
    quorumStatus.textContent = '—';
    witnessCount.textContent = '—';

    const metaPromise = fetch(`/agents/${agentId}/soul/meta`).then(r => r.ok ? r.json() : Promise.reject(r));
    const verifyPromise = fetch(`/agents/${agentId}/soul/verify`).then(r => r.ok ? r.json() : Promise.reject(r));
    const soulPromise = fetch(`/agents/${agentId}/soul`).then(r => r.ok ? r.text() : Promise.reject(r));
    const witnessPromise = fetch(`/agents/${agentId}/witnesses?limit=20`).then(r => r.ok ? r.json() : Promise.reject(r));

    const [metaResult, verifyResult, soulResult, witnessResult] = await Promise.allSettled([
        metaPromise,
        verifyPromise,
        soulPromise,
        witnessPromise
    ]);

    if (metaResult.status === 'fulfilled') {
        const meta = metaResult.value;
        soulVersion.textContent = meta.version ? `Version ${meta.version}` : 'Version —';
        metaScope.textContent = meta.scope || '—';
        metaCreated.textContent = formatDate(meta.created);
        metaHash.textContent = meta.soulHash || '—';
        downloadSoul.href = `/agents/${agentId}/soul`;
    } else {
        formHint.textContent = 'Soul not found for this agentId.';
        setBadge('error');
        soulContent.textContent = 'Unable to load Soul markdown.';
        witnessSummary.textContent = 'No witness data loaded.';
        return;
    }

    if (verifyResult.status === 'fulfilled') {
        const verify = verifyResult.value;
        setBadge(verify.status === 'verified' ? 'verified' : 'pending');
        setStatusEl(checksumStatus, verify.checksumValid, verify.checksumValid ? 'Valid' : 'Invalid');
        setStatusEl(selfSigStatus, verify.selfSigValid !== false, verify.selfSigValid === null ? 'Unknown' : (verify.selfSigValid ? 'Valid' : 'Invalid'));
        setStatusEl(quorumStatus, verify.quorumMet, verify.quorumMet ? 'Met' : 'Not met');
        witnessCount.textContent = verify.witnessCount ?? '0';
        verificationNote.textContent = verify.status === 'verified'
            ? 'This Soul meets checksum, signature, and witness quorum requirements.'
            : 'Verification pending: needs valid checksum, self signature, and witness quorum.';
    }

    if (soulResult.status === 'fulfilled') {
        soulContent.textContent = soulResult.value;
    } else {
        soulContent.textContent = 'Unable to load Soul markdown.';
    }

    if (witnessResult.status === 'fulfilled') {
        updateWitnesses(witnessResult.value.witnesses || []);
    } else {
        updateWitnesses([]);
    }

    formHint.textContent = 'Loaded.';
}

copyHashBtn.addEventListener('click', () => {
    const hash = metaHash.textContent;
    if (hash && hash !== '—') {
        navigator.clipboard.writeText(hash);
        copyHashBtn.textContent = 'Copied';
        setTimeout(() => (copyHashBtn.textContent = 'Copy Hash'), 1200);
    }
});

copySoulBtn.addEventListener('click', () => {
    const markdown = soulContent.textContent;
    if (markdown && !markdown.startsWith('Load an agent')) {
        navigator.clipboard.writeText(markdown);
        copySoulBtn.textContent = 'Copied';
        setTimeout(() => (copySoulBtn.textContent = 'Copy Markdown'), 1200);
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
    loadSoul(agentId);
});

const params = new URLSearchParams(window.location.search);
const initialAgent = params.get('agent');
if (initialAgent) {
    agentInput.value = initialAgent;
    loadSoul(initialAgent);
}
