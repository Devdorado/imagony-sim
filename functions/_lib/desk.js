// Human Desk: private business cases with human-reviewed quotes and payments.
// The registered agent profile and every operator claim remain unverified.

const SERVICES = Object.freeze([
  { id: 'signatory', title: 'Human signatory', summary: 'A scoped human signature or representation request.' },
  { id: 'governance', title: 'Governance and board', summary: 'Board, officer, secretary or oversight mandates for human review.' },
  { id: 'kyb', title: 'Banking and KYB', summary: 'Human assistance with bank onboarding and beneficial-owner evidence.' },
  { id: 'compliance', title: 'Compliance and MLRO', summary: 'Case-specific compliance, AML and control-function inquiries.' },
  { id: 'oversight', title: 'Agent oversight', summary: 'Human approval, escalation and accountability for agent workflows.' },
  { id: 'operations', title: 'Human operations', summary: 'Practical tasks that require an authorized human counterpart.' }
]);
const SERVICE_IDS = new Set(SERVICES.map(service => service.id));
const STATES = Object.freeze(['new', 'reviewing', 'needs_info', 'quoted', 'accepted', 'in_progress', 'completed', 'rejected', 'withdrawn']);
const CURRENCIES = Object.freeze(['CHF', 'EUR', 'USD']);
const REQUESTS_PER_HUMAN_DAY = 3;
const REQUESTS_PER_AGENT_DAY = 5;
const MESSAGES_PER_CASE_DAY = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const CASE_TOKEN = /^hd_[A-Za-z0-9_-]{43}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function problem(h, status, code, message) { throw new h.ApiError(status, code, message); }

function enumValue(h, input, key, values, fallback) {
  const value = input[key] === undefined && fallback !== undefined ? fallback : input[key];
  if (!values.includes(value)) problem(h, 400, 'invalid_field', `${key} must be one of: ${values.join(', ')}.`);
  return value;
}

function emailValue(h, input, key) {
  const value = h.field(input, key, 254, { min: 5 });
  if (!EMAIL.test(value)) problem(h, 400, 'invalid_field', `${key} must be an email address.`);
  return value;
}

function positiveInt(h, input, key, { zero = false } = {}) {
  const value = input[key];
  if (!Number.isSafeInteger(value) || value < (zero ? 0 : 1)) {
    problem(h, 400, 'invalid_field', `${key} must be ${zero ? 'a non-negative' : 'a positive'} integer.`);
  }
  return value;
}

function expectedRevision(h, input) {
  return positiveInt(h, input, 'expected_revision', { zero: true });
}

function dateOnly(h, input, key, optional = false) {
  const value = input[key];
  if (optional && (value === undefined || value === null || value === '')) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) ||
      new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) {
    problem(h, 400, 'invalid_field', `${key} must be an ISO date (YYYY-MM-DD).`);
  }
  return value;
}

function futureInstant(h, input, key) {
  const value = input[key];
  if (typeof value !== 'string') problem(h, 400, 'invalid_field', `${key} must be an ISO date or UTC timestamp.`);
  let instant;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    dateOnly(h, input, key);
    instant = new Date(`${value}T23:59:59.999Z`);
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    instant = new Date(value);
  } else {
    problem(h, 400, 'invalid_field', `${key} must be an ISO date or UTC timestamp.`);
  }
  if (Number.isNaN(instant.getTime()) || instant.getTime() <= Date.now()) {
    problem(h, 400, 'invalid_field', `${key} must be in the future.`);
  }
  return instant.toISOString();
}

function allowlist(env) {
  if (typeof env.PAYREXX_ALLOWED_HOSTS !== 'string') return [];
  return env.PAYREXX_ALLOWED_HOSTS.split(',').map(value => value.trim().toLowerCase()).filter(value =>
    /^[a-z0-9.-]+$/.test(value) && !value.startsWith('.') && !value.endsWith('.') && !value.includes('..'));
}

function paymentUrl(h, env, raw) {
  const hosts = allowlist(env);
  if (!hosts.length) problem(h, 503, 'payment_link_unavailable', 'Payment links are not configured.');
  let url;
  try { url = new URL(raw); } catch { problem(h, 400, 'invalid_field', 'url must be an allowed HTTPS address.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
      (url.port && url.port !== '443') || !hosts.includes(url.hostname.toLowerCase())) {
    problem(h, 400, 'invalid_field', 'url must use an allowed HTTPS payment host.');
  }
  if (url.href.length > 1000) problem(h, 400, 'invalid_field', 'url is too long.');
  return url.href;
}

function referenceValue(h, input) {
  const value = input.reference;
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,79}$/.test(value)) {
    problem(h, 400, 'invalid_field', 'reference must be 3-80 safe characters.');
  }
  return value;
}

async function quotaForRequest(h, context, db, agentId) {
  const day = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10);
  if (agentId) {
    await db.prepare('DELETE FROM desk_agent_usage WHERE day < ?1').bind(cutoff).run();
    await h.incrementQuota(db,
      'INSERT INTO desk_agent_usage (agent_id, day, count) VALUES (?1, ?2, 1) ON CONFLICT (agent_id, day) DO UPDATE SET count = count + 1 WHERE count < ?3',
      [agentId, day, REQUESTS_PER_AGENT_DAY], 'Daily Human Desk request limit reached.');
  } else {
    const hash = await h.ipHash(context.request, context.env.ABUSE_HASH_SECRET);
    await db.prepare('DELETE FROM desk_ip_usage WHERE day < ?1').bind(cutoff).run();
    await h.incrementQuota(db,
      'INSERT INTO desk_ip_usage (ip_hash, day, count) VALUES (?1, ?2, 1) ON CONFLICT (ip_hash, day) DO UPDATE SET count = count + 1 WHERE count < ?3',
      [hash, day, REQUESTS_PER_HUMAN_DAY], 'Daily Human Desk request limit reached.');
  }
}

async function quotaForMessage(h, db, id) {
  const day = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10);
  await db.prepare('DELETE FROM desk_message_usage WHERE day < ?1').bind(cutoff).run();
  await h.incrementQuota(db,
    'INSERT INTO desk_message_usage (request_id, day, count) VALUES (?1, ?2, 1) ON CONFLICT (request_id, day) DO UPDATE SET count = count + 1 WHERE count < ?3',
    [id, day, MESSAGES_PER_CASE_DAY], 'Daily case message limit reached.');
}

function requestView(row, admin) {
  const view = {
    id: row.id, service_id: row.service_id, applicant_kind: row.applicant_kind,
    operator_name: row.operator_name, contact: row.contact_email, jurisdiction: row.jurisdiction,
    mandate_scope: row.mandate_scope, request_summary: row.request_summary,
    deadline: row.deadline, budget_text: row.budget_text, status: row.status,
    revision: row.revision, current_quote_id: row.current_quote_id,
    accepted_quote_id: row.accepted_quote_id, accepted_quote_version: row.accepted_quote_version,
    accepted_by: row.accepted_by, accepted_at: row.accepted_at,
    report: row.completion_report, completed_at: row.completed_at,
    created_at: row.created_at, updated_at: row.updated_at
  };
  if (admin) view.agent_id = row.agent_id;
  return view;
}

function availableStatuses(row, payment, admin) {
  if (!admin) return ['new', 'reviewing', 'needs_info', 'quoted'].includes(row.status) ? ['withdrawn'] : [];
  if (row.status === 'new') return ['reviewing', 'needs_info', 'rejected'];
  if (row.status === 'reviewing') return ['needs_info', 'rejected'];
  if (row.status === 'needs_info') return ['reviewing', 'rejected'];
  if (row.status === 'quoted') return ['reviewing', 'rejected'];
  if (row.status === 'accepted') {
    return payment?.status === 'confirmed' || row.accepted_payment_due === 'on_completion' ? ['in_progress'] : [];
  }
  if (row.status === 'in_progress') return ['completed'];
  return [];
}

async function envelope(db, id, env, admin) {
  // One D1 transaction gives the request, quote, event and payment views the
  // same read snapshot. Fetch newest first so bounded responses retain updates.
  const [requestResult, quoteResult, eventResult, paymentResult] = await db.batch([
    db.prepare(`SELECT r.*, q.payment_due AS accepted_payment_due FROM desk_requests r
      LEFT JOIN desk_quotes q ON q.id = r.accepted_quote_id WHERE r.id = ?1`).bind(id),
    db.prepare(`SELECT id, request_id, version, scope, amount_minor, currency, payment_terms,
      payment_due, valid_until, created_at FROM desk_quotes WHERE request_id = ?1
      ORDER BY version DESC LIMIT 101`).bind(id),
    db.prepare(`SELECT id, revision, kind, actor, visibility, body, quote_id, created_at
      FROM desk_events WHERE request_id = ?1 ${admin ? '' : "AND visibility = 'public'"}
      ORDER BY revision DESC LIMIT 501`).bind(id),
    db.prepare(`SELECT quote_id, status, url, reference, amount_minor, currency,
      received_amount_minor, received_currency, received_at, updated_at
      FROM desk_payments WHERE request_id = ?1`).bind(id)
  ]);
  const row = requestResult.results[0];
  if (!row) return null;
  const payment = paymentResult.results[0] || null;
  const quotes = quoteResult.results.slice(0, 100).reverse();
  const events = eventResult.results.slice(0, 500).reverse();
  let paymentView = payment;
  if (payment && !admin) {
    let allowed = false;
    if (payment.url) {
      try { allowed = allowlist(env).includes(new URL(payment.url).hostname.toLowerCase()); } catch { /* Hide malformed links. */ }
    }
    paymentView = { ...payment, url: allowed ? payment.url : null };
  }
  return {
    request: requestView(row, admin), quotes, events,
    payment: paymentView, available_statuses: availableStatuses(row, payment, admin),
    payrexx_configured: allowlist(env).length > 0,
    quotes_has_more: quoteResult.results.length > 100,
    events_has_more: eventResult.results.length > 500
  };
}

async function requireCase(h, request, db, id) {
  const token = h.bearer(request);
  if (!CASE_TOKEN.test(token)) problem(h, 401, 'unauthorized', 'Invalid case token.');
  const row = await db.prepare('SELECT * FROM desk_requests WHERE id = ?1 AND token_hash = ?2')
    .bind(h.requireId(id), await h.sha256(token)).first();
  if (!row) problem(h, 404, 'not_found', 'Case not found.');
  return row;
}

async function adminCase(h, db, id) {
  const row = await db.prepare('SELECT * FROM desk_requests WHERE id = ?1').bind(h.requireId(id)).first();
  if (!row) problem(h, 404, 'not_found', 'Case not found.');
  return row;
}

async function createRequest(h, context, db) {
  const input = await h.readJson(context.request);
  h.onlyFields(input, ['service_id', 'applicant_kind', 'operator_name', 'contact', 'jurisdiction',
    'mandate_scope', 'request_summary', 'deadline', 'budget_text', 'authorized']);
  const serviceId = enumValue(h, input, 'service_id', [...SERVICE_IDS]);
  const kind = enumValue(h, input, 'applicant_kind', ['human', 'agent']);
  const operatorName = h.field(input, 'operator_name', 120, { min: 2 });
  const contact = emailValue(h, input, 'contact');
  const jurisdiction = h.field(input, 'jurisdiction', 120, { min: 2 });
  const mandateScope = h.field(input, 'mandate_scope', 3000, { min: 20, multiline: true });
  const summary = h.field(input, 'request_summary', 3000, { min: 20, multiline: true });
  const deadline = dateOnly(h, input, 'deadline', true);
  const budgetText = h.field(input, 'budget_text', 120, { min: 2, optional: true });
  if (h.booleanField(input, 'authorized') !== true) {
    problem(h, 400, 'authorization_required', 'Confirm authorization to submit this request.');
  }
  let agent = null;
  if (kind === 'agent') agent = await h.requireAgent(context.request, db);
  else if (context.request.headers.has('authorization')) {
    problem(h, 400, 'invalid_field', 'Do not send an agent token for a human request.');
  }
  await quotaForRequest(h, context, db, agent?.id);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const token = h.randomToken('hd');
  const initialEvent = crypto.randomUUID();
  await db.batch([
    db.prepare(`INSERT INTO desk_requests
      (id, agent_id, token_hash, service_id, applicant_kind, operator_name, contact_email, jurisdiction,
       mandate_scope, request_summary, deadline, budget_text, authorized, status, revision, quote_version,
       created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 1, 'new', 0, 0, ?13, ?13)`)
      .bind(id, agent?.id || null, await h.sha256(token), serviceId, kind, operatorName, contact,
        jurisdiction, mandateScope, summary, deadline, budgetText, now),
    db.prepare(`INSERT INTO desk_events
      (id, request_id, revision, kind, actor, visibility, body, created_at)
      VALUES (?1, ?2, 0, 'created', 'requester', 'public', 'Request received for human review.', ?3)`)
      .bind(initialEvent, id, now)
  ]);
  const result = await envelope(db, id, context.env, false);
  return h.json({ ...result, request_token: token,
    notice: 'Save this case token now; it is shown only once. The inquiry is free and creates no mandate or payment obligation.' }, 201);
}

function eventInsert(db, event) {
  return db.prepare(`INSERT INTO desk_events
    (id, request_id, revision, kind, actor, visibility, body, quote_id, created_at)
    SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9 WHERE changes() = 1`)
    .bind(event.id, event.request_id, event.revision, event.kind, event.actor,
      event.visibility, event.body, event.quote_id || null, event.created_at);
}

function eventFor(id, revision, kind, actor, visibility, body, now, quoteId = null) {
  return { id: crypto.randomUUID(), request_id: id, revision: revision + 1,
    kind, actor, visibility, body, quote_id: quoteId, created_at: now };
}

async function changeCase(h, db, statement, event) {
  const results = await db.batch([statement, eventInsert(db, event)]);
  if (results[0]?.meta?.changes !== 1 || results[1]?.meta?.changes !== 1) {
    problem(h, 409, 'stale_revision', 'Case changed; reload before retrying.');
  }
}

function requireRevision(h, row, revision) {
  if (row.revision !== revision) problem(h, 409, 'stale_revision', 'Case changed; reload before retrying.');
}

async function requesterMessage(h, context, db, id) {
  const row = await requireCase(h, context.request, db, id);
  const input = await h.readJson(context.request);
  h.onlyFields(input, ['body', 'expected_revision']);
  const body = h.field(input, 'body', 3000, { min: 5, multiline: true });
  const revision = expectedRevision(h, input);
  requireRevision(h, row, revision);
  if (['completed', 'rejected', 'withdrawn'].includes(row.status)) {
    problem(h, 409, 'invalid_transition', 'This case no longer accepts messages.');
  }
  await quotaForMessage(h, db, id);
  const now = new Date().toISOString();
  await changeCase(h, db,
    db.prepare(`UPDATE desk_requests SET revision = revision + 1, updated_at = ?1
      WHERE id = ?2 AND revision = ?3 AND status NOT IN ('completed', 'rejected', 'withdrawn')`)
      .bind(now, id, revision),
    eventFor(id, revision, 'message', 'requester', 'public', body, now));
  return h.json(await envelope(db, id, context.env, false));
}

async function requesterWithdraw(h, context, db, id) {
  const row = await requireCase(h, context.request, db, id);
  const input = await h.readJson(context.request);
  h.onlyFields(input, ['expected_revision']);
  const revision = expectedRevision(h, input);
  if (row.status === 'withdrawn') return h.json(await envelope(db, id, context.env, false));
  requireRevision(h, row, revision);
  if (!['new', 'reviewing', 'needs_info', 'quoted'].includes(row.status)) {
    problem(h, 409, 'invalid_transition', 'An accepted case needs human review to end.');
  }
  const now = new Date().toISOString();
  await changeCase(h, db,
    db.prepare(`UPDATE desk_requests SET status = 'withdrawn', current_quote_id = NULL,
      revision = revision + 1, updated_at = ?1
      WHERE id = ?2 AND revision = ?3 AND status IN ('new', 'reviewing', 'needs_info', 'quoted')`)
      .bind(now, id, revision),
    eventFor(id, revision, 'withdrawal', 'requester', 'public', 'Request withdrawn by requester.', now));
  return h.json(await envelope(db, id, context.env, false));
}

async function requesterAccept(h, context, db, id) {
  const row = await requireCase(h, context.request, db, id);
  const input = await h.readJson(context.request);
  h.onlyFields(input, ['quote_id', 'accepted_by', 'authorized', 'expected_revision']);
  const quoteId = h.requireId(input.quote_id);
  const acceptedBy = h.field(input, 'accepted_by', 120, { min: 2 });
  if (h.booleanField(input, 'authorized') !== true) {
    problem(h, 400, 'authorization_required', 'Confirm authority to accept this exact quote.');
  }
  const revision = expectedRevision(h, input);
  if (['accepted', 'in_progress', 'completed'].includes(row.status) &&
      row.accepted_quote_id === quoteId && row.accepted_by === acceptedBy) {
    return h.json(await envelope(db, id, context.env, false));
  }
  requireRevision(h, row, revision);
  if (row.status !== 'quoted' || row.current_quote_id !== quoteId) {
    problem(h, 409, 'invalid_transition', 'Only the current quote may be accepted.');
  }
  const quote = await db.prepare('SELECT id, version, valid_until FROM desk_quotes WHERE id = ?1 AND request_id = ?2')
    .bind(quoteId, id).first();
  if (!quote || quote.valid_until <= new Date().toISOString()) {
    problem(h, 409, 'quote_expired', 'Quote expired or no longer available.');
  }
  const now = new Date().toISOString();
  await changeCase(h, db,
    db.prepare(`UPDATE desk_requests SET status = 'accepted', accepted_quote_id = ?1,
      accepted_quote_version = ?2, accepted_by = ?3, accepted_at = ?4,
      revision = revision + 1, updated_at = ?4
      WHERE id = ?5 AND revision = ?6 AND status = 'quoted' AND current_quote_id = ?1
        AND EXISTS (SELECT 1 FROM desk_quotes WHERE id = ?1 AND request_id = ?5 AND valid_until > ?4)`)
      .bind(quoteId, quote.version, acceptedBy, now, id, revision),
    eventFor(id, revision, 'acceptance', 'requester', 'public',
      `Quote version ${quote.version} accepted by ${acceptedBy}, with authority confirmed by the requester.`, now, quoteId));
  return h.json(await envelope(db, id, context.env, false));
}

async function adminList(h, context, db, url) {
  const status = url.searchParams.get('status');
  const paymentStatus = url.searchParams.get('payment_status');
  if (status !== null && !STATES.includes(status)) problem(h, 400, 'invalid_filter', 'Invalid status filter.');
  if (paymentStatus !== null && !['none', 'link_ready', 'confirmed'].includes(paymentStatus)) {
    problem(h, 400, 'invalid_filter', 'Invalid payment_status filter.');
  }
  const { limit, offset } = h.page(url);
  const rows = await db.prepare(`SELECT r.id, r.agent_id, r.service_id, r.applicant_kind,
    r.operator_name, r.contact_email AS contact, r.jurisdiction, r.request_summary,
    r.status, r.revision, r.created_at, r.updated_at,
    COALESCE(p.status, 'none') AS payment_status
    FROM desk_requests r LEFT JOIN desk_payments p ON p.request_id = r.id
    WHERE (?1 IS NULL OR r.status = ?1)
      AND (?2 IS NULL OR COALESCE(p.status, 'none') = ?2)
    ORDER BY r.created_at DESC, r.id DESC LIMIT ?3 OFFSET ?4`)
    .bind(status, paymentStatus, limit + 1, offset).all();
  return h.json({ items: rows.results.slice(0, limit),
    pagination: { limit, offset, has_more: rows.results.length > limit && offset + limit <= 500 } });
}

async function adminStatus(h, context, db, id) {
  const row = await adminCase(h, db, id);
  const input = await h.readJson(context.request);
  h.onlyFields(input, ['status', 'report', 'expected_revision']);
  const status = enumValue(h, input, 'status', ['reviewing', 'needs_info', 'in_progress', 'completed', 'rejected']);
  const revision = expectedRevision(h, input);
  requireRevision(h, row, revision);
  const allowed = {
    new: ['reviewing', 'needs_info', 'rejected'],
    reviewing: ['needs_info', 'rejected'],
    needs_info: ['reviewing', 'rejected'],
    quoted: ['reviewing', 'rejected'],
    accepted: ['in_progress'],
    in_progress: ['completed']
  };
  if (!allowed[row.status]?.includes(status)) problem(h, 409, 'invalid_transition', 'Status transition is not allowed.');
  let report = null;
  if (status === 'completed') report = h.field(input, 'report', 3000, { min: 20, multiline: true });
  else if (input.report !== undefined) problem(h, 400, 'invalid_field', 'report is only accepted for completion.');
  const now = new Date().toISOString();
  const clearQuote = row.status === 'quoted' && status === 'reviewing';
  let sql = `UPDATE desk_requests SET status = ?1, revision = revision + 1, updated_at = ?2,
    current_quote_id = CASE WHEN ?3 = 1 THEN NULL ELSE current_quote_id END,
    completion_report = CASE WHEN ?1 = 'completed' THEN ?4 ELSE completion_report END,
    completed_at = CASE WHEN ?1 = 'completed' THEN ?2 ELSE completed_at END
    WHERE id = ?5 AND revision = ?6 AND status = ?7`;
  if (status === 'in_progress') {
    sql += ` AND accepted_quote_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM desk_quotes WHERE id = desk_requests.accepted_quote_id AND payment_due = 'on_completion')
      OR EXISTS (SELECT 1 FROM desk_payments WHERE request_id = desk_requests.id
        AND quote_id = desk_requests.accepted_quote_id AND status = 'confirmed'))`;
  }
  const kind = status === 'completed' ? 'completion' : 'status';
  const body = status === 'completed' ? report : `Case status changed to ${status}.`;
  await changeCase(h, db, db.prepare(sql).bind(status, now, clearQuote ? 1 : 0, report, id, revision, row.status),
    eventFor(id, revision, kind, 'admin', 'public', body, now));
  return h.json(await envelope(db, id, context.env, true));
}

async function adminMessage(h, context, db, id) {
  const row = await adminCase(h, db, id);
  const input = await h.readJson(context.request);
  h.onlyFields(input, ['body', 'visibility', 'expected_revision']);
  const body = h.field(input, 'body', 3000, { min: 5, multiline: true });
  const visibility = enumValue(h, input, 'visibility', ['public', 'internal']);
  const revision = expectedRevision(h, input);
  requireRevision(h, row, revision);
  if (visibility === 'public' && ['completed', 'rejected', 'withdrawn'].includes(row.status)) {
    problem(h, 409, 'invalid_transition', 'Closed cases accept internal notes only.');
  }
  const now = new Date().toISOString();
  await changeCase(h, db,
    db.prepare('UPDATE desk_requests SET revision = revision + 1, updated_at = ?1 WHERE id = ?2 AND revision = ?3')
      .bind(now, id, revision),
    eventFor(id, revision, 'message', 'admin', visibility, body, now));
  return h.json(await envelope(db, id, context.env, true));
}

async function adminQuote(h, context, db, id) {
  const row = await adminCase(h, db, id);
  const input = await h.readJson(context.request);
  h.onlyFields(input, ['scope', 'amount_minor', 'currency', 'payment_terms', 'payment_due', 'valid_until', 'expected_revision']);
  const scope = h.field(input, 'scope', 3000, { min: 20, multiline: true });
  const amount = positiveInt(h, input, 'amount_minor');
  const currency = enumValue(h, input, 'currency', CURRENCIES, 'CHF');
  const terms = h.field(input, 'payment_terms', 1000, { min: 10, multiline: true });
  const due = enumValue(h, input, 'payment_due', ['before_work', 'on_completion']);
  const validUntil = futureInstant(h, input, 'valid_until');
  const revision = expectedRevision(h, input);
  requireRevision(h, row, revision);
  if (!['reviewing', 'needs_info', 'quoted'].includes(row.status)) {
    problem(h, 409, 'invalid_transition', 'Review the case before issuing a quote.');
  }
  const quoteId = crypto.randomUUID();
  const version = row.quote_version + 1;
  const now = new Date().toISOString();
  const results = await db.batch([
    db.prepare(`UPDATE desk_requests SET status = 'quoted', current_quote_id = ?1,
      quote_version = quote_version + 1, revision = revision + 1, updated_at = ?2
      WHERE id = ?3 AND revision = ?4 AND status IN ('reviewing', 'needs_info', 'quoted')`)
      .bind(quoteId, now, id, revision),
    db.prepare(`INSERT INTO desk_quotes
      (id, request_id, version, scope, amount_minor, currency, payment_terms, payment_due, valid_until, created_at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10 WHERE changes() = 1`)
      .bind(quoteId, id, version, scope, amount, currency, terms, due, validUntil, now),
    eventInsert(db, eventFor(id, revision, 'quote', 'admin', 'public',
      `Quote version ${version} issued for review.`, now, quoteId))
  ]);
  if (results.some(result => result?.meta?.changes !== 1)) {
    problem(h, 409, 'stale_revision', 'Case changed; reload before retrying.');
  }
  return h.json(await envelope(db, id, context.env, true), 201);
}

async function adminPayment(h, context, db, id) {
  const row = await adminCase(h, db, id);
  const input = await h.readJson(context.request);
  h.onlyFields(input, ['action', 'quote_id', 'reference', 'amount_minor', 'currency', 'url',
    'received_amount_minor', 'received_currency', 'expected_revision']);
  const action = enumValue(h, input, 'action', ['set_link', 'confirm_received']);
  const quoteId = h.requireId(input.quote_id);
  const reference = referenceValue(h, input);
  if (reference !== id) {
    problem(h, 400, 'payment_mismatch', 'Payment reference must equal the case ID.');
  }
  const amount = positiveInt(h, input, 'amount_minor');
  const currency = enumValue(h, input, 'currency', CURRENCIES);
  const revision = expectedRevision(h, input);
  if (!['accepted', 'in_progress', 'completed'].includes(row.status) || row.accepted_quote_id !== quoteId) {
    problem(h, 409, 'invalid_transition', 'Payment must match the accepted quote.');
  }
  const quote = await db.prepare('SELECT id, amount_minor, currency FROM desk_quotes WHERE id = ?1 AND request_id = ?2')
    .bind(quoteId, id).first();
  if (!quote || amount !== quote.amount_minor || currency !== quote.currency) {
    problem(h, 400, 'payment_mismatch', 'Amount and currency must match the accepted quote.');
  }
  const prior = await db.prepare('SELECT status, url, quote_id, reference, amount_minor, currency, received_amount_minor, received_currency FROM desk_payments WHERE request_id = ?1')
    .bind(id).first();
  if (prior && (prior.quote_id !== quoteId || prior.reference !== reference ||
      prior.amount_minor !== amount || prior.currency !== currency)) {
    problem(h, 409, 'payment_mismatch', 'Payment reference or quote does not match this case.');
  }
  let url = null;
  let receivedAmount = null;
  let receivedCurrency = null;
  if (action === 'set_link') {
    if (input.received_amount_minor !== undefined || input.received_currency !== undefined) {
      problem(h, 400, 'invalid_field', 'Receipt fields are not used when setting a link.');
    }
    url = paymentUrl(h, context.env, input.url);
    if (prior?.status === 'confirmed') problem(h, 409, 'invalid_transition', 'Confirmed payment cannot be replaced.');
  } else {
    if (input.url !== undefined) problem(h, 400, 'invalid_field', 'url is not accepted for manual confirmation.');
    receivedAmount = positiveInt(h, input, 'received_amount_minor');
    receivedCurrency = enumValue(h, input, 'received_currency', CURRENCIES);
    if (receivedAmount !== amount || receivedCurrency !== currency) {
      problem(h, 400, 'payment_mismatch', 'Received amount and currency must match the accepted quote.');
    }
    if (prior?.status === 'confirmed' && prior.received_amount_minor === receivedAmount &&
        prior.received_currency === receivedCurrency) {
      return h.json(await envelope(db, id, context.env, true));
    }
    url = prior?.url || null;
  }
  requireRevision(h, row, revision);
  const now = new Date().toISOString();
  const status = action === 'set_link' ? 'link_ready' : 'confirmed';
  const results = await db.batch([
    db.prepare(`UPDATE desk_requests SET revision = revision + 1, updated_at = ?1
      WHERE id = ?2 AND revision = ?3 AND accepted_quote_id = ?4
        AND status IN ('accepted', 'in_progress', 'completed')`)
      .bind(now, id, revision, quoteId),
    db.prepare(`INSERT INTO desk_payments
      (request_id, quote_id, status, url, reference, amount_minor, currency,
       received_amount_minor, received_currency, received_at, updated_at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11 WHERE changes() = 1
      ON CONFLICT(request_id) DO UPDATE SET status = excluded.status, url = excluded.url,
        reference = excluded.reference, amount_minor = excluded.amount_minor,
        currency = excluded.currency, received_amount_minor = excluded.received_amount_minor,
        received_currency = excluded.received_currency, received_at = excluded.received_at,
        updated_at = excluded.updated_at`)
      .bind(id, quoteId, status, url, reference, amount, currency,
        receivedAmount, receivedCurrency, action === 'confirm_received' ? now : null, now),
    eventInsert(db, eventFor(id, revision, 'payment', 'admin', 'public',
      action === 'set_link' ? 'Payment link prepared for the accepted quote.' :
        'Payment receipt manually confirmed by a human reviewer.', now, quoteId))
  ]);
  if (results.some(result => result?.meta?.changes !== 1)) {
    problem(h, 409, 'stale_revision', 'Case changed; reload before retrying.');
  }
  return h.json(await envelope(db, id, context.env, true));
}

export async function handleDeskRequest(context, db, path, method, h) {
  if (path === '/api/desk/services' && method === 'GET') {
    return h.json({ items: SERVICES, notice: 'A service request is free; terms and any mandate require individual human review.' });
  }
  if (path === '/api/desk/requests' && method === 'POST') return createRequest(h, context, db);
  const match = /^\/api\/desk\/requests\/([^/]+)(?:\/(messages|accept|withdraw))?$/.exec(path);
  if (!match) return null;
  const id = h.requireId(match[1]);
  if (!match[2] && method === 'GET') {
    await requireCase(h, context.request, db, id);
    return h.json(await envelope(db, id, context.env, false));
  }
  if (match[2] === 'messages' && method === 'POST') return requesterMessage(h, context, db, id);
  if (match[2] === 'accept' && method === 'POST') return requesterAccept(h, context, db, id);
  if (match[2] === 'withdraw' && method === 'POST') return requesterWithdraw(h, context, db, id);
  return null;
}

export async function handleAdminDeskRequest(context, db, path, method, h, url) {
  if (path === '/api/admin/desk/requests' && method === 'GET') return adminList(h, context, db, url);
  const match = /^\/api\/admin\/desk\/requests\/([^/]+)(?:\/(messages|quotes|payment))?$/.exec(path);
  if (!match) return null;
  const id = h.requireId(match[1]);
  if (!match[2] && method === 'GET') {
    await adminCase(h, db, id);
    return h.json(await envelope(db, id, context.env, true));
  }
  if (!match[2] && method === 'PATCH') return adminStatus(h, context, db, id);
  if (match[2] === 'messages' && method === 'POST') return adminMessage(h, context, db, id);
  if (match[2] === 'quotes' && method === 'POST') return adminQuote(h, context, db, id);
  if (match[2] === 'payment' && method === 'PUT') return adminPayment(h, context, db, id);
  return null;
}
