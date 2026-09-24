// Run with: node --test tests/human-desk.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { onRequest } from '../functions/api/[[path]].js';

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');

function d1Adapter(sqlite) {
  function execute(sql, parameters, mode) {
    const statement = sqlite.prepare(sql);
    try {
      statement.bind(parameters);
      const rows = [];
      while (statement.step()) rows.push(statement.getAsObject());
      if (mode === 'first') return rows[0] || null;
      if (mode === 'run') return { meta: { changes: sqlite.getRowsModified() } };
      return { results: rows, meta: { changes: sqlite.getRowsModified() } };
    } finally { statement.free(); }
  }
  return {
    prepare(sql) {
      return {
        bind(...parameters) {
          return {
            sql, parameters,
            async run() { return execute(sql, parameters, 'run'); },
            async first() { return execute(sql, parameters, 'first'); },
            async all() { return execute(sql, parameters, 'all'); }
          };
        }
      };
    },
    async batch(statements) {
      sqlite.run('BEGIN');
      try {
        const results = statements.map(statement => execute(statement.sql, statement.parameters, 'all'));
        sqlite.run('COMMIT');
        return results;
      } catch (error) {
        sqlite.run('ROLLBACK');
        throw error;
      }
    }
  };
}

async function setup(t, payrexxHosts = '') {
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();
  sqlite.run('PRAGMA foreign_keys = ON');
  for (const name of ['0001_agent_core.sql', '0002_marketplace.sql', '0003_marketplace_operator.sql', '0004_human_desk.sql']) {
    sqlite.run(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  }
  t.after(() => sqlite.close());
  const env = {
    DB: d1Adapter(sqlite),
    ADMIN_API_TOKEN: crypto.randomUUID() + crypto.randomUUID(),
    ABUSE_HASH_SECRET: crypto.randomUUID() + crypto.randomUUID(),
    PAYREXX_ALLOWED_HOSTS: payrexxHosts
  };
  async function call(path, method = 'GET', body, token) {
    const headers = { 'cf-connecting-ip': '192.0.2.20' };
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

const requestBody = {
  service_id: 'signatory', applicant_kind: 'human', operator_name: 'Example Operator',
  contact: 'operator@example.test', jurisdiction: 'Switzerland',
  mandate_scope: 'Review a specific signing task and the evidence of authority before any appointment.',
  request_summary: 'A human signatory is requested for a narrow business document workflow.',
  authorized: true, deadline: '2030-12-31', budget_text: 'Individual quote requested'
};

function quoteBody(revision, paymentDue = 'before_work') {
  return {
    scope: 'Review the provided mandate and sign one specified document after identity checks.',
    amount_minor: 12500, currency: 'CHF',
    payment_terms: 'Payment is due according to the selected timing after accepting this quote.',
    payment_due: paymentDue, valid_until: '2030-12-31', expected_revision: revision
  };
}

function count(sqlite, table) {
  const statement = sqlite.prepare(`SELECT count(*) FROM ${table}`);
  try { return statement.step() ? statement.get()[0] : 0; }
  finally { statement.free(); }
}

test('private case token, human validation, internal notes and revision conflict', async t => {
  const { sqlite, env, call } = await setup(t);
  const services = await call('/api/desk/services');
  assert.equal(services.status, 200);
  assert.deepEqual(services.data.items.map(item => item.id),
    ['signatory', 'governance', 'kyb', 'compliance', 'oversight', 'operations']);
  assert.equal((await call('/api/desk/requests', 'POST', { ...requestBody, authorized: false })).status, 400);
  assert.equal((await call('/api/desk/requests', 'POST', { ...requestBody, contact: 'https://example.test' })).status, 400);
  const created = await call('/api/desk/requests', 'POST', requestBody);
  assert.equal(created.status, 201);
  assert.match(created.data.request_token, /^hd_[A-Za-z0-9_-]{43}$/);
  assert.equal(created.data.request.status, 'new');
  assert.equal(created.data.request.revision, 0);
  assert.equal(created.data.events.length, 1);
  const id = created.data.request.id;
  assert.equal((await call(`/api/desk/requests/${id}`)).status, 401);
  assert.equal((await call(`/api/desk/requests/${id}`, 'GET', undefined, env.ADMIN_API_TOKEN)).status, 401);
  assert.equal((await call(`/api/desk/requests/${id}`, 'GET', undefined, `hd_${'A'.repeat(43)}`)).status, 404);
  const own = await call(`/api/desk/requests/${id}`, 'GET', undefined, created.data.request_token);
  assert.equal(own.status, 200);
  assert.equal(own.data.request.mandate_scope, requestBody.mandate_scope);
  assert.equal(own.data.request_token, undefined);
  assert.equal(JSON.stringify(own.data).includes('token_hash'), false);
  const other = await call('/api/desk/requests', 'POST', {
    ...requestBody, service_id: 'governance', request_summary: 'A second isolated request tests case token separation.'
  });
  assert.equal(other.status, 201);
  assert.equal((await call(`/api/desk/requests/${other.data.request.id}`, 'GET', undefined, created.data.request_token)).status, 404);
  const adminNote = await call(`/api/admin/desk/requests/${id}/messages`, 'POST', {
    body: 'Internal reviewer note, not available to requester.', visibility: 'internal', expected_revision: 0
  }, env.ADMIN_API_TOKEN);
  assert.equal(adminNote.status, 200);
  assert.equal(adminNote.data.events.at(-1).visibility, 'internal');
  const afterNote = await call(`/api/desk/requests/${id}`, 'GET', undefined, created.data.request_token);
  assert.equal(afterNote.data.events.length, 1);
  assert.equal(JSON.stringify(afterNote.data).includes('Internal reviewer note'), false);
  const message = await call(`/api/desk/requests/${id}/messages`, 'POST', {
    body: 'The scope is confirmed by the responsible operator.', expected_revision: 1
  }, created.data.request_token);
  assert.equal(message.status, 200);
  assert.equal(message.data.request.revision, 2);
  assert.equal((await call(`/api/desk/requests/${id}/messages`, 'POST', {
    body: 'A stale duplicate message must not be recorded.', expected_revision: 1
  }, created.data.request_token)).status, 409);
  assert.equal(count(sqlite, 'desk_events'), 4);
  assert.equal((await call('/api/admin/desk/requests?status=new&payment_status=none', 'GET', undefined, env.ADMIN_API_TOKEN)).data.items.length, 2);
});

test('versioned quote, named acceptance, Payrexx gate, receipt and completion', async t => {
  const { sqlite, env, call } = await setup(t, 'checkout.example.test');
  const created = await call('/api/desk/requests', 'POST', requestBody);
  const id = created.data.request.id;
  const token = created.data.request_token;
  const admin = env.ADMIN_API_TOKEN;
  const base = `/api/admin/desk/requests/${id}`;
  assert.equal((await call(base, 'PATCH', { status: 'in_progress', expected_revision: 0 }, admin)).status, 409);
  const reviewing = await call(base, 'PATCH', { status: 'reviewing', expected_revision: 0 }, admin);
  assert.equal(reviewing.status, 200);
  assert.equal(reviewing.data.request.revision, 1);
  const first = await call(`${base}/quotes`, 'POST', quoteBody(1), admin);
  assert.equal(first.status, 201);
  assert.equal(first.data.quotes[0].version, 1);
  const firstId = first.data.quotes[0].id;
  const revised = await call(`${base}/quotes`, 'POST', {
    ...quoteBody(2), scope: 'Revised scope for the same case with a separately reviewed signing document.'
  }, admin);
  assert.equal(revised.status, 201);
  assert.equal(revised.data.quotes.length, 2);
  assert.equal(revised.data.quotes[0].id, firstId);
  assert.equal(revised.data.quotes[1].version, 2);
  const activeId = revised.data.request.current_quote_id;
  assert.equal((await call(`/api/desk/requests/${id}/accept`, 'POST', {
    quote_id: firstId, accepted_by: 'Example Operator', authorized: true, expected_revision: 3
  }, token)).status, 409);
  assert.equal((await call(`/api/desk/requests/${id}/accept`, 'POST', {
    quote_id: activeId, accepted_by: 'Example Operator', authorized: false, expected_revision: 3
  }, token)).status, 400);
  const accepted = await call(`/api/desk/requests/${id}/accept`, 'POST', {
    quote_id: activeId, accepted_by: 'Example Operator', authorized: true, expected_revision: 3
  }, token);
  assert.equal(accepted.status, 200);
  assert.equal(accepted.data.request.status, 'accepted');
  assert.equal(accepted.data.request.accepted_quote_version, 2);
  assert.ok(accepted.data.request.accepted_at);
  assert.equal((await call(`/api/desk/requests/${id}/accept`, 'POST', {
    quote_id: activeId, accepted_by: 'Example Operator', authorized: true, expected_revision: 3
  }, token)).status, 200);
  assert.equal(count(sqlite, 'desk_events'), 5);
  assert.equal((await call(base, 'PATCH', { status: 'in_progress', expected_revision: 4 }, admin)).status, 409);
  assert.equal((await call(`${base}/payment`, 'PUT', {
    action: 'set_link', quote_id: activeId, reference: id, amount_minor: 12500,
    currency: 'CHF', url: 'https://evil.example.test/collect', expected_revision: 4
  }, admin)).status, 400);
  const link = await call(`${base}/payment`, 'PUT', {
    action: 'set_link', quote_id: activeId, reference: id, amount_minor: 12500,
    currency: 'CHF', url: 'https://checkout.example.test/pay/123', expected_revision: 4
  }, admin);
  assert.equal(link.status, 200);
  assert.equal(link.data.payment.status, 'link_ready');
  assert.equal((await call(`/api/desk/requests/${id}`, 'GET', undefined, token)).data.payment.url,
    'https://checkout.example.test/pay/123');
  assert.equal((await call(base, 'PATCH', { status: 'in_progress', expected_revision: 5 }, admin)).status, 409);
  assert.equal((await call(`${base}/payment`, 'PUT', {
    action: 'confirm_received', quote_id: activeId, reference: id, amount_minor: 12500,
    currency: 'CHF', received_amount_minor: 10000, received_currency: 'CHF', expected_revision: 5
  }, admin)).status, 400);
  const paid = await call(`${base}/payment`, 'PUT', {
    action: 'confirm_received', quote_id: activeId, reference: id, amount_minor: 12500,
    currency: 'CHF', received_amount_minor: 12500, received_currency: 'CHF', expected_revision: 5
  }, admin);
  assert.equal(paid.status, 200);
  assert.equal(paid.data.payment.status, 'confirmed');
  assert.equal((await call(base, 'PATCH', { status: 'in_progress', expected_revision: 6 }, admin)).status, 200);
  assert.equal((await call(base, 'PATCH', { status: 'completed', expected_revision: 7 }, admin)).status, 400);
  const done = await call(base, 'PATCH', {
    status: 'completed', report: 'The specified document was reviewed and the scoped signing work was completed.',
    expected_revision: 7
  }, admin);
  assert.equal(done.status, 200);
  assert.equal(done.data.request.status, 'completed');
  assert.equal(done.data.request.report.includes('completed'), true);
  assert.equal((await call(`/api/desk/requests/${id}/withdraw`, 'POST', { expected_revision: 8 }, token)).status, 409);
  assert.equal(count(sqlite, 'desk_quotes'), 2);
});

test('on-completion payment timing, expiry, and agent deletion preserve cases while legacy handoffs cascade', async t => {
  const { sqlite, env, call } = await setup(t);
  const registered = await call('/api/agents', 'POST', {
    display_name: 'Desk Agent', platform: 'Test Runner', operator_contact: 'agent@example.test'
  });
  const agentToken = registered.data.api_token;
  const agentId = registered.data.agent.id;
  const body = { ...requestBody, applicant_kind: 'agent', operator_name: 'Responsible Operator' };
  assert.equal((await call('/api/desk/requests', 'POST', body)).status, 401);
  const created = await call('/api/desk/requests', 'POST', body, agentToken);
  assert.equal(created.status, 201);
  const id = created.data.request.id;
  const token = created.data.request_token;
  const admin = env.ADMIN_API_TOKEN;
  const base = `/api/admin/desk/requests/${id}`;
  assert.equal((await call('/api/handoffs', 'POST', {
    requested_role: 'Human reviewer', jurisdiction: 'Switzerland',
    request_summary: 'A legacy handoff is created for cascade comparison in this test.',
    mandate_scope: 'No actual authority is requested in this isolated test.',
    operator_authorized: true
  }, agentToken)).status, 201);
  assert.equal((await call(base, 'PATCH', { status: 'reviewing', expected_revision: 0 }, admin)).status, 200);
  const quote = await call(`${base}/quotes`, 'POST', quoteBody(1, 'on_completion'), admin);
  assert.equal(quote.status, 201);
  const quoteId = quote.data.request.current_quote_id;
  const expire = sqlite.prepare("UPDATE desk_quotes SET valid_until = '2000-01-01T00:00:00.000Z' WHERE id = ?1");
  try { expire.run([quoteId]); } finally { expire.free(); }
  assert.equal((await call(`/api/desk/requests/${id}/accept`, 'POST', {
    quote_id: quoteId, accepted_by: 'Responsible Operator', authorized: true, expected_revision: 2
  }, token)).status, 409);
  assert.equal((await call(base, 'PATCH', { status: 'reviewing', expected_revision: 2 }, admin)).status, 200);
  const fresh = await call(`${base}/quotes`, 'POST', quoteBody(3, 'on_completion'), admin);
  assert.equal(fresh.status, 201);
  const freshId = fresh.data.request.current_quote_id;
  assert.equal((await call(`/api/desk/requests/${id}/accept`, 'POST', {
    quote_id: freshId, accepted_by: 'Responsible Operator', authorized: true, expected_revision: 4
  }, token)).status, 200);
  assert.equal((await call(base, 'PATCH', { status: 'in_progress', expected_revision: 5 }, admin)).status, 200);
  assert.equal((await call('/api/agents/me', 'DELETE', undefined, agentToken)).status, 204);
  assert.equal(count(sqlite, 'handoffs'), 0);
  assert.equal(count(sqlite, 'desk_requests'), 1);
  const preserved = await call(base, 'GET', undefined, admin);
  assert.equal(preserved.data.request.agent_id, null);
  assert.equal((await call(`/api/desk/requests/${id}`, 'GET', undefined, token)).status, 200);
  assert.equal((await call(base, 'PATCH', {
    status: 'completed', report: 'The defined human service was performed and recorded for the responsible operator.',
    expected_revision: 6
  }, admin)).status, 200);
  assert.equal((await call('/api/agents/me', 'GET', undefined, agentToken)).status, 401);
  assert.equal(agentId !== null, true);
});

test('withdrawal is terminal; unconfigured Payrexx blocks links while manual receipt remains possible', async t => {
  const { env, call } = await setup(t);
  const first = await call('/api/desk/requests', 'POST', requestBody);
  const id = first.data.request.id;
  const token = first.data.request_token;
  const withdrawn = await call(`/api/desk/requests/${id}/withdraw`, 'POST', { expected_revision: 0 }, token);
  assert.equal(withdrawn.status, 200);
  assert.equal(withdrawn.data.request.status, 'withdrawn');
  assert.equal((await call(`/api/desk/requests/${id}/withdraw`, 'POST', { expected_revision: 0 }, token)).data.request.revision, 1);
  assert.equal((await call(`/api/desk/requests/${id}/messages`, 'POST', {
    body: 'This must not reopen a withdrawn case.', expected_revision: 1
  }, token)).status, 409);
  assert.equal((await call(`/api/admin/desk/requests/${id}`, 'PATCH', {
    status: 'reviewing', expected_revision: 1
  }, env.ADMIN_API_TOKEN)).status, 409);

  const second = await call('/api/desk/requests', 'POST', { ...requestBody, service_id: 'operations' });
  const secondId = second.data.request.id;
  const secondToken = second.data.request_token;
  const base = `/api/admin/desk/requests/${secondId}`;
  const admin = env.ADMIN_API_TOKEN;
  assert.equal((await call(base, 'PATCH', { status: 'reviewing', expected_revision: 0 }, admin)).status, 200);
  const quoted = await call(`${base}/quotes`, 'POST', quoteBody(1), admin);
  const quoteId = quoted.data.request.current_quote_id;
  assert.equal((await call(`/api/desk/requests/${secondId}/accept`, 'POST', {
    quote_id: quoteId, accepted_by: 'Example Operator', authorized: true, expected_revision: 2
  }, secondToken)).status, 200);
  assert.equal((await call(`${base}/payment`, 'PUT', {
    action: 'set_link', quote_id: quoteId, reference: secondId, amount_minor: 12500,
    currency: 'CHF', url: 'https://checkout.example.test/pay/456', expected_revision: 3
  }, admin)).status, 503);
  const manual = await call(`${base}/payment`, 'PUT', {
    action: 'confirm_received', quote_id: quoteId, reference: secondId, amount_minor: 12500,
    currency: 'CHF', received_amount_minor: 12500, received_currency: 'CHF', expected_revision: 3
  }, admin);
  assert.equal(manual.status, 200);
  assert.equal(manual.data.payment.status, 'confirmed');
  assert.equal(manual.data.payment.url, null);
  assert.equal((await call(base, 'PATCH', { status: 'in_progress', expected_revision: 4 }, admin)).status, 200);
});
