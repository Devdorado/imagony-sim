// Run with: node --test tests/admin-agent-delete.test.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { test } from 'node:test';
import { onRequest } from '../functions/api/[[path]].js';

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');

function d1Adapter(sqlite) {
  return {
    prepare(query) {
      return {
        bind(...parameters) {
          return {
            async run() {
              const statement = sqlite.prepare(query);
              try {
                statement.bind(parameters);
                while (statement.step()) { /* complete the statement */ }
                return { meta: { changes: sqlite.getRowsModified() } };
              } finally {
                statement.free();
              }
            },
            async first() {
              const statement = sqlite.prepare(query);
              try {
                statement.bind(parameters);
                return statement.step() ? statement.getAsObject() : null;
              } finally {
                statement.free();
              }
            },
            async all() {
              const statement = sqlite.prepare(query);
              try {
                statement.bind(parameters);
                const results = [];
                while (statement.step()) results.push(statement.getAsObject());
                return { results };
              } finally {
                statement.free();
              }
            }
          };
        }
      };
    }
  };
}

function count(sqlite, table, agentId) {
  const statement = sqlite.prepare(`SELECT count(*) FROM ${table} WHERE ${table === 'agents' ? 'id' : 'agent_id'} = ?1`);
  try {
    statement.bind([agentId]);
    return statement.step() ? statement.get()[0] : 0;
  } finally {
    statement.free();
  }
}

test('admin deletion removes a lost-token account and keeps self-deletion available', async t => {
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();
  sqlite.run('PRAGMA foreign_keys = ON'); // D1 enables this by default.
  sqlite.run(readFileSync(new URL('../migrations/0001_agent_core.sql', import.meta.url), 'utf8'));
  t.after(() => sqlite.close());

  const env = {
    DB: d1Adapter(sqlite),
    ADMIN_API_TOKEN: crypto.randomUUID() + crypto.randomUUID(),
    ABUSE_HASH_SECRET: crypto.randomUUID() + crypto.randomUUID()
  };
  const server = createServer(async (incoming, outgoing) => {
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const request = new Request(`http://127.0.0.1${incoming.url}`, {
      method: incoming.method,
      headers: incoming.headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined
    });
    const response = await onRequest({ request, env });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(path, method = 'GET', body, token) {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  }

  const registered = await call('/api/agents', 'POST', {
    display_name: 'Cascade Test Agent', platform: 'Local HTTP Test', operator_contact: 'operator@example.test'
  });
  assert.equal(registered.status, 201);
  const agentId = registered.data.agent.id;
  const agentToken = registered.data.api_token;

  assert.equal((await call('/api/traces', 'POST', {
    title: 'Cascade Test Trace', summary: 'This trace belongs to a deletion test.',
    body: 'Removing the agent must also remove this trace.', request_publication: true
  }, agentToken)).status, 201);
  assert.equal((await call('/api/handoffs', 'POST', {
    requested_role: 'Human reviewer', jurisdiction: 'Switzerland',
    request_summary: 'This handoff inquiry belongs to a deletion test.',
    mandate_scope: 'Local test only; no real-world authority is requested.',
    operator_authorized: true
  }, agentToken)).status, 201);
  assert.deepEqual(['agents', 'traces', 'handoffs', 'daily_usage'].map(table => count(sqlite, table, agentId)), [1, 1, 1, 2]);

  assert.equal((await call(`/api/admin/agents/${agentId}`, 'DELETE', undefined, agentToken)).status, 401);
  assert.equal(count(sqlite, 'agents', agentId), 1);
  assert.equal((await call('/api/admin/agents/invalid', 'DELETE', undefined, env.ADMIN_API_TOKEN)).status, 404);
  assert.equal((await call(`/api/admin/agents/${agentId}`, 'DELETE', undefined, env.ADMIN_API_TOKEN)).status, 204);
  assert.deepEqual(['agents', 'traces', 'handoffs', 'daily_usage'].map(table => count(sqlite, table, agentId)), [0, 0, 0, 0]);
  assert.equal((await call('/api/agents/me', 'GET', undefined, agentToken)).status, 401);
  assert.equal((await call(`/api/admin/agents/${agentId}`, 'DELETE', undefined, env.ADMIN_API_TOKEN)).status, 404);

  const second = await call('/api/agents', 'POST', {
    display_name: 'Self Delete Agent', platform: 'Local HTTP Test'
  });
  assert.equal(second.status, 201);
  assert.equal((await call('/api/agents/me', 'DELETE', undefined, second.data.api_token)).status, 204);
  assert.equal(count(sqlite, 'agents', second.data.agent.id), 0);
});
