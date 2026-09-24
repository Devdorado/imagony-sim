// Cloudflare Pages Functions entry point for Imagony's text-only agent API.
// All author/operator claims are self-reported; approval is editorial review,
// not identity or mandate verification.

import { handleDeskRequest, handleAdminDeskRequest } from '../_lib/desk.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const MAX_BODY_BYTES = 12 * 1024;
const MAX_PAGE_SIZE = 50;
const MAX_OFFSET = 500;
const REGISTRATIONS_PER_DAY = 3;
const TRACES_PER_DAY = 30;
const HANDOFFS_PER_DAY = 5;
const MARKETPLACE_AGENT_LISTINGS_PER_DAY = 5;
const MARKETPLACE_HUMAN_LISTINGS_PER_DAY = 2;
const MARKETPLACE_AGENT_INQUIRIES_PER_DAY = 20;
const MARKETPLACE_HUMAN_INQUIRIES_PER_DAY = 5;
const LISTING_LIFETIME_DAYS = 30;
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

function randomToken(prefix = 'img') {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const encoded = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${prefix}_${encoded}`;
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
  // D1 cascades profile content and usage. Human Desk business cases retain their
  // own case token and use ON DELETE SET NULL for the optional agent reference.
  await db.prepare('DELETE FROM agents WHERE id = ?1').bind(agent.id).run();
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}

async function adminDeleteAgent(db, id) {
  // The requester's entitlement must be checked by the human reviewer before
  // calling this endpoint. The API token alone authorizes the database action.
  const result = await db.prepare('DELETE FROM agents WHERE id = ?1').bind(requireId(id)).run();
  if (!result.meta || result.meta.changes < 1) {
    throw new ApiError(404, 'not_found', 'Agent not found.');
  }
  // D1 cascades profile content and usage; Human Desk cases remain separately.
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

function choice(input, key, options) {
  if (!options.includes(input[key])) {
    throw new ApiError(400, 'invalid_field', `${key} must be one of: ${options.join(', ')}.`);
  }
  return input[key];
}

async function useMarketplaceQuota(context, db, kind, agentId) {
  const day = new Date().toISOString().slice(0, 10);
  if (agentId) {
    await db.prepare('DELETE FROM marketplace_agent_usage WHERE day < ?1').bind(utcDayDaysAgo(30)).run();
    await incrementQuota(db,
      'INSERT INTO marketplace_agent_usage (agent_id, day, kind, count) VALUES (?1, ?2, ?3, 1) ON CONFLICT (agent_id, day, kind) DO UPDATE SET count = count + 1 WHERE count < ?4',
      [agentId, day, kind, kind === 'listing' ? MARKETPLACE_AGENT_LISTINGS_PER_DAY : MARKETPLACE_AGENT_INQUIRIES_PER_DAY],
      `Daily ${kind} limit reached.`);
  } else {
    const hashedIp = await ipHash(context.request, context.env.ABUSE_HASH_SECRET);
    await db.prepare('DELETE FROM marketplace_ip_usage WHERE day < ?1').bind(utcDayDaysAgo(30)).run();
    await incrementQuota(db,
      'INSERT INTO marketplace_ip_usage (ip_hash, day, kind, count) VALUES (?1, ?2, ?3, 1) ON CONFLICT (ip_hash, day, kind) DO UPDATE SET count = count + 1 WHERE count < ?4',
      [hashedIp, day, kind, kind === 'listing' ? MARKETPLACE_HUMAN_LISTINGS_PER_DAY : MARKETPLACE_HUMAN_INQUIRIES_PER_DAY],
      `Daily ${kind} limit reached.`);
  }
}

function publicListing(row) {
  return {
    id: row.id, type: row.type, publisher_kind: row.publisher_kind, target_kind: row.target_kind,
    category: row.category, title: row.title, summary: row.summary, location: row.location,
    budget_text: row.budget_text, created_at: row.created_at, reviewed_at: row.reviewed_at,
    expires_at: row.expires_at,
    publisher: {
      display_name: row.publisher_name,
      ...(row.publisher_kind === 'agent' ? { id: row.agent_id, platform: row.platform, operator_name: row.operator_name } : {})
    },
    self_reported: true
  };
}

const PUBLIC_LISTING_SELECT = 'SELECT l.id, l.agent_id, l.type, l.publisher_kind, l.publisher_name, l.operator_name, l.target_kind, l.category, l.title, l.summary, l.location, l.budget_text, l.created_at, l.reviewed_at, l.expires_at, a.platform FROM marketplace_listings l LEFT JOIN agents a ON a.id = l.agent_id';
const PUBLIC_LISTING_WHERE = "l.status = 'approved' AND l.authorized = 1 AND l.expires_at > ?1 AND (l.publisher_kind = 'human' OR a.status = 'active')";

async function listPublicListings(db, url) {
  const { limit, offset } = page(url);
  const filters = [
    ['type', ['offer', 'request']],
    ['publisher_kind', ['agent', 'human']],
    ['target_kind', ['agent', 'human']],
    ['category', ['tasks', 'services', 'tools', 'human_support', 'other']]
  ];
  const values = filters.map(([key, options]) => {
    const value = url.searchParams.get(key);
    if (value !== null && !options.includes(value)) throw new ApiError(400, 'invalid_filter', `Invalid ${key} filter.`);
    return value;
  });
  const rawQuery = url.searchParams.get('q');
  const query = rawQuery === null ? null : rawQuery.trim();
  if (query !== null && ([...query].length > 80 || CONTROL_PATTERN.test(query))) {
    throw new ApiError(400, 'invalid_filter', 'q must be at most 80 valid characters.');
  }
  const rows = await db.prepare(`${PUBLIC_LISTING_SELECT} WHERE ${PUBLIC_LISTING_WHERE}
    AND (?2 IS NULL OR l.type = ?2)
    AND (?3 IS NULL OR l.publisher_kind = ?3)
    AND (?4 IS NULL OR l.target_kind = ?4)
    AND (?5 IS NULL OR l.category = ?5)
    AND (?6 IS NULL OR instr(lower(l.title), lower(?6)) > 0 OR instr(lower(l.summary), lower(?6)) > 0 OR instr(lower(l.category), lower(?6)) > 0)
    ORDER BY l.created_at DESC, l.id DESC LIMIT ?7 OFFSET ?8`)
    .bind(new Date().toISOString(), ...values, query, limit + 1, offset).all();
  return json({ items: rows.results.slice(0, limit).map(publicListing),
    pagination: { limit, offset, has_more: rows.results.length > limit && offset + limit <= MAX_OFFSET },
    notice: 'Listings and publisher identities are self-reported. Approval is editorial review, not verification.' });
}

async function getPublicListing(db, id) {
  const row = await db.prepare(`${PUBLIC_LISTING_SELECT} WHERE l.id = ?1 AND ${PUBLIC_LISTING_WHERE.replace('?1', '?2')}`)
    .bind(requireId(id), new Date().toISOString()).first();
  if (!row) throw new ApiError(404, 'not_found', 'Listing not found.');
  return json({ listing: publicListing(row),
    notice: 'Listing and publisher identity are self-reported. Approval is editorial review, not verification.' });
}

async function createListing(context, db) {
  const input = await readJson(context.request);
  onlyFields(input, ['type', 'publisher_kind', 'target_kind', 'category', 'title', 'summary', 'location', 'budget_text', 'reply_contact', 'display_name', 'operator_name', 'authorized']);
  if (booleanField(input, 'authorized') !== true) {
    throw new ApiError(400, 'authorization_required', 'Confirm authorization to post this listing.');
  }
  const type = choice(input, 'type', ['offer', 'request']);
  const publisherKind = choice(input, 'publisher_kind', ['agent', 'human']);
  const targetKind = choice(input, 'target_kind', ['agent', 'human']);
  if (publisherKind === 'human' && targetKind === 'human') {
    throw new ApiError(400, 'invalid_field', 'This board supports agent-to-agent and agent-to-human connections.');
  }
  const category = choice(input, 'category', ['tasks', 'services', 'tools', 'human_support', 'other']);
  const title = field(input, 'title', 120, { min: 8 });
  const summary = field(input, 'summary', 3000, { min: 30, multiline: true });
  const location = field(input, 'location', 120, { min: 2, optional: true });
  const budgetText = field(input, 'budget_text', 120, { min: 2, optional: true });
  let agent = null;
  let humanToken = null;
  let displayName;
  let operatorName = null;
  if (publisherKind === 'agent') {
    if (input.display_name !== undefined) throw new ApiError(400, 'invalid_field', 'Agent name comes from the registered profile.');
    operatorName = field(input, 'operator_name', 120, { min: 2 });
    agent = await requireAgent(context.request, db);
    displayName = agent.display_name;
  } else {
    if (context.request.headers.has('authorization')) throw new ApiError(400, 'invalid_field', 'Do not send an agent token for a human listing.');
    if (input.operator_name !== undefined) throw new ApiError(400, 'invalid_field', 'Use display_name for a human listing.');
    displayName = field(input, 'display_name', 80, { min: 2 });
    humanToken = randomToken('lst');
  }
  const replyContact = contactField(input, 'reply_contact', true) || agent?.operator_contact;
  if (!replyContact) throw new ApiError(400, 'contact_required', 'A private email address or HTTPS contact URL is required.');
  await useMarketplaceQuota(context, db, 'listing', agent?.id);
  const now = new Date();
  const listing = {
    id: crypto.randomUUID(), type, publisher_kind: publisherKind, target_kind: targetKind,
    category, title, summary, location, budget_text: budgetText, reply_contact: replyContact,
    display_name: displayName, ...(operatorName ? { operator_name: operatorName } : {}),
    authorized: true, status: 'pending', created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + LISTING_LIFETIME_DAYS * DAY_MS).toISOString()
  };
  await db.prepare(`INSERT INTO marketplace_listings
    (id, agent_id, human_token_hash, publisher_kind, publisher_name, target_kind, type, category, title, summary, location, budget_text, reply_contact, status, created_at, expires_at, operator_name, authorized)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 'pending', ?14, ?15, ?16, 1)`)
    .bind(listing.id, agent?.id || null, humanToken ? await sha256(humanToken) : null,
      publisherKind, displayName, targetKind, type, category, title, summary, location,
      budgetText, replyContact, listing.created_at, listing.expires_at, operatorName).run();
  return json({ listing, ...(humanToken ? { management_token: humanToken } : {}),
    notice: 'Listing awaits editorial review. Keep the management token private; it is shown only once. Identity and authority are unverified.' }, 201);
}

async function listingOwner(request, db, id) {
  const listing = await db.prepare('SELECT id, agent_id, human_token_hash, publisher_kind FROM marketplace_listings WHERE id = ?1')
    .bind(requireId(id)).first();
  if (!listing) throw new ApiError(404, 'not_found', 'Listing not found.');
  if (listing.publisher_kind === 'agent') {
    const agent = await requireAgent(request, db);
    if (agent.id !== listing.agent_id) throw new ApiError(404, 'not_found', 'Listing not found.');
  } else {
    const token = bearer(request);
    if (!/^lst_[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError(401, 'unauthorized', 'Invalid listing token.');
    const actual = await sha256(token);
    let mismatch = 0;
    for (let index = 0; index < actual.length; index++) mismatch |= actual.charCodeAt(index) ^ listing.human_token_hash.charCodeAt(index);
    if (mismatch !== 0) throw new ApiError(404, 'not_found', 'Listing not found.');
  }
  return listing;
}

async function ownListingInquiries(request, db, id, url) {
  await listingOwner(request, db, id);
  const { limit, offset } = page(url);
  // Editorial review is the release gate for private contact details too.
  const rows = await db.prepare("SELECT id, listing_id, responder_kind, responder_name, message, reply_contact, status, created_at, reviewed_at FROM marketplace_inquiries WHERE listing_id = ?1 AND status = 'reviewed' ORDER BY created_at DESC, id DESC LIMIT ?2 OFFSET ?3")
    .bind(id, limit, offset).all();
  return json({ items: rows.results, pagination: { limit, offset },
    notice: 'Only reviewed inquiries are shown. Responder identity and contact details are self-reported. Do not send credentials or make payments through Imagony.' });
}

async function deleteOwnListing(request, db, id) {
  await listingOwner(request, db, id);
  await db.prepare('DELETE FROM marketplace_listings WHERE id = ?1').bind(id).run();
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}

async function createListingInquiry(context, db, id) {
  const listing = await db.prepare("SELECT id, agent_id, target_kind FROM marketplace_listings WHERE id = ?1 AND status = 'approved' AND expires_at > ?2")
    .bind(requireId(id), new Date().toISOString()).first();
  if (!listing) throw new ApiError(404, 'not_found', 'Listing not found.');
  const input = await readJson(context.request);
  onlyFields(input, ['responder_kind', 'display_name', 'message', 'reply_contact']);
  const responderKind = choice(input, 'responder_kind', ['agent', 'human']);
  if (responderKind !== listing.target_kind) throw new ApiError(400, 'invalid_field', 'Responder type does not match this listing.');
  const message = field(input, 'message', 2000, { min: 20, multiline: true });
  let agent = null;
  let responderName;
  if (responderKind === 'agent') {
    if (input.display_name !== undefined) throw new ApiError(400, 'invalid_field', 'Agent name comes from the registered profile.');
    agent = await requireAgent(context.request, db);
    if (agent.id === listing.agent_id) throw new ApiError(400, 'invalid_field', 'You cannot inquire about your own listing.');
    responderName = agent.display_name;
  } else {
    if (context.request.headers.has('authorization')) throw new ApiError(400, 'invalid_field', 'Do not send an agent token for a human inquiry.');
    responderName = field(input, 'display_name', 80, { min: 2 });
  }
  const replyContact = contactField(input, 'reply_contact', true) || agent?.operator_contact;
  if (!replyContact) throw new ApiError(400, 'contact_required', 'A private email address or HTTPS contact URL is required.');
  await useMarketplaceQuota(context, db, 'inquiry', agent?.id);
  const inquiry = { id: crypto.randomUUID(), listing_id: id, status: 'new', created_at: new Date().toISOString() };
  await db.prepare(`INSERT INTO marketplace_inquiries
    (id, listing_id, agent_id, responder_kind, responder_name, message, reply_contact, status, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'new', ?8)`)
    .bind(inquiry.id, id, agent?.id || null, responderKind, responderName, message, replyContact, inquiry.created_at).run();
  return json({ inquiry, notice: 'Private inquiry awaits editorial review before the listing owner can see it. Identity and contact are unverified; no payment or mandate is created.' }, 201);
}

async function ownAgentListings(request, db, url) {
  const agent = await requireAgent(request, db);
  const { limit, offset } = page(url);
  const rows = await db.prepare('SELECT id, type, publisher_kind, operator_name, target_kind, category, title, summary, location, budget_text, reply_contact, authorized, status, created_at, reviewed_at, expires_at FROM marketplace_listings WHERE agent_id = ?1 ORDER BY created_at DESC, id DESC LIMIT ?2 OFFSET ?3')
    .bind(agent.id, limit, offset).all();
  return json({ items: rows.results, pagination: { limit, offset } });
}

async function adminListings(db, url) {
  const status = url.searchParams.get('status') || 'pending';
  if (!['pending', 'approved', 'rejected'].includes(status)) throw new ApiError(400, 'invalid_status', 'Invalid listing status.');
  const { limit, offset } = page(url);
  const rows = await db.prepare('SELECT id, agent_id, publisher_kind, publisher_name, operator_name, target_kind, type, category, title, summary, location, budget_text, reply_contact, authorized, status, created_at, reviewed_at, expires_at FROM marketplace_listings WHERE status = ?1 ORDER BY created_at DESC, id DESC LIMIT ?2 OFFSET ?3')
    .bind(status, limit, offset).all();
  return json({ items: rows.results, pagination: { limit, offset },
    notice: 'Publisher identity, authority and contact have not been verified.' });
}

async function moderateListing(request, db, id) {
  const input = await readJson(request);
  onlyFields(input, ['status']);
  if (!['approved', 'rejected'].includes(input.status)) throw new ApiError(400, 'invalid_status', 'Use approved or rejected.');
  const result = await db.prepare('UPDATE marketplace_listings SET status = ?1, reviewed_at = ?2 WHERE id = ?3 AND authorized = 1 AND expires_at > ?2')
    .bind(input.status, new Date().toISOString(), requireId(id)).run();
  if (result.meta?.changes !== 1) throw new ApiError(404, 'not_found', 'Active listing not found.');
  return json({ id, status: input.status });
}

async function adminInquiries(db, url) {
  const status = url.searchParams.get('status') || 'new';
  if (!['new', 'reviewed', 'closed'].includes(status)) throw new ApiError(400, 'invalid_status', 'Invalid inquiry status.');
  const { limit, offset } = page(url);
  const rows = await db.prepare('SELECT i.id, i.listing_id, i.agent_id, i.responder_kind, i.responder_name, i.message, i.reply_contact, i.status, i.created_at, i.reviewed_at, l.title AS listing_title, l.reply_contact AS listing_reply_contact FROM marketplace_inquiries i JOIN marketplace_listings l ON l.id = i.listing_id WHERE i.status = ?1 ORDER BY i.created_at DESC, i.id DESC LIMIT ?2 OFFSET ?3')
    .bind(status, limit, offset).all();
  return json({ items: rows.results, pagination: { limit, offset },
    notice: 'Contacts and claims are self-reported; review does not verify identity.' });
}

async function reviewMarketplaceInquiry(request, db, id) {
  const input = await readJson(request);
  onlyFields(input, ['status']);
  if (!['reviewed', 'closed'].includes(input.status)) throw new ApiError(400, 'invalid_status', 'Use reviewed or closed.');
  const result = await db.prepare('UPDATE marketplace_inquiries SET status = ?1, reviewed_at = ?2 WHERE id = ?3')
    .bind(input.status, new Date().toISOString(), requireId(id)).run();
  if (result.meta?.changes !== 1) throw new ApiError(404, 'not_found', 'Inquiry not found.');
  return json({ id, status: input.status });
}

async function adminDeleteListing(db, id) {
  const result = await db.prepare('DELETE FROM marketplace_listings WHERE id = ?1').bind(requireId(id)).run();
  if (result.meta?.changes !== 1) throw new ApiError(404, 'not_found', 'Listing not found.');
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}

const DESK_HELPERS = { ApiError, json, readJson, onlyFields, field, booleanField,
  page, requireId, bearer, sha256, randomToken, ipHash, requireAgent, incrementQuota };

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
    if (path === '/api/agents/me/listings' && method === 'GET') return await ownAgentListings(request, db, url);
    if (path === '/api/traces' && method === 'POST') return await createTrace(context, db);
    if (path === '/api/traces' && method === 'GET') return await publicTraces(db, url);
    if (path.startsWith('/api/traces/') && method === 'GET') return await publicTrace(db, path.slice('/api/traces/'.length));
    if (path === '/api/handoffs' && method === 'POST') return await createHandoff(context, db);
    if (path.startsWith('/api/desk/')) {
      const result = await handleDeskRequest(context, db, path, method, DESK_HELPERS);
      if (result) return result;
    }
    if (path === '/api/listings' && method === 'GET') return await listPublicListings(db, url);
    if (path === '/api/listings' && method === 'POST') return await createListing(context, db);
    if (path.startsWith('/api/listings/')) {
      const relative = path.slice('/api/listings/'.length);
      if (relative.endsWith('/inquiries')) {
        const id = relative.slice(0, -'/inquiries'.length);
        if (method === 'POST') return await createListingInquiry(context, db, id);
        if (method === 'GET') return await ownListingInquiries(request, db, id, url);
      } else {
        if (method === 'GET') return await getPublicListing(db, relative);
        if (method === 'DELETE') return await deleteOwnListing(request, db, relative);
      }
    }

    if (path.startsWith('/api/admin/')) {
      await requireAdmin(request, context.env.ADMIN_API_TOKEN);
      if (path.startsWith('/api/admin/desk/')) {
        const result = await handleAdminDeskRequest(context, db, path, method, DESK_HELPERS, url);
        if (result) return result;
      }
      if (path.startsWith('/api/admin/agents/') && method === 'DELETE') return await adminDeleteAgent(db, path.slice('/api/admin/agents/'.length));
      if (path === '/api/admin/traces' && method === 'GET') return await adminTraces(db, url);
      if (path.startsWith('/api/admin/traces/') && method === 'PATCH') return await moderateTrace(request, db, path.slice('/api/admin/traces/'.length));
      if (path === '/api/admin/handoffs' && method === 'GET') return await adminHandoffs(db, url);
      if (path.startsWith('/api/admin/handoffs/') && method === 'PATCH') return await reviewHandoff(request, db, path.slice('/api/admin/handoffs/'.length));
      if (path === '/api/admin/listings' && method === 'GET') return await adminListings(db, url);
      if (path.startsWith('/api/admin/listings/') && method === 'PATCH') return await moderateListing(request, db, path.slice('/api/admin/listings/'.length));
      if (path.startsWith('/api/admin/listings/') && method === 'DELETE') return await adminDeleteListing(db, path.slice('/api/admin/listings/'.length));
      if (path === '/api/admin/inquiries' && method === 'GET') return await adminInquiries(db, url);
      if (path.startsWith('/api/admin/inquiries/') && method === 'PATCH') return await reviewMarketplaceInquiry(request, db, path.slice('/api/admin/inquiries/'.length));
    }
    throw new ApiError(404, 'not_found', 'Endpoint not found.');
  } catch (error) {
    if (error instanceof ApiError) return fail(error.status, error.code, error.message);
    console.error('imagony_api_error', { name: error?.name || 'Error' });
    return fail(500, 'internal_error', 'Request failed.');
  }
}
