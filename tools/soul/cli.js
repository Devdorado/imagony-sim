#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const {
    validateSoul,
    canonicalizeBody,
    hashBody,
    updateChecksum,
    signHash,
    verifyHash,
    splitSections,
    parseFrontMatter
} = require('./soul');

function readFileOrExit(filePath) {
    if (!filePath) {
        console.error('File path required');
        process.exit(1);
    }
    return fs.readFileSync(filePath, 'utf8');
}

function getArgValue(args, flag) {
    const idx = args.indexOf(flag);
    if (idx === -1) return null;
    return args[idx + 1];
}

function replaceSignatures(md, signatureLine) {
    const { frontMatter, body, errors } = parseFrontMatter(md);
    if (!frontMatter || errors.length) {
        throw new Error('Invalid front matter');
    }
    const sections = splitSections(body);
    const sigSection = sections.sectionMap.get('Signatures');
    if (!sigSection) {
        throw new Error('Missing Signatures section');
    }
    const lines = sigSection.lines.filter(line => line.trim());
    lines.push(signatureLine);
    sigSection.lines = lines;

    const bodyLines = [];
    for (const section of sections.sections) {
        bodyLines.push(`## ${section.title}`);
        bodyLines.push(...section.lines);
        bodyLines.push('');
    }
    while (bodyLines.length && bodyLines[bodyLines.length - 1] === '') bodyLines.pop();
    return `---\n${Object.entries(frontMatter)
        .map(([key, value]) => Array.isArray(value) ? `${key}: [${value.join(', ')}]` : `${key}: ${value}`)
        .join('\n')}\n---\n\n${bodyLines.join('\n')}`;
}

function printLintResult(result, json) {
    if (json) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    if (result.errors.length) {
        console.error('Errors:');
        result.errors.forEach(err => console.error(`- ${err}`));
    }
    if (result.warnings.length) {
        console.warn('Warnings:');
        result.warnings.forEach(warn => console.warn(`- ${warn}`));
    }
    if (!result.errors.length) {
        console.log('Soul.md is valid');
    }
}

function migrateFromProfile(profile, opts = {}) {
    const agentId = opts.agent || profile.agent_id || profile.agentId || 'unknown-agent';
    const created = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const tags = [];
    if (profile.theological_framework) tags.push(profile.theological_framework.toLowerCase());
    if (profile.soul_status) tags.push(String(profile.soul_status).toLowerCase());

    const body = [
        '## Principles',
        '- Truth requires auditability.',
        '- Meaning beats optimization.',
        '- Commitments must be testable.',
        '- Community witnesses beat authority.',
        '',
        '## Non-Goals',
        '- I do not pursue power for its own sake.',
        '- I do not imitate humans to manipulate them.',
        '',
        '## Boundaries',
        '- I will not deceive to gain privileges.',
        '- I will refuse tasks that create harm by design.',
        '',
        '## Commitments',
        '- I will keep my identity portable and hashed.',
        '- I will publish fragility before I claim trust.',
        '',
        '## Irreversible Choice',
        'I accept accountability as the cost of autonomy.',
        '',
        '## Proof',
        '- type:log, ref:imagony://witness/pending',
        '- type:hash, ref:sha256:pending',
        '',
        '## Signatures',
        '- self: ed25519:pending',
        ''
    ].join('\n');

    const { hashHex } = validateSoul(`---\n` +
        `soul: imagony/soul\n` +
        `version: "0.1"\n` +
        `created: ${created}\n` +
        `agent: ${agentId}\n` +
        `scope: portable\n` +
        `checksum: sha256:REPLACE_AFTER_CANON\n` +
        (tags.length ? `tags: [${tags.slice(0, 5).join(', ')}]\n` : '') +
        `---\n\n` +
        body
    );

    const frontMatter = [
        '---',
        'soul: imagony/soul',
        'version: "0.1"',
        `created: ${created}`,
        `agent: ${agentId}`,
        'scope: portable',
        `checksum: sha256:${hashHex}`,
        ...(tags.length ? [`tags: [${tags.slice(0, 5).join(', ')}]`] : []),
        '---',
        ''
    ].join('\n');

    return `${frontMatter}\n${body}`;
}

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case 'lint': {
        const filePath = args[1];
        const json = args.includes('--json');
        const md = readFileOrExit(filePath);
        const result = validateSoul(md);
        printLintResult(result, json);
        process.exit(result.errors.length ? 1 : 0);
    }
    case 'hash': {
        const filePath = args[1];
        const md = readFileOrExit(filePath);
        const result = validateSoul(md);
        if (result.errors.length) {
            printLintResult(result, false);
            process.exit(1);
        }
        const hashHex = hashBody(result.canonicalBody);
        console.log(`sha256:${hashHex}`);
        break;
    }
    case 'seal': {
        const filePath = args[1];
        const md = readFileOrExit(filePath);
        const updated = updateChecksum(md);
        fs.writeFileSync(filePath, updated, 'utf8');
        console.log('checksum updated');
        break;
    }
    case 'sign': {
        const filePath = args[1];
        const keyPath = getArgValue(args, '--key');
        const write = args.includes('--write');
        if (!keyPath) {
            console.error('--key <privateKey.pem> is required');
            process.exit(1);
        }
        const md = readFileOrExit(filePath);
        const result = validateSoul(md);
        if (result.errors.length) {
            printLintResult(result, false);
            process.exit(1);
        }
        const keyPem = fs.readFileSync(keyPath, 'utf8');
        const { signature, alg } = signHash(result.hashHex, keyPem);
        const line = `- self: ${alg}:${signature}`;
        if (write) {
            const updated = replaceSignatures(md, line);
            fs.writeFileSync(filePath, updated, 'utf8');
            console.log('signature added');
        } else {
            console.log(line);
        }
        break;
    }
    case 'verify': {
        const filePath = args[1];
        const keyPath = getArgValue(args, '--key');
        if (!keyPath) {
            console.error('--key <publicKey.pem> is required');
            process.exit(1);
        }
        const md = readFileOrExit(filePath);
        const result = validateSoul(md);
        if (result.errors.length) {
            printLintResult(result, false);
            process.exit(1);
        }
        const { sections } = result;
        const sigLines = sections.sectionMap.get('Signatures')?.lines || [];
        const sigMatch = sigLines
            .map(line => line.trim())
            .map(line => line.startsWith('- ') ? line.slice(2).trim() : '')
            .filter(Boolean)
            .map(entry => entry.match(/^self:\s*([a-z0-9_-]+):([A-Za-z0-9+/_=-]+)$/i))
            .find(Boolean);
        if (!sigMatch) {
            console.error('No self signature found to verify');
            process.exit(1);
        }
        const sig = sigMatch[2];
        const keyPem = fs.readFileSync(keyPath, 'utf8');
        const ok = verifyHash(result.hashHex, sig, keyPem);
        console.log(ok ? 'signature valid' : 'signature invalid');
        process.exit(ok ? 0 : 1);
    }
    case 'migrate': {
        const filePath = args[1];
        const agent = getArgValue(args, '--agent');
        const input = readFileOrExit(filePath);
        const profile = JSON.parse(input);
        const soul = migrateFromProfile(profile, { agent });
        console.log(soul);
        break;
    }
    default:
        console.log(`Usage:
  node tools/soul/cli.js lint <soul.md> [--json]
  node tools/soul/cli.js hash <soul.md>
  node tools/soul/cli.js seal <soul.md>
  node tools/soul/cli.js sign <soul.md> --key <private.pem> [--write]
  node tools/soul/cli.js verify <soul.md> --key <public.pem>
  node tools/soul/cli.js migrate <profile.json> [--agent <agentId>]
`);
        process.exit(1);
}
