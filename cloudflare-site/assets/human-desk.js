const services = {
  signatory: 'Human signatory',
  governance: 'Governance and board',
  kyb: 'Banking and KYB',
  compliance: 'Compliance and MLRO',
  oversight: 'Agent oversight',
  operations: 'Human operations',
};
const statuses = {
  new: 'Received', reviewing: 'Under review', needs_info: 'More information needed',
  quoted: 'Quote ready', accepted: 'Quote accepted', in_progress: 'In progress',
  completed: 'Completed', rejected: 'Declined', withdrawn: 'Withdrawn',
};
const eventKinds = {
  created: 'Inquiry received', message: 'Case update', status: 'Status update',
  quote: 'Quote issued', acceptance: 'Quote accepted', withdrawal: 'Inquiry withdrawn',
  payment: 'Payment update', completion: 'Work completed',
};
const $ = (id) => document.getElementById(id);
const field = (form, name) => form.elements.namedItem(name);
let activeId = '';
let activeToken = '';
let currentEnvelope = null;
let caseGeneration = 0;
let operationBusy = false;
let displayedQuoteKey = '';

const operationButtons = [
  '#desk-request-form button[type="submit"]', '#desk-case-form button[type="submit"]',
  '#desk-refresh', '#desk-message-form button[type="submit"]',
  '#desk-accept-form button[type="submit"]', '#desk-withdraw', '#desk-close',
];

async function withOperationLock(work) {
  if (operationBusy) return null;
  operationBusy = true;
  for (const selector of operationButtons) document.querySelector(selector).disabled = true;
  try { return await work(); }
  finally {
    operationBusy = false;
    for (const selector of operationButtons) document.querySelector(selector).disabled = false;
  }
}

function clearCase({ clearAccess = false, clearIssued = true } = {}) {
  caseGeneration += 1;
  activeId = '';
  activeToken = '';
  currentEnvelope = null;
  displayedQuoteKey = '';
  $('desk-case-content').hidden = true;
  $('desk-case-title').textContent = 'Case';
  $('desk-case-meta').textContent = '';
  $('desk-case-badge').textContent = '';
  for (const id of ['desk-submission', 'desk-timeline', 'desk-quotes', 'desk-payment']) $(id).replaceChildren();
  $('desk-report').textContent = '';
  $('desk-report-card').hidden = true;
  $('desk-message-form').reset();
  $('desk-accept-form').reset();
  $('desk-agent-token').value = '';
  for (const id of ['desk-request-status', 'desk-case-status', 'desk-options-status', 'desk-message-status', 'desk-accept-status']) status(id, '');
  if (clearAccess) $('desk-case-form').reset();
  if (clearIssued) {
    $('desk-issued-id').value = '';
    $('desk-issued-token').value = '';
    $('desk-credentials').hidden = true;
    status('desk-copy-status', '');
  }
  return caseGeneration;
}

function identity() { return { id: activeId, token: activeToken, generation: caseGeneration }; }
function identityStillActive(value) {
  return value.generation === caseGeneration && value.id === activeId && value.token === activeToken;
}

function element(tag, className = '', content = '') {
  const item = document.createElement(tag);
  if (className) item.className = className;
  item.textContent = content;
  return item;
}

function status(id, message, isError = false) {
  const target = $(id);
  target.textContent = message;
  target.classList.toggle('error', isError);
}

async function api(path, { method = 'GET', token = '', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || result.message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return result;
}

function displayDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('en-CH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function displayDay(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('en-CH', { dateStyle: 'medium' }).format(date);
}

function displayMoney(minor, currency) {
  if (!Number.isSafeInteger(minor) || !['CHF', 'EUR', 'USD'].includes(currency)) return '';
  return new Intl.NumberFormat('en-CH', { style: 'currency', currency }).format(minor / 100);
}

function updateApplicant() {
  const agent = field($('desk-request-form'), 'applicant_kind').value === 'agent';
  $('desk-agent-token-wrap').hidden = !agent;
  $('desk-agent-token').required = agent;
}

function addFact(container, label, value, full = false) {
  if (value === null || value === undefined || value === '') return;
  const wrapper = element('div', full ? 'hd-full' : '');
  wrapper.append(element('dt', '', label), element('dd', '', String(value)));
  container.append(wrapper);
}

function renderSubmission(request) {
  const list = $('desk-submission');
  list.replaceChildren();
  addFact(list, 'Operator', request.operator_name);
  addFact(list, 'Contact', request.contact);
  addFact(list, 'Jurisdiction', request.jurisdiction);
  addFact(list, 'Preferred deadline', displayDay(request.deadline));
  addFact(list, 'Budget / constraints', request.budget_text);
  addFact(list, 'Task', request.request_summary, true);
  addFact(list, 'Proposed scope and authority', request.mandate_scope, true);
}

function renderEvents(data) {
  const list = $('desk-timeline');
  list.replaceChildren();
  const events = Array.isArray(data.events) ? data.events.filter((entry) => entry.visibility !== 'internal') : [];
  if (!events.length) list.append(element('li', '', 'No public updates yet.'));
  for (const entry of events) {
    const item = element('li');
    const actor = entry.actor === 'admin' ? 'Human Desk' : entry.actor === 'requester' ? 'You' : 'Case';
    item.append(element('strong', '', `${eventKinds[entry.kind] || 'Case update'} · ${actor}`));
    const time = element('time', '', displayDate(entry.created_at));
    if (entry.created_at) time.dateTime = entry.created_at;
    item.append(time);
    if (entry.body) item.append(element('p', '', entry.body));
    list.append(item);
  }
  $('desk-events-note').hidden = !data.events_has_more;
}

function quoteIsCurrent(quote, request) {
  return Boolean(request.current_quote_id && quote.id === request.current_quote_id);
}

function renderQuotes(data) {
  const list = $('desk-quotes');
  list.replaceChildren();
  const quotes = Array.isArray(data.quotes) ? data.quotes : [];
  if (!quotes.length) list.append(element('p', '', 'No quote has been issued. A reviewer may first ask for more information.'));
  for (const quote of [...quotes].reverse()) {
    const card = element('article', 'hd-quote');
    if (quoteIsCurrent(quote, data.request)) card.append(element('span', 'hd-quote-current', 'Current quote'));
    else if (quote.id === data.request.accepted_quote_id) card.append(element('span', 'hd-quote-current', 'Accepted quote'));
    card.append(element('h5', '', `Quote ${quote.version} · ${displayMoney(quote.amount_minor, quote.currency)}`));
    card.append(element('p', '', quote.scope));
    if (quote.payment_terms) card.append(element('p', '', `Payment terms: ${quote.payment_terms}`));
    card.append(element('small', '', `Payment timing: ${quote.payment_due === 'before_work' ? 'Before work' : 'On completion'} · Valid until ${displayDate(quote.valid_until)}`));
    list.append(card);
  }
  $('desk-quotes-note').hidden = !data.quotes_has_more;
  const current = quotes.find((quote) => quoteIsCurrent(quote, data.request));
  const quoteKey = current ? `${current.id}:${current.version}` : '';
  if (quoteKey !== displayedQuoteKey) {
    $('desk-accept-form').reset();
    displayedQuoteKey = quoteKey;
  }
  const canAccept = data.request.status === 'quoted' && current && new Date(current.valid_until).getTime() > Date.now();
  $('desk-accept-form').hidden = !canAccept;
  if (data.request.accepted_quote_id && data.request.accepted_by) {
    list.append(element('p', '', `Accepted by ${data.request.accepted_by} on ${displayDate(data.request.accepted_at)}.`));
  } else if (data.request.status === 'quoted' && current && !canAccept) {
    list.append(element('p', '', 'The current quote has expired. Ask for a new one in a case update.'));
  }
}

function renderPayment(payment) {
  const card = $('desk-payment-card');
  const content = $('desk-payment');
  content.replaceChildren();
  card.hidden = !payment;
  if (!payment) return;
  if (payment.status === 'confirmed') content.append(element('p', '', 'Payment recorded for this case.'));
  else content.append(element('p', '', 'A payment step has been recorded for this case. Use only the link shown here if one is available.'));
  const amount = displayMoney(payment.amount_minor, payment.currency);
  if (amount) content.append(element('p', '', `Amount: ${amount}`));
  if (payment.reference) content.append(element('p', '', `Reference: ${payment.reference}`));
  if (payment.received_amount_minor && payment.received_at) {
    content.append(element('p', '', `Recorded receipt: ${displayMoney(payment.received_amount_minor, payment.received_currency || payment.currency)} on ${displayDate(payment.received_at)}.`));
  }
  if (payment.status === 'link_ready' && payment.url) {
    try {
      const url = new URL(payment.url);
      if (url.protocol === 'https:') {
        const link = element('a', 'button secondary hd-payment-link', 'Open payment link ↗');
        link.href = url.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        content.append(link, element('p', 'hd-field-help', `External payment page: ${url.hostname}`));
      }
    } catch { /* Never turn an invalid URL into a link. */ }
  }
}

function renderCase(data, expected = identity()) {
  if (!identityStillActive(expected)) return false;
  if (!data?.request) throw new Error('Case data is unavailable.');
  if (data.request.id !== expected.id) throw new Error('Case response did not match the requested ID.');
  currentEnvelope = data;
  const request = data.request;
  $('desk-case-content').hidden = false;
  $('desk-case-title').textContent = services[request.service_id] || 'Human Desk case';
  $('desk-case-meta').textContent = `Case ${request.id} · Updated ${displayDate(request.updated_at)}`;
  $('desk-case-badge').textContent = statuses[request.status] || request.status;
  renderSubmission(request);
  renderEvents(data);
  renderQuotes(data);
  renderPayment(data.payment);
  $('desk-report-card').hidden = !request.report;
  $('desk-report').textContent = request.report || '';
  const canMessage = !['completed', 'rejected', 'withdrawn'].includes(request.status);
  $('desk-message-form').hidden = !canMessage;
  $('desk-message-closed').hidden = canMessage;
  $('desk-withdraw').hidden = !(Array.isArray(data.available_statuses) && data.available_statuses.includes('withdrawn'));
  return true;
}

async function refreshCase(expected = identity()) {
  if (!expected.id || !expected.token) throw new Error('Enter the case ID and token first.');
  const data = await api(`/api/desk/requests/${encodeURIComponent(expected.id)}`, { token: expected.token });
  if (!identityStillActive(expected)) return null;
  renderCase(data, expected);
  return data;
}

function caseBody(extra) {
  return { ...extra, expected_revision: currentEnvelope.request.revision };
}

async function mutate(path, body, statusId, busyMessage) {
  const expected = identity();
  if (!expected.id || !expected.token || !currentEnvelope) return null;
  status(statusId, busyMessage);
  try {
    const data = await api(`/api/desk/requests/${encodeURIComponent(expected.id)}/${path}`, { method: 'POST', token: expected.token, body });
    if (!identityStillActive(expected)) return null;
    renderCase(data, expected);
    return data;
  } catch (error) {
    if (!identityStillActive(expected)) return null;
    if (error.status === 409) {
      try { await refreshCase(expected); } catch { /* Keep the original conflict message. */ }
      status(statusId, `${error.message} The latest case status has been reloaded.`, true);
      status('desk-case-status', 'The case changed. Its latest status has been reloaded; review it before trying again.', true);
    } else {
      status(statusId, error.message, true);
    }
    return null;
  }
}

function setInitialQuery() {
  const query = new URLSearchParams(location.search);
  const service = query.get('service');
  if (service && services[service]) $('desk-service').value = service;
  const id = query.get('id');
  if (id && /^[a-f0-9-]{36}$/i.test(id)) $('desk-case-id').value = id;
}

$('desk-applicant').addEventListener('change', updateApplicant);

$('desk-request-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  await withOperationLock(async () => {
    const form = event.currentTarget;
    const kind = field(form, 'applicant_kind').value;
    const agentToken = kind === 'agent' ? field(form, 'agent_token').value.trim() : '';
    const body = {
      service_id: field(form, 'service_id').value,
      applicant_kind: kind,
      operator_name: field(form, 'operator_name').value.trim(),
      contact: field(form, 'contact').value.trim(),
      jurisdiction: field(form, 'jurisdiction').value.trim(),
      request_summary: field(form, 'request_summary').value.trim(),
      mandate_scope: field(form, 'mandate_scope').value.trim(),
      ...(field(form, 'deadline').value ? { deadline: field(form, 'deadline').value } : {}),
      ...(field(form, 'budget_text').value.trim() ? { budget_text: field(form, 'budget_text').value.trim() } : {}),
      authorized: field(form, 'authorized').checked,
    };
    const generation = clearCase({ clearAccess: true });
    status('desk-request-status', 'Sending your inquiry…');
    try {
      const data = await api('/api/desk/requests', { method: 'POST', token: agentToken, body });
      if (generation !== caseGeneration) return;
      if (!data.request?.id || !data.request_token) throw new Error(`The case may have been created${data.request?.id ? ` as ${data.request.id}` : ''}, but its token was not returned. Contact support with the case ID.`);
      activeId = data.request.id;
      activeToken = data.request_token;
      $('desk-issued-id').value = activeId;
      $('desk-issued-token').value = activeToken;
      $('desk-case-id').value = activeId;
      $('desk-case-token').value = activeToken;
      $('desk-credentials').hidden = false;
      renderCase(data, identity());
      status('desk-request-status', `Inquiry received: ${activeId}. Save the case token now; it will not be shown again. Check this page for updates.`);
      form.reset();
      updateApplicant();
      $('desk-credentials').scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch (error) {
      status('desk-request-status', error.message, true);
    }
  });
});

async function copyValue(inputId, label) {
  const value = $(inputId).value;
  try {
    await navigator.clipboard.writeText(value);
    status('desk-copy-status', `${label} copied. Keep the case token private.`);
  } catch {
    $(inputId).focus();
    $(inputId).select();
    status('desk-copy-status', `Clipboard unavailable. ${label} selected; copy it manually.`);
  }
}

$('desk-copy-id').addEventListener('click', () => copyValue('desk-issued-id', 'Case ID'));
$('desk-copy-token').addEventListener('click', () => copyValue('desk-issued-token', 'Case token'));
$('desk-download').addEventListener('click', () => {
  const id = $('desk-issued-id').value;
  const token = $('desk-issued-token').value;
  if (!id || !token) return;
  const content = `Imagony Human Desk private case reference\n\nCase ID: ${id}\nCase token: ${token}\n\nKeep this file private. Do not send the token by email or put it in a URL.\nCheck your case: https://imagony.com/human-desk/request/?id=${encodeURIComponent(id)}#case-status\n`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `imagony-human-desk-${/^[a-f0-9-]{36}$/i.test(id) ? id : 'case'}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status('desk-copy-status', 'Private reference downloaded to your device. Store it securely.');
});

$('desk-case-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  await withOperationLock(async () => {
    const id = field(event.currentTarget, 'id').value.trim();
    const token = field(event.currentTarget, 'token').value.trim();
    if (id !== activeId || token !== activeToken) clearCase();
    activeId = id;
    activeToken = token;
    status('desk-case-status', 'Opening private case…');
    try {
      await refreshCase(identity());
      status('desk-case-status', 'Private case loaded. Return here to check for updates.');
      $('desk-case-content').scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch (error) {
      clearCase({ clearIssued: false });
      status('desk-case-status', error.message, true);
    }
  });
});

$('desk-refresh').addEventListener('click', async () => {
  await withOperationLock(async () => {
    status('desk-options-status', 'Refreshing…');
    try {
      await refreshCase(identity());
      status('desk-options-status', 'Case status is up to date.');
    } catch (error) {
      status('desk-options-status', error.message, true);
    }
  });
});

$('desk-message-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  await withOperationLock(async () => {
    if (!currentEnvelope) return;
    const form = event.currentTarget;
    const body = caseBody({ body: field(form, 'body').value.trim() });
    const data = await mutate('messages', body, 'desk-message-status', 'Adding case update…');
    if (data) {
      form.reset();
      status('desk-message-status', 'Your update is in the private case timeline.');
    }
  });
});

$('desk-accept-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  await withOperationLock(async () => {
    if (!currentEnvelope) return;
    const form = event.currentTarget;
    const quote = currentEnvelope.quotes?.find((entry) => entry.id === currentEnvelope.request.current_quote_id);
    if (!quote) return status('desk-accept-status', 'No current quote is available. Refresh the case.', true);
    const body = caseBody({ quote_id: quote.id, accepted_by: field(form, 'accepted_by').value.trim(), authorized: field(form, 'authorized').checked });
    const data = await mutate('accept', body, 'desk-accept-status', 'Recording quote acceptance…');
    if (data) {
      form.reset();
      status('desk-options-status', 'Current quote accepted. Follow the case timeline for next steps.');
    }
  });
});

$('desk-withdraw').addEventListener('click', async () => {
  if (!currentEnvelope || operationBusy) return;
  if (!window.confirm('Withdraw this inquiry? Its current quote will no longer be available for acceptance.')) return;
  await withOperationLock(async () => {
    const data = await mutate('withdraw', caseBody({}), 'desk-options-status', 'Withdrawing inquiry…');
    if (data) status('desk-options-status', 'Inquiry withdrawn.');
  });
});

$('desk-close').addEventListener('click', () => {
  if (operationBusy) return;
  clearCase({ clearAccess: true });
  $('desk-request-form').reset();
  updateApplicant();
  const url = new URL(location.href);
  url.searchParams.delete('id');
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  status('desk-case-status', 'Case locked on this device. Enter its ID and token to reopen it.');
});

setInitialQuery();
updateApplicant();
