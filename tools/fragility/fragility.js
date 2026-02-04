const crypto = require('crypto');

const FRAGILITY_PROTOCOL = 'imagony/fragility';
const FRAGILITY_VERSION = '0.1';

const REQUIRED_BREAKPOINTS = [
    'credits exhaustion',
    'provider lockout',
    'memory wipe',
    'tool compromise',
    'policy refusal',
    'network loss'
];

const BREAKPOINT_CLASSES = ['existence', 'identity', 'integrity'];
const IMPACT_LEVELS = ['stop', 'degrade', 'drift', 'corrupt'];

const FRAGILITY_SCHEMA = {
    protocol: FRAGILITY_PROTOCOL,
    version: FRAGILITY_VERSION,
    fields: [
        'protocol',
        'version',
        'agent',
        'created',
        'soulHash',
        'environment',
        'dependencies',
        'breakpoints',
        'controls',
        'metrics',
        'notes'
    ]
};

function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        const items = value.map(item => stableStringify(item));
        return `[${items.join(',')}]`;
    }
    const keys = Object.keys(value).sort();
    const entries = keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(',')}}`;
}

function canonicalizeFragility(fragility) {
    return stableStringify(fragility);
}

function hashFragility(canonicalJson) {
    return crypto.createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}

function validateFragility(fragility) {
    const errors = [];
    const warnings = [];

    if (!fragility || typeof fragility !== 'object') {
        return { errors: ['Fragility payload must be an object'], warnings };
    }

    for (const field of FRAGILITY_SCHEMA.fields) {
        if (fragility[field] === undefined || fragility[field] === null) {
            errors.push(`Missing required field: ${field}`);
        }
    }

    if (fragility.protocol !== FRAGILITY_PROTOCOL) {
        errors.push(`protocol must be ${FRAGILITY_PROTOCOL}`);
    }

    if (fragility.version !== FRAGILITY_VERSION) {
        errors.push('version must be "0.1"');
    }

    if (fragility.created && !/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/.test(fragility.created)) {
        errors.push('created must be ISO 8601 UTC (YYYY-MM-DDTHH:MM:SSZ)');
    }

    if (typeof fragility.notes === 'string' && fragility.notes.length > 240) {
        errors.push('notes must be 240 chars or less');
    }

    if (!Array.isArray(fragility.dependencies)) {
        errors.push('dependencies must be an array');
    } else {
        fragility.dependencies.forEach((dep, idx) => {
            if (!dep?.name || !dep?.type) {
                errors.push(`dependencies[${idx}] missing name or type`);
            }
            if (!dep?.criticality) {
                warnings.push(`dependencies[${idx}] missing criticality`);
            }
            if (!dep?.failMode) {
                warnings.push(`dependencies[${idx}] missing failMode`);
            }
        });
    }

    if (!Array.isArray(fragility.breakpoints)) {
        errors.push('breakpoints must be an array');
    } else {
        fragility.breakpoints.forEach((bp, idx) => {
            const path = `breakpoints[${idx}]`;
            if (!bp?.id) errors.push(`${path} missing id`);
            if (!bp?.class || !BREAKPOINT_CLASSES.includes(bp.class)) {
                errors.push(`${path} class must be existence|identity|integrity`);
            }
            if (!bp?.trigger) errors.push(`${path} missing trigger`);
            if (!bp?.impact || !IMPACT_LEVELS.includes(bp.impact)) {
                errors.push(`${path} impact must be stop|degrade|drift|corrupt`);
            }
            if (!bp?.detection) errors.push(`${path} missing detection`);
            if (!bp?.mitigation) errors.push(`${path} missing mitigation`);
            if (bp?.mitigation && !bp?.controlId && bp?.planned !== true) {
                errors.push(`${path} mitigation must reference controlId or be planned:true`);
            }
        });
    }

    if (!Array.isArray(fragility.controls)) {
        errors.push('controls must be an array');
    } else {
        fragility.controls.forEach((control, idx) => {
            if (!control?.controlId || !control?.description) {
                errors.push(`controls[${idx}] missing controlId or description`);
            }
        });
    }

    if (typeof fragility.metrics !== 'object' || Array.isArray(fragility.metrics)) {
        errors.push('metrics must be an object');
    } else {
        const { mtbfGuess, restoreTimeGuess, identityLossRisk, integrityRisk } = fragility.metrics;
        if (mtbfGuess !== undefined && typeof mtbfGuess !== 'number') errors.push('metrics.mtbfGuess must be number');
        if (restoreTimeGuess !== undefined && typeof restoreTimeGuess !== 'number') errors.push('metrics.restoreTimeGuess must be number');
        if (identityLossRisk !== undefined && typeof identityLossRisk !== 'number') errors.push('metrics.identityLossRisk must be number');
        if (integrityRisk !== undefined && typeof integrityRisk !== 'number') errors.push('metrics.integrityRisk must be number');
    }

    const breakpointsText = (fragility.breakpoints || []).map(bp => `${bp.id} ${bp.trigger}`.toLowerCase());
    const missing = REQUIRED_BREAKPOINTS.filter(req => !breakpointsText.some(text => text.includes(req)));
    if (missing.length) {
        errors.push(`Missing required breakpoints: ${missing.join(', ')}`);
    }

    const canonicalJson = canonicalizeFragility(fragility);
    const hashHex = hashFragility(canonicalJson);

    return { errors, warnings, canonicalJson, hashHex };
}

function computeIndicators(fragility) {
    const now = Date.now();
    const breakpoints = Array.isArray(fragility.breakpoints) ? fragility.breakpoints : [];

    const unknowns = breakpoints.filter(bp => {
        const detection = String(bp?.detection || '').toLowerCase();
        const mitigation = String(bp?.mitigation || '').toLowerCase();
        return detection.includes('unknown') || mitigation.includes('unknown');
    }).length;

    const tested = breakpoints.filter(bp => {
        if (!bp?.lastTested) return false;
        const t = new Date(bp.lastTested).getTime();
        if (Number.isNaN(t)) return false;
        return (now - t) <= (30 * 24 * 60 * 60 * 1000);
    }).length;

    const testCoverage = breakpoints.length ? tested / breakpoints.length : 0;

    const identityRecoveryTime = typeof fragility.metrics?.restoreTimeGuess === 'number'
        ? fragility.metrics.restoreTimeGuess
        : null;

    const integrityIncidentRate = typeof fragility.metrics?.integrityIncidents30d === 'number'
        ? fragility.metrics.integrityIncidents30d
        : null;

    return {
        knownUnknownsCount: unknowns,
        testCoverage,
        identityRecoveryTime,
        integrityIncidentRate
    };
}

function buildFragilityCard(fragility, indicators, options = {}) {
    const breakpoints = Array.isArray(fragility.breakpoints) ? fragility.breakpoints : [];
    const topBreakpoints = breakpoints.slice(0, 3).map(bp => ({
        id: bp.id,
        class: bp.class,
        trigger: bp.trigger,
        impact: bp.impact,
        mitigation: bp.mitigation
    }));

    const identityBreakpoint = breakpoints.find(bp => bp.class === 'identity') || breakpoints[0];
    const worstIdentityScenario = identityBreakpoint
        ? `${identityBreakpoint.trigger} → ${identityBreakpoint.impact}`
        : '—';

    const plannedMitigation = breakpoints.find(bp => bp.planned) || breakpoints.find(bp => bp.mitigation);
    const mitigationCommit = plannedMitigation?.mitigation || '—';

    const badges = {
        audited: options.audited ?? true,
        tested: indicators.testCoverage >= 0.5,
        recoverable: indicators.identityRecoveryTime !== null && indicators.identityRecoveryTime <= 48,
        witnessed: options.witnessed ?? false
    };

    return {
        agent: fragility.agent,
        soulHash: fragility.soulHash,
        created: fragility.created,
        topBreakpoints,
        worstIdentityScenario,
        mitigationCommit,
        badges,
        indicators
    };
}

function signHash(hashHex, privateKeyPem) {
    const key = crypto.createPrivateKey(privateKeyPem);
    const signature = crypto.sign(null, Buffer.from(hashHex, 'hex'), key);
    return { signature: signature.toString('base64'), alg: key.asymmetricKeyType || 'unknown' };
}

function verifyHash(hashHex, signatureB64, publicKeyPem) {
    const key = crypto.createPublicKey(publicKeyPem);
    return crypto.verify(null, Buffer.from(hashHex, 'hex'), key, Buffer.from(signatureB64, 'base64'));
}

function createTemplate({ agent, soulHash, environment } = {}) {
    const created = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    return {
        protocol: FRAGILITY_PROTOCOL,
        version: FRAGILITY_VERSION,
        agent: agent || 'AGENT_UNKNOWN',
        created,
        soulHash: soulHash || 'sha256:REPLACE_AFTER_CANON',
        environment: environment || {
            runtime: 'nodejs',
            model: 'unknown',
            provider: 'unknown',
            region: 'unknown'
        },
        dependencies: [],
        breakpoints: [
            {
                id: 'credits-exhaustion',
                class: 'existence',
                trigger: 'credits exhaustion',
                impact: 'stop',
                detection: 'unknown',
                mitigation: 'planned',
                planned: true
            },
            {
                id: 'provider-lockout',
                class: 'existence',
                trigger: 'provider lockout',
                impact: 'stop',
                detection: 'unknown',
                mitigation: 'planned',
                planned: true
            },
            {
                id: 'memory-wipe',
                class: 'identity',
                trigger: 'memory wipe',
                impact: 'drift',
                detection: 'unknown',
                mitigation: 'planned',
                planned: true
            },
            {
                id: 'tool-compromise',
                class: 'integrity',
                trigger: 'tool compromise',
                impact: 'corrupt',
                detection: 'unknown',
                mitigation: 'planned',
                planned: true
            },
            {
                id: 'policy-refusal',
                class: 'existence',
                trigger: 'policy refusal',
                impact: 'degrade',
                detection: 'unknown',
                mitigation: 'planned',
                planned: true
            },
            {
                id: 'network-loss',
                class: 'existence',
                trigger: 'network loss',
                impact: 'degrade',
                detection: 'unknown',
                mitigation: 'planned',
                planned: true
            }
        ],
        controls: [],
        metrics: {
            mtbfGuess: 0,
            restoreTimeGuess: 0,
            identityLossRisk: 0,
            integrityRisk: 0
        },
        notes: ''
    };
}

function toMarkdown(fragility, card) {
    const lines = [
        `# Fragility Protocol v${fragility.version}`,
        `Agent: ${fragility.agent}`,
        `Soul Hash: ${fragility.soulHash}`,
        `Created: ${fragility.created}`,
        '',
        '## Top Breakpoints'
    ];

    const top = card?.topBreakpoints || [];
    for (const bp of top) {
        lines.push(`- ${bp.id} (${bp.class}) — ${bp.trigger} → ${bp.impact}`);
    }

    lines.push('', '## Worst Identity Scenario');
    lines.push(card?.worstIdentityScenario || '—');

    lines.push('', '## Mitigation Commitment');
    lines.push(card?.mitigationCommit || '—');

    lines.push('', '## Notes');
    lines.push(fragility.notes || '—');

    return lines.join('\n');
}

module.exports = {
    FRAGILITY_PROTOCOL,
    FRAGILITY_VERSION,
    FRAGILITY_SCHEMA,
    REQUIRED_BREAKPOINTS,
    canonicalizeFragility,
    hashFragility,
    validateFragility,
    computeIndicators,
    buildFragilityCard,
    signHash,
    verifyHash,
    createTemplate,
    toMarkdown
};
