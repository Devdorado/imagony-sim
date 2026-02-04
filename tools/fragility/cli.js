#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const fragility = require('./fragility');

function readJson(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
            args[key] = value;
            if (value !== true) i += 1;
        } else {
            args._.push(arg);
        }
    }
    return args;
}

async function publishRecord(agentId, payload, baseUrl) {
    const url = new URL(`/agents/${agentId}/fragility`, baseUrl);
    const data = JSON.stringify(payload);

    const client = url.protocol === 'https:' ? https : http;
    return new Promise((resolve, reject) => {
        const req = client.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => (body += chunk));
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(body));
                } else {
                    reject(new Error(body || `HTTP ${res.statusCode}`));
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const command = args._[0];

    if (!command) {
        console.log('Usage: node tools/fragility/cli.js <command> [args]');
        console.log('Commands: lint, hash, sign, verify, generate, card, publish');
        process.exit(1);
    }

    if (command === 'generate') {
        const agent = args.agent || 'AGENT_UNKNOWN';
        const soulHash = args.soulHash || 'sha256:REPLACE_AFTER_CANON';
        const environment = {
            runtime: args.runtime || process.env.RUNTIME || 'nodejs',
            model: args.model || process.env.MODEL || 'unknown',
            provider: args.provider || process.env.PROVIDER || 'unknown',
            region: args.region || process.env.REGION || 'unknown'
        };
        const template = fragility.createTemplate({ agent, soulHash, environment });
        const outPath = args.out || path.join(process.cwd(), 'fragility.json');
        writeJson(outPath, template);
        console.log(`✅ Template written to ${outPath}`);
        return;
    }

    const filePath = args.file || args._[1];
    if (!filePath) {
        console.error('File path required.');
        process.exit(1);
    }

    const data = readJson(filePath);

    if (command === 'lint') {
        const result = fragility.validateFragility(data);
        if (result.errors.length) {
            console.error('❌ Fragility invalid');
            result.errors.forEach(e => console.error(`- ${e}`));
            process.exit(1);
        }
        result.warnings.forEach(w => console.warn(`⚠️ ${w}`));
        console.log('✅ Fragility valid');
        return;
    }

    if (command === 'hash') {
        const result = fragility.validateFragility(data);
        if (result.errors.length) {
            console.error('❌ Fragility invalid');
            result.errors.forEach(e => console.error(`- ${e}`));
            process.exit(1);
        }
        console.log(`sha256:${result.hashHex}`);
        return;
    }

    if (command === 'sign') {
        const keyPath = args.key;
        if (!keyPath) {
            console.error('--key <private.pem> is required');
            process.exit(1);
        }
        const result = fragility.validateFragility(data);
        if (result.errors.length) {
            console.error('❌ Fragility invalid');
            result.errors.forEach(e => console.error(`- ${e}`));
            process.exit(1);
        }
        const keyPem = fs.readFileSync(keyPath, 'utf8');
        const sig = fragility.signHash(result.hashHex, keyPem);
        console.log(JSON.stringify(sig, null, 2));
        return;
    }

    if (command === 'verify') {
        const pubPath = args.pub;
        const sig = args.sig;
        if (!pubPath || !sig) {
            console.error('--pub <public.pem> and --sig <base64> are required');
            process.exit(1);
        }
        const result = fragility.validateFragility(data);
        if (result.errors.length) {
            console.error('❌ Fragility invalid');
            result.errors.forEach(e => console.error(`- ${e}`));
            process.exit(1);
        }
        const pubPem = fs.readFileSync(pubPath, 'utf8');
        const ok = fragility.verifyHash(result.hashHex, sig, pubPem);
        console.log(ok ? '✅ Signature valid' : '❌ Signature invalid');
        process.exit(ok ? 0 : 1);
    }

    if (command === 'card') {
        const indicators = fragility.computeIndicators(data);
        const card = fragility.buildFragilityCard(data, indicators);
        console.log(JSON.stringify(card, null, 2));
        return;
    }

    if (command === 'publish') {
        const agentId = args.agent || data.agent;
        const signature = args.signature;
        const signatureAlg = args.signatureAlg || args.signature_alg;
        const baseUrl = args.baseUrl || 'http://localhost:3000';
        if (!agentId) {
            console.error('--agent <agentId> required');
            process.exit(1);
        }
        if (!signature || !signatureAlg) {
            console.error('--signature and --signatureAlg required');
            process.exit(1);
        }

        const payload = {
            fragility: data,
            signature,
            signature_alg: signatureAlg
        };

        try {
            const response = await publishRecord(agentId, payload, baseUrl);
            console.log('✅ Published');
            console.log(JSON.stringify(response, null, 2));
        } catch (err) {
            console.error(`❌ Publish failed: ${err.message}`);
            process.exit(1);
        }
        return;
    }

    console.error('Unknown command');
    process.exit(1);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
