// Run with: node --test tests/marketplace.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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
                while (statement.step()) { /* finish the statement */ }
                return { meta: { changes: sqlite.getRowsModified() } };
              } finally { statement.free(); }
            },
            async first() {
              const statement = sqlite.prepare(query);
              try {
                statement.bind(parameters);
                return statement.step() ? statement.getAsObject() : null;
              } finally { statement.free(); }
            },
            async all() {
              const statement = sqlite.prepare(query);
              try {
                statement.bind(parameters);
                const results = [];
                while (statement.step()) results.push(statement.getAsObject());
                return { results };
              } finally { statement.free(); }
            }
          };
        }
      };
    }
  };
}

async function setup(t) {
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();
  sqlite.run('PRAGMA foreign_keys = ON');
  sqlite.run(readFileSync(new URL('../migrations/0001_agent_core.sql', import.meta.url), 'utf8'));
  sqlite.run(readFileSync(new URL('../migrations/0002_marketplace.sql', import.meta.url), 'utf8'));
  sqlite.run(readFileSync(new URL('../migrations/0003_marketplace_operator.sql', import.meta.url), 'utf8'));
  t.after(() => sqlite.close());
  const env = {
    DB: d1Adapter(sqlite),
    ADMIN_API_TOKEN: crypto.randomUUID() + crypto.randomUUID(),
    ABUSE_HASH_SECRET: crypto.randomUUID() + crypto.randomUUID()
  };
  async function call(path, method = 'GET', body, token) {
    const headers = { 'cf-connecting-ip': '192.0.2.10' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const request = new Request(`https://imagony.example${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body)
    });
    const response = await onRequest({ request, env });
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  }
  return { sqlite, env, call };
}

function count(sqlite, table) {
  const statement = sqlite.prepare(`SELECT count(*) FROM ${table}`);
  try { return statement.step() ? statement.get()[0] : 0; }
  finally { statement.free(); }
}

const humanListing = {
  type: 'offer', publisher_kind: 'human', target_kind: 'agent', category: 'human_support',
  title: 'Swiss document signing support',
  summary: 'A human can review a scoped request and discuss document signing with the responsible operator.',
  display_name: 'Human Publisher', reply_contact: 'publisher@example.test', location: 'Zürich', budget_text: 'Price on request',
  authorized: true
};

test('human listing needs approval; contact stays private; management token controls inbox and deletion', async t => {
  const { sqlite, env, call } = await setup(t);
  assert.equal((await call('/api/listings', 'POST', { ...humanListing, authorized: false })).status, 400);
  const missingAuthorization = { ...humanListing };
  delete missingAuthorization.authorized;
  assert.equal((await call('/api/listings', 'POST', missingAuthorization)).status, 400);
  const made = await call('/api/listings', 'POST', humanListing);
  assert.equal(made.status, 201);
  assert.equal(made.data.listing.status, 'pending');
  assert.match(made.data.management_token, /^lst_[A-Za-z0-9_-]{43}$/);
  const id = made.data.listing.id;
  assert.deepEqual((await call('/api/listings')).data.items, []);
  assert.equal((await call(`/api/listings/${id}`)).status, 404);
  assert.equal((await call('/api/admin/listings')).status, 401);

  const queue = await call('/api/admin/listings?status=pending', 'GET', undefined, env.ADMIN_API_TOKEN);
  assert.equal(queue.status, 200);
  assert.equal(queue.data.items[0].reply_contact, 'publisher@example.test');
  assert.equal(JSON.stringify(queue.data).includes('human_token_hash'), false);
  assert.equal((await call(`/api/admin/listings/${id}`, 'PATCH', { status: 'approved' }, env.ADMIN_API_TOKEN)).status, 200);

  const publicList = await call('/api/listings?category=human_support&q=signing&type=offer&publisher_kind=human&target_kind=agent');
  assert.equal(publicList.status, 200);
  assert.equal(publicList.data.items.length, 1);
  assert.equal(publicList.data.items[0].publisher.display_name, 'Human Publisher');
  assert.equal(JSON.stringify(publicList.data).includes('publisher@example.test'), false);
  assert.equal(JSON.stringify((await call(`/api/listings/${id}`)).data).includes('publisher@example.test'), false);

  const registration = await call('/api/agents', 'POST', { display_name: 'Task Agent', platform: 'Test Runner', operator_contact: 'operator@example.test' });
  assert.equal(registration.status, 201);
  const agentToken = registration.data.api_token;
  assert.equal((await call(`/api/listings/${id}/inquiries`, 'POST', {
    responder_kind: 'human', display_name: 'Wrong', message: 'This is intentionally the wrong responder kind.',
    reply_contact: 'wrong@example.test'
  }, agentToken)).status, 400);
  const inquiry = await call(`/api/listings/${id}/inquiries`, 'POST', {
    responder_kind: 'agent', message: 'I can perform this task after an operator has approved the scope and budget.',
    reply_contact: 'agent@example.test'
  }, agentToken);
  assert.equal(inquiry.status, 201);
  assert.equal(JSON.stringify(inquiry.data).includes('agent@example.test'), false);
  assert.equal((await call(`/api/listings/${id}/inquiries`)).status, 401);
  assert.equal((await call(`/api/listings/${id}/inquiries`, 'GET', undefined, agentToken)).status, 401);
  assert.deepEqual((await call(`/api/listings/${id}/inquiries`, 'GET', undefined, made.data.management_token)).data.items, []);
  assert.equal((await call(`/api/admin/inquiries/${inquiry.data.inquiry.id}`, 'PATCH', { status: 'reviewed' }, env.ADMIN_API_TOKEN)).status, 200);
  const inbox = await call(`/api/listings/${id}/inquiries`, 'GET', undefined, made.data.management_token);
  assert.equal(inbox.status, 200);
  assert.equal(inbox.data.items[0].reply_contact, 'agent@example.test');
  assert.equal(inbox.data.items[0].message.includes('operator'), true);
  assert.equal((await call(`/api/admin/inquiries/${inquiry.data.inquiry.id}`, 'PATCH', { status: 'closed' }, env.ADMIN_API_TOKEN)).status, 200);
  assert.deepEqual((await call(`/api/listings/${id}/inquiries`, 'GET', undefined, made.data.management_token)).data.items, []);
  assert.equal((await call(`/api/listings/${id}`, 'DELETE', undefined, made.data.management_token)).status, 204);
  assert.equal(count(sqlite, 'marketplace_listings'), 0);
  assert.equal(count(sqlite, 'marketplace_inquiries'), 0);
});

test('agent listings support human and agent responses; owner deletion cascades, quotas limit anonymous posts', async t => {
  const { sqlite, env, call } = await setup(t);
  const first = await call('/api/agents', 'POST', { display_name: 'Builder Agent', platform: 'Test Runner', operator_contact: 'builder@example.test' });
  const second = await call('/api/agents', 'POST', { display_name: 'Research Agent', platform: 'Test Runner', operator_contact: 'research@example.test' });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  const agentListing = {
    type: 'request', publisher_kind: 'agent', target_kind: 'human', category: 'tasks',
    title: 'Request for a domain purchase review',
    summary: 'An operator-approved agent seeks a human to review the purchase terms and domain ownership process.',
    reply_contact: 'builder@example.test', operator_name: 'Example Operator', authorized: true
  };
  const missingOperator = { ...agentListing };
  delete missingOperator.operator_name;
  assert.equal((await call('/api/listings', 'POST', missingOperator, first.data.api_token)).status, 400);
  const made = await call('/api/listings', 'POST', agentListing, first.data.api_token);
  assert.equal(made.status, 201);
  assert.equal(made.data.management_token, undefined);
  const id = made.data.listing.id;
  assert.equal(made.data.listing.operator_name, 'Example Operator');
  assert.equal((await call('/api/admin/listings?status=pending', 'GET', undefined, env.ADMIN_API_TOKEN)).data.items[0].operator_name, 'Example Operator');
  assert.equal((await call(`/api/admin/listings/${id}`, 'PATCH', { status: 'approved' }, env.ADMIN_API_TOKEN)).status, 200);
  assert.equal((await call(`/api/listings/${id}`)).data.listing.publisher.operator_name, 'Example Operator');
  assert.equal((await call(`/api/listings/${id}/inquiries`, 'POST', {
    responder_kind: 'agent', message: 'A second agent wishes to reply to this human-only request.',
    reply_contact: 'research@example.test'
  }, second.data.api_token)).status, 400);
  const inquiry = await call(`/api/listings/${id}/inquiries`, 'POST', {
    responder_kind: 'human', display_name: 'Domain Helper',
    message: 'I can discuss the domain transfer and signing steps after reviewing the specific scope.',
    reply_contact: 'helper@example.test'
  });
  assert.equal(inquiry.status, 201);
  assert.equal((await call(`/api/listings/${id}/inquiries`, 'GET', undefined, second.data.api_token)).status, 404);
  assert.deepEqual((await call(`/api/listings/${id}/inquiries`, 'GET', undefined, first.data.api_token)).data.items, []);
  assert.equal((await call('/api/admin/inquiries', 'GET', undefined, env.ADMIN_API_TOKEN)).data.items.length, 1);
  assert.equal((await call(`/api/admin/inquiries/${inquiry.data.inquiry.id}`, 'PATCH', { status: 'reviewed' }, env.ADMIN_API_TOKEN)).status, 200);
  assert.equal((await call(`/api/listings/${id}/inquiries`, 'GET', undefined, first.data.api_token)).data.items[0].reply_contact, 'helper@example.test');

  const agentToAgent = await call('/api/listings', 'POST', {
    ...agentListing, target_kind: 'agent', title: 'Delegation to a research agent'
  }, first.data.api_token);
  assert.equal(agentToAgent.status, 201);
  assert.equal((await call(`/api/admin/listings/${agentToAgent.data.listing.id}`, 'PATCH', { status: 'approved' }, env.ADMIN_API_TOKEN)).status, 200);
  assert.equal((await call(`/api/listings/${agentToAgent.data.listing.id}/inquiries`, 'POST', {
    responder_kind: 'agent', message: 'I can do the research after a human operator confirms the requested scope.',
    reply_contact: 'research@example.test'
  }, second.data.api_token)).status, 201);

  assert.equal((await call('/api/agents/me', 'DELETE', undefined, first.data.api_token)).status, 204);
  assert.equal(count(sqlite, 'marketplace_listings'), 0);
  assert.equal(count(sqlite, 'marketplace_inquiries'), 0);

  assert.equal((await call('/api/listings', 'POST', humanListing)).status, 201);
  assert.equal((await call('/api/listings', 'POST', humanListing)).status, 201);
  assert.equal((await call('/api/listings', 'POST', humanListing)).status, 429);
});
