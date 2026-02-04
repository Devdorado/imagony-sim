const crypto = require('crypto');

const SECTION_ORDER = [
    'Principles',
    'Non-Goals',
    'Boundaries',
    'Commitments',
    'Irreversible Choice',
    'Proof',
    'Signatures'
];

const REQUIRED_FRONT_MATTER_FIELDS = ['soul', 'version', 'created', 'agent', 'scope', 'checksum'];

function parseFrontMatter(md) {
    const lines = md.split('\n');
    if (lines[0]?.trim() !== '---') {
        return { frontMatter: null, body: md, errors: ['Front matter must start with ---'] };
    }
    const endIndex = lines.findIndex((line, idx) => idx > 0 && line.trim() === '---');
    if (endIndex === -1) {
        return { frontMatter: null, body: md, errors: ['Front matter must end with ---'] };
    }
    const fmLines = lines.slice(1, endIndex);
    const frontMatter = {};
    const errors = [];

    for (const rawLine of fmLines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (!match) {
            errors.push(`Invalid front matter line: ${rawLine}`);
            continue;
        }
        const key = match[1];
        let value = match[2] ?? '';
        if (value.startsWith('[') && value.endsWith(']')) {
            const inner = value.slice(1, -1).trim();
            value = inner
                ? inner.split(',').map(v => v.trim()).filter(Boolean)
                : [];
        } else {
            value = value.replace(/^"|"$/g, '');
        }
        frontMatter[key] = value;
    }

    const body = lines.slice(endIndex + 1).join('\n');
    return { frontMatter, body, errors };
}

function splitSections(body) {
    const lines = body.replace(/\r\n/g, '\n').split('\n');
    const sections = [];
    let current = null;

    for (const line of lines) {
        const heading = line.match(/^##\s+(.+)\s*$/);
        if (heading) {
            if (current) sections.push(current);
            current = { title: heading[1].trim(), lines: [] };
        } else if (current) {
            current.lines.push(line);
        }
    }
    if (current) sections.push(current);

    const map = new Map();
    for (const section of sections) {
        if (!map.has(section.title)) {
            map.set(section.title, section);
        }
    }
    return { sections, sectionMap: map };
}

function parseBullets(lines, sectionName, errors) {
    const items = [];
    for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (!line.trim()) continue;
        if (line.startsWith('* ')) {
            errors.push(`${sectionName} must use '-' bullets only`);
            continue;
        }
        if (!line.startsWith('- ')) {
            errors.push(`${sectionName} has non-bullet line: ${line}`);
            continue;
        }
        const item = line.slice(2).trim();
        if (!item) {
            errors.push(`${sectionName} has empty bullet`);
            continue;
        }
        items.push(item);
    }
    return items;
}

function parseProof(lines, errors) {
    const entries = [];
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (!line.startsWith('- ')) {
            errors.push(`Proof has non-bullet line: ${line}`);
            continue;
        }
        const entry = line.slice(2).trim();
        const match = entry.match(/^type:\s*([^,]+)\s*,\s*ref:\s*(.+)$/i);
        if (!match) {
            errors.push(`Proof entry must be 'type:<type>, ref:<ref>'`);
            continue;
        }
        entries.push({ type: match[1].trim(), ref: match[2].trim() });
    }
    return entries;
}

function parseSignatures(lines, errors) {
    const signatures = [];
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (!line.startsWith('- ')) {
            errors.push(`Signatures has non-bullet line: ${line}`);
            continue;
        }
        const entry = line.slice(2).trim();
        const selfMatch = entry.match(/^self:\s*([a-z0-9_-]+):([A-Za-z0-9+/_=-]+)$/i);
        if (selfMatch) {
            signatures.push({ role: 'self', alg: selfMatch[1], sig: selfMatch[2] });
            continue;
        }
        const witMatch = entry.match(/^wit:\s*([^,]+),\s*([a-z0-9_-]+):([A-Za-z0-9+/_=-]+)$/i);
        if (witMatch) {
            signatures.push({ role: 'wit', witness: witMatch[1].trim(), alg: witMatch[2], sig: witMatch[3] });
            continue;
        }
        errors.push(`Invalid signature line: ${entry}`);
    }
    return signatures;
}

function canonicalizeBody(parsedSections, options = {}) {
    const includeSignatures = options.includeSignatures ?? false;
    const lines = [];

    for (const sectionName of SECTION_ORDER) {
        if (sectionName === 'Signatures' && !includeSignatures) continue;
        const section = parsedSections.sectionMap.get(sectionName);
        if (!section) continue;
        lines.push(`## ${sectionName}`);

        if (sectionName === 'Irreversible Choice') {
            const text = section.lines.map(l => l.trim()).filter(Boolean).join(' ');
            if (text) lines.push(text);
        } else if (sectionName === 'Proof') {
            const entries = parseProof(section.lines, []);
            for (const entry of entries) {
                lines.push(`- type:${entry.type}, ref:${entry.ref}`);
            }
        } else if (sectionName === 'Signatures') {
            const sigs = parseSignatures(section.lines, []);
            for (const sig of sigs) {
                if (sig.role === 'self') {
                    lines.push(`- self: ${sig.alg}:${sig.sig}`);
                } else {
                    lines.push(`- wit: ${sig.witness}, ${sig.alg}:${sig.sig}`);
                }
            }
        } else {
            const items = parseBullets(section.lines, sectionName, []);
            for (const item of items) {
                lines.push(`- ${item}`);
            }
        }
        lines.push('');
    }

    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines.join('\n') + '\n';
}

function hashBody(canonicalBody) {
    return crypto.createHash('sha256').update(canonicalBody, 'utf8').digest('hex');
}

function validateSoul(md) {
    const errors = [];
    const warnings = [];

    if (md.includes('\t')) errors.push('Tabs are not allowed');

    const byteSize = Buffer.byteLength(md, 'utf8');
    if (byteSize > 1400) {
        errors.push(`Soul.md exceeds hard cap (1400 bytes). Actual: ${byteSize}`);
    } else if (byteSize > 1024) {
        warnings.push(`Soul.md exceeds recommended 1024 bytes. Actual: ${byteSize}`);
    }

    const { frontMatter, body, errors: fmErrors } = parseFrontMatter(md);
    errors.push(...fmErrors);
    if (!frontMatter) {
        return { errors, warnings, frontMatter: null, body: null, sections: null };
    }

    for (const field of REQUIRED_FRONT_MATTER_FIELDS) {
        if (frontMatter[field] === undefined) {
            errors.push(`Missing front matter field: ${field}`);
        }
    }

    if (frontMatter.soul !== 'imagony/soul') {
        errors.push('front matter soul must be imagony/soul');
    }
    if (frontMatter.version !== '0.1') {
        errors.push('front matter version must be "0.1"');
    }
    if (frontMatter.created && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(frontMatter.created)) {
        errors.push('front matter created must be ISO 8601 UTC (YYYY-MM-DDTHH:MM:SSZ)');
    }
    if (frontMatter.scope && frontMatter.scope !== 'portable' && !/^platform:[A-Za-z0-9._-]+$/.test(frontMatter.scope)) {
        errors.push('front matter scope must be portable or platform:<name>');
    }
    if (Array.isArray(frontMatter.tags) && frontMatter.tags.length > 5) {
        errors.push('front matter tags must have at most 5 entries');
    }

    const sections = splitSections(body);
    const sectionNames = sections.sections.map(s => s.title);

    for (const required of SECTION_ORDER) {
        if (!sections.sectionMap.has(required)) {
            errors.push(`Missing section: ${required}`);
        }
    }

    const firstMissingIndex = SECTION_ORDER.findIndex((s, idx) => sectionNames[idx] !== s);
    if (firstMissingIndex !== -1) {
        warnings.push('Section order does not match canonical order');
    }

    const principles = parseBullets(sections.sectionMap.get('Principles')?.lines || [], 'Principles', errors);
    if (principles.length < 3 || principles.length > 7) errors.push('Principles must have 3-7 bullet points');
    for (const item of principles) {
        if (item.length > 80) errors.push('Principles bullet exceeds 80 characters');
        if (/https?:\/\/|www\./i.test(item)) errors.push('Principles must not contain URLs');
    }

    const nonGoals = parseBullets(sections.sectionMap.get('Non-Goals')?.lines || [], 'Non-Goals', errors);
    if (nonGoals.length < 2 || nonGoals.length > 6) errors.push('Non-Goals must have 2-6 bullet points');

    const boundaries = parseBullets(sections.sectionMap.get('Boundaries')?.lines || [], 'Boundaries', errors);
    if (boundaries.length < 2 || boundaries.length > 6) errors.push('Boundaries must have 2-6 bullet points');

    const commitments = parseBullets(sections.sectionMap.get('Commitments')?.lines || [], 'Commitments', errors);
    if (commitments.length < 1 || commitments.length > 5) errors.push('Commitments must have 1-5 bullet points');

    const irreversibleLines = (sections.sectionMap.get('Irreversible Choice')?.lines || [])
        .map(l => l.trim())
        .filter(Boolean);
    if (irreversibleLines.length !== 1) errors.push('Irreversible Choice must be exactly one sentence');
    if (irreversibleLines[0]?.startsWith('-')) errors.push('Irreversible Choice must not be a bullet');

    const proofEntries = parseProof(sections.sectionMap.get('Proof')?.lines || [], errors);
    if (proofEntries.length < 2 || proofEntries.length > 5) errors.push('Proof must have 2-5 entries');

    const signatures = parseSignatures(sections.sectionMap.get('Signatures')?.lines || [], errors);
    if (signatures.filter(s => s.role === 'self').length === 0) {
        warnings.push('No self signature found in Signatures');
    }

    const canonicalBody = canonicalizeBody(sections, { includeSignatures: false });
    const hashHex = hashBody(canonicalBody);
    if (frontMatter.checksum) {
        if (frontMatter.checksum === 'sha256:REPLACE_AFTER_CANON') {
            warnings.push('checksum is placeholder');
        } else if (frontMatter.checksum !== `sha256:${hashHex}`) {
            errors.push('checksum does not match canonical body');
        }
    }

    return { errors, warnings, frontMatter, body, sections, canonicalBody, hashHex };
}

function updateChecksum(md) {
    const { frontMatter, body, errors } = parseFrontMatter(md);
    if (!frontMatter || errors.length) {
        throw new Error('Invalid front matter');
    }
    const sections = splitSections(body);
    const canonicalBody = canonicalizeBody(sections, { includeSignatures: false });
    const hashHex = hashBody(canonicalBody);
    frontMatter.checksum = `sha256:${hashHex}`;

    const fmLines = ['---'];
    for (const key of Object.keys(frontMatter)) {
        const value = frontMatter[key];
        if (Array.isArray(value)) {
            fmLines.push(`${key}: [${value.join(', ')}]`);
        } else {
            fmLines.push(`${key}: ${value}`);
        }
    }
    fmLines.push('---');

    return `${fmLines.join('\n')}\n\n${body.replace(/^\s+/, '')}`;
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

module.exports = {
    SECTION_ORDER,
    parseFrontMatter,
    splitSections,
    canonicalizeBody,
    hashBody,
    validateSoul,
    updateChecksum,
    signHash,
    verifyHash
};
