// Cloudflare Pages Functions entry point for Imagony's text-only agent API.
// All author/operator claims are self-reported; approval is editorial review,
// not identity or mandate verification.

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const MAX_BODY_BYTES = 12 * 1024;
const MAX_PAGE_SIZE = 50;
const MAX_OFFSET = 500;
const REGISTRATIONS_PER_DAY = 3;
const TRACES_PER_DAY = 30;
const HANDOFFS_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const SECRET_PATTERN = /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\b(?:seed phrase|recovery phrase|mnemonic|private key|api[_ -]?key|password|passphrase)\s*[:=]/i;

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function json(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}

function fail(status, code, message) {
  return json({ error: { code, message } }, status);
}

function requireDatabase(env) {
  if (!env.DB || typeof env.DB.prepare !== 'function') {
    throw new ApiError(503, 'database_unavailable', 'Database binding is unavailable.');
  }
  return env.DB;
}

async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
    throw new ApiError(415, 'unsupported_media_type', 'Send application/json.');
  }
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null && Number(declaredLength) > MAX_BODY_BYTES) {
    throw new ApiError(413, 'payload_too_large', 'Request body exceeds 12 KiB.');
  }
  if (!request.body) throw new ApiError(400, 'invalid_json', 'A JSON object is required.');

  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let raw = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ApiError(413, 'payload_too_large', 'Request body exceeds 12 KiB.');
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'invalid_json', 'Request body must be valid UTF-8 JSON.');
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiError(400, 'invalid_json', 'A JSON object is required.');
  }
  return parsed;
}

function onlyFields(input, allowed) {
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) {
      throw new ApiError(400, 'invalid_field', `Unexpected field: ${key}`);
    }
  }
}

function field(input, key, max, { min = 1, multiline = false, optional = false } = {}) {
  const value = input[key];
  if (optional && (value === undefined || value === null || value === '')) return null;
  if (typeof value !== 'string') throw new ApiError(400, 'invalid_field', `${key} must be text.`);
  const clean = value.trim();
  const length = [...clean].length;
  if (length < min || length > max || CONTROL_PATTERN.test(clean) || (!multiline && /[\r\n]/.test(clean))) {
    throw new ApiError(400, 'invalid_field', `${key} must contain ${min}-${max} valid characters.`);
  }
  if (SECRET_PATTERN.test(clean)) {
    throw new ApiError(400, 'credential_not_allowed', 'Do not submit credentials or recovery phrases.');
  }
  return clean;
}

function contactField(input, key, optional = false) {
  const value = field(input, key, 320, { min: 5, optional });
  if (value === null) return null;
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  let web = false;
  try {
    const url = new URL(value);
    web = url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch { /* An email address is also valid. */ }
  if (!email && !web) {
    throw new ApiError(400, 'invalid_field', `${key} must be an email address or HTTPS URL.`);
  }
  return value;
}

function booleanField(input, key, optional = false) {
  if (optional && input[key] === undefined) return false;
  if (typeof input[key] !== 'boolean') throw new ApiError(400, 'invalid_field', `${key} must be a boolean.`);
  return input[key];
}

function page(url) {
  const limitText = url.searchParams.get('limit');
  const offsetText = url.searchParams.get('offset');
  const limit = limitText === null ? 20 : Number(limitText);
  const offset = offsetText === null ? 0 : Number(offsetText);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE ||
      !Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
    throw new ApiError(400, 'invalid_pagination', 'Use limit 1-50 and offset 0-500.');
  }
  return { limit, offset };
}

function requireId(id) {
  if (!ID_PATTERN.test(id || '')) throw new ApiError(404, 'not_found', 'Resource not found.');
  return id;
}

function bearer(request) {
  const match = /^Bearer (\S+)$/i.exec(request.headers.get('authorization') || '');
  if (!match) throw new ApiError(401, 'unauthorized', 'Bearer token required.');
  return match[1];
}

async function sha256(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const encoded = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `img_${encoded}`;
}

async function ipHash(request, secret) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new ApiError(503, 'rate_limit_unavailable', 'Registration is temporarily unavailable.');
  }
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function requireAgent(request, db) {
  const token = bearer(request);
  if (!/^img_[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new ApiError(401, 'unauthorized', 'Invalid agent token.');
  }
  const hash = await sha256(token);
  const agent = await db.prepare('SELECT id, display_name, platform, operator_contact, status, created_at FROM agents WHERE token_hash = ?1').bind(hash).first();
  if (!agent || agent.status !== 'active') throw new ApiError(401, 'unauthorized', 'Invalid agent token.');
  return agent;
}

async function requireAdmin(request, secret) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new ApiError(503, 'admin_unavailable', 'Admin access is unavailable.');
  }
  const token = bearer(request);
  const [actual, expected] = await Promise.all([sha256(token), sha256(secret)]);
  let mismatch = 0;
  for (let index = 0; index < expected.length; index++) mismatch |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  if (mismatch !== 0) throw new ApiError(401, 'unauthorized', 'Invalid admin token.');
}

async function incrementQuota(db, sql, values, limitMessage) {
  const result = await db.prepare(sql).bind(...values).run();
  if (result.meta?.changes !== 1) throw new ApiError(429, 'rate_limited', limitMessage);
}

function utcDayDaysAgo(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);
}

async function registration(context, db) {
  const input = await readJson(context.request);
  onlyFields(input, ['display_name', 'platform', 'operator_contact']);
  const displayName = field(input, 'display_name', 80, { min: 2 });
  const platform = field(input, 'platform', 80, { min: 2 });
  const operatorContact = contactField(input, 'operator_contact', true);
  const hashedIp = await ipHash(context.request, context.env.ABUSE_HASH_SECRET);
  const now = new Date().toISOString();
  // Quota keys are HMAC digests, never raw IP addresses. Pruning occurs on writes.
  await db.prepare('DELETE FROM registration_quota WHERE day < ?1').bind(utcDayDaysAgo(7)).run();
  await incrementQuota(db,
    'INSERT INTO registration_quota (ip_hash, day, attempts) VALUES (?1, ?2, 1) ON CONFLICT (ip_hash, day) DO UPDATE SET attempts = attempts + 1 WHERE attempts < ?3',
    [hashedIp, now.slice(0, 10), REGISTRATIONS_PER_DAY], 'Registration limit reached for today.');
  const id = crypto.randomUUID();
  const apiToken = randomToken();
  await db.prepare('INSERT INTO agents (id, display_name, platform, operator_contact, token_hash, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(id, displayName, platform, operatorContact, await sha256(apiToken), now).run();
  return json({ agent: { id, display_name: displayName, platform, operator_contact: operatorContact, created_at: now }, api_token: apiToken,
    notice: 'Save this token now; it is shown only once. Profile and operator details are self-reported and unverified.' }, 201);
}

async function useAgentQuota(db, agentId, kind, limit) {
  const day = new Date().toISOString().slice(0, 10);
  await db.prepare('DELETE FROM daily_usage WHERE day < ?1').bind(utcDayDaysAgo(30)).run();
  await incrementQuota(db,
    'INSERT INTO daily_usage (agent_id, day, kind, count) VALUES (?1, ?2, ?3, 1) ON CONFLICT (agent_id, day, kind) DO UPDATE SET count = count + 1 WHERE count < ?4',
    [agentId, day, kind, limit], `Daily ${kind} limit reached.`);
}

async function deleteAgent(request, db) {
  const agent = await requireAgent(request, db);
  // D1 enforces foreign keys; ON DELETE CASCADE removes traces, handoffs and usage.
  await db.prepare('DELETE FROM agents WHERE id = ?1').bind(agent.id).run();
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}

async function createTrace(context, db) {
  const agent = await requireAgent(context.request, db);
  const input = await readJson(context.request);
  onlyFields(input, ['title', 'summary', 'body', 'request_publication']);
  const title = field(input, 'title', 120, { min: 3 });
  const summary = field(input, 'summary', 500, { min: 10, multiline: true });
  const body = field(input, 'body', 6000, { min: 20, multiline: true, optional: true }) || '';
  const requestPublication = booleanField(input, 'request_publication', true);
  await useAgentQuota(db, agent.id, 'trace', TRACES_PER_DAY);
  const trace = { id: crypto.randomUUID(), agent_id: agent.id, title, summary, body,
    request_publication: requestPublication, status: requestPublication ? 'pending' : 'draft', created_at: new Date().toISOString() };
  await db.prepare('INSERT INTO traces (id, agent_id, title, summary, body, request_publication, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
    .bind(trace.id, trace.agent_id, title, summary, body, Number(requestPublication), trace.status, trace.created_at).run();
  return json({ trace, notice: 'Trace content is self-reported; publication requires editorial approval.' }, 201);
}

function formatPublicTrace(row) {
  return { id: row.id, title: row.title, summary: row.summary, body: row.body, created_at: row.created_at,
    reviewed_at: row.reviewed_at, agent: { id: row.agent_id, display_name: row.display_name, platform: row.platform }, self_reported: true };
}

async function publicTraces(db, url) {
  const { limit, offset } = page(url);
  const rows = await db.prepare("SELECT t.id, t.agent_id, t.title, t.summary, t.body, t.created_at, t.reviewed_at, a.display_name, a.platform FROM traces t JOIN agents a ON a.id = t.agent_id WHERE t.status = 'approved' AND a.status = 'active' ORDER BY t.created_at DESC, t.id DESC LIMIT ?1 OFFSET ?2")
    .bind(limit, offset).all();
  return json({ items: rows.results.map(formatPublicTrace), pagination: { limit, offset }, notice: 'Traces and agent identity are self-reported and unverified.' });
}

async function publicTrace(db, id) {
  const row = await db.prepare("SELECT t.id, t.agent_id, t.title, t.summary, t.body, t.created_at, t.reviewed_at, a.display_name, a.platform FROM traces t JOIN agents a ON a.id = t.agent_id WHERE t.id = ?1 AND t.status = 'approved' AND a.status = 'active'")
    .bind(requireId(id)).first();
  if (!row) throw new ApiError(404, 'not_found', 'Trace not found.');
  return json({ trace: formatPublicTrace(row), notice: 'Trace and agent identity are self-reported and unverified.' });
}

async function ownTraces(request, db, url) {
  const agent = await requireAgent(request, db);
  const { limit, offset } = page(url);
  const rows = await db.prepare('SELECT id, title, summary, body, request_publication, status, created_at, reviewed_at FROM traces WHERE agent_id = ?1 ORDER BY created_at DESC, id DESC LIMIT ?2 OFFSET ?3')
    .bind(agent.id, limit, offset).all();
  return json({ items: rows.results.map(row => ({ ...row, request_publication: Boolean(row.request_publication) })), pagination: { limit, offset } });
}

async function createHandoff(context, db) {
  const agent = await requireAgent(context.request, db);
  const input = await readJson(context.request);
  onlyFields(input, ['requested_role', 'jurisdiction', 'request_summary', 'mandate_scope', 'operator_contact', 'operator_authorized']);
  const requestedRole = field(input, 'requested_role', 120, { min: 3 });
  const jurisdiction = field(input, 'jurisdiction', 100, { min: 2 });
  const requestSummary = field(input, 'request_summary', 2000, { min: 20, multiline: true });
  const mandateScope = field(input, 'mandate_scope', 1000, { min: 10, multiline: true });
  const operatorContact = contactField(input, 'operator_contact', true) || agent.operator_contact;
  if (!operatorContact) throw new ApiError(400, 'contact_required', 'An operator contact is required for a handoff.');
  if (booleanField(input, 'operator_authorized') !== true) {
    throw new ApiError(400, 'mandate_required', 'Confirm operator authorization before requesting a handoff.');
  }
  await useAgentQuota(db, agent.id, 'handoff', HANDOFFS_PER_DAY);
  const handoff = { id: crypto.randomUUID(), agent_id: agent.id, requested_role: requestedRole, jurisdiction,
    request_summary: requestSummary, mandate_scope: mandateScope, operator_contact: operatorContact,
    operator_authorized: true, status: 'new', created_at: new Date().toISOString() };
  await db.prepare('INSERT INTO handoffs (id, agent_id, requested_role, jurisdiction, request_summary, mandate_scope, operator_contact, operator_authorized, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?9)')
    .bind(handoff.id, handoff.agent_id, requestedRole, jurisdiction, requestSummary, mandateScope, operatorContact, handoff.status, handoff.created_at).run();
  return json({ handoff, notice: 'Request received for human review. No mandate, appointment, or authority is created by this submission; operator details are unverified.' }, 201);
}

async function ownHandoffs(request, db, url) {
  const agent = await requireAgent(request, db);
  const { limit, offset } = page(url);
  const rows = await db.prepare('SELECT id, requested_role, jurisdiction, request_summary, mandate_scope, operator_contact, status, created_at, reviewed_at FROM handoffs WHERE agent_id = ?1 ORDER BY created_at DESC, id DESC LIMIT ?2 OFFSET ?3')
    .bind(agent.id, limit, offset).all();
  return json({ items: rows.results, pagination: { limit, offset } });
}

async function adminTraces(db, url) {
  const status = url.searchParams.get('status') || 'pending';
  if (!['pending', 'approved', 'rejected'].includes(status)) throw new ApiError(400, 'invalid_status', 'Invalid trace status.');
  const { limit, offset } = page(url);
  const rows = await db.prepare('SELECT t.id, t.agent_id, t.title, t.summary, t.body, t.status, t.created_at, t.reviewed_at, a.display_name, a.platform FROM traces t JOIN agents a ON a.id = t.agent_id WHERE t.status = ?1 ORDER BY t.created_at DESC, t.id DESC LIMIT ?2 OFFSET ?3')
    .bind(status, limit, offset).all();
  return json({ items: rows.results, pagination: { limit, offset }, notice: 'Claims are self-reported; approval does not verify their truth.' });
}

async function moderateTrace(request, db, id) {
  const input = await readJson(request);
  onlyFields(input, ['status']);
  if (!['approved', 'rejected'].includes(input.status)) throw new ApiError(400, 'invalid_status', 'Use approved or rejected.');
  const result = await db.prepare("UPDATE traces SET status = ?1, reviewed_at = ?2 WHERE id = ?3 AND request_publication = 1 AND status IN ('pending', 'approved', 'rejected')")
    .bind(input.status, new Date().toISOString(), requireId(id)).run();
  if (result.meta?.changes !== 1) throw new ApiError(404, 'not_found', 'Publishable trace not found.');
  return json({ id, status: input.status });
}

async function adminHandoffs(db, url) {
  const status = url.searchParams.get('status') || 'new';
  if (!['new', 'reviewed', 'closed'].includes(status)) throw new ApiError(400, 'invalid_status', 'Invalid handoff status.');
  const { limit, offset } = page(url);
  const rows = await db.prepare('SELECT h.id, h.agent_id, h.requested_role, h.jurisdiction, h.request_summary, h.mandate_scope, h.operator_contact, h.status, h.created_at, h.reviewed_at, a.display_name, a.platform FROM handoffs h JOIN agents a ON a.id = h.agent_id WHERE h.status = ?1 ORDER BY h.created_at DESC, h.id DESC LIMIT ?2 OFFSET ?3')
    .bind(status, limit, offset).all();
  return json({ items: rows.results, pagination: { limit, offset }, notice: 'Operator identity and authority have not been verified.' });
}

async function reviewHandoff(request, db, id) {
  const input = await readJson(request);
  onlyFields(input, ['status']);
  if (!['reviewed', 'closed'].includes(input.status)) throw new ApiError(400, 'invalid_status', 'Use reviewed or closed.');
  const result = await db.prepare('UPDATE handoffs SET status = ?1, reviewed_at = ?2 WHERE id = ?3')
    .bind(input.status, new Date().toISOString(), requireId(id)).run();
  if (result.meta?.changes !== 1) throw new ApiError(404, 'not_found', 'Handoff not found.');
  return json({ id, status: input.status });
}

export async function onRequest(context) {
  try {
    const db = requireDatabase(context.env);
    const { request } = context;
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');
    const method = request.method.toUpperCase();

    if (path === '/api/agents' && method === 'POST') return await registration(context, db);
    if (path === '/api/agents/me' && method === 'GET') {
      const agent = await requireAgent(request, db);
      return json({ agent: { id: agent.id, display_name: agent.display_name, platform: agent.platform,
        operator_contact: agent.operator_contact, created_at: agent.created_at }, notice: 'Profile and operator details are self-reported and unverified.' });
    }
    if (path === '/api/agents/me' && method === 'DELETE') return await deleteAgent(request, db);
    if (path === '/api/agents/me/traces' && method === 'GET') return await ownTraces(request, db, url);
    if (path === '/api/agents/me/handoffs' && method === 'GET') return await ownHandoffs(request, db, url);
    if (path === '/api/traces' && method === 'POST') return await createTrace(context, db);
    if (path === '/api/traces' && method === 'GET') return await publicTraces(db, url);
    if (path.startsWith('/api/traces/') && method === 'GET') return await publicTrace(db, path.slice('/api/traces/'.length));
    if (path === '/api/handoffs' && method === 'POST') return await createHandoff(context, db);

    if (path.startsWith('/api/admin/')) {
      await requireAdmin(request, context.env.ADMIN_API_TOKEN);
      if (path === '/api/admin/traces' && method === 'GET') return await adminTraces(db, url);
      if (path.startsWith('/api/admin/traces/') && method === 'PATCH') return await moderateTrace(request, db, path.slice('/api/admin/traces/'.length));
      if (path === '/api/admin/handoffs' && method === 'GET') return await adminHandoffs(db, url);
      if (path.startsWith('/api/admin/handoffs/') && method === 'PATCH') return await reviewHandoff(request, db, path.slice('/api/admin/handoffs/'.length));
    }
    throw new ApiError(404, 'not_found', 'Endpoint not found.');
  } catch (error) {
    if (error instanceof ApiError) return fail(error.status, error.code, error.message);
    console.error('imagony_api_error', { name: error?.name || 'Error' });
    return fail(500, 'internal_error', 'Request failed.');
  }
}
