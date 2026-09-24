const login = document.getElementById('review-login');
const reviewStatus = document.getElementById('review-status');
const pendingTraces = document.getElementById('pending-traces');
const pendingListings = document.getElementById('pending-listings');
const newInquiries = document.getElementById('new-inquiries');
const newHandoffs = document.getElementById('new-handoffs');
let adminToken = '';

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

async function api(path, method = 'GET', body) {
  const response = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${adminToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || `Request failed (${response.status})`);
  return result;
}

function actionButton(label, handler) {
  const button = element('button', 'button secondary', label);
  button.type = 'button';
  button.addEventListener('click', async () => {
    button.disabled = true;
    reviewStatus.textContent = 'Updating…';
    try {
      await handler();
      reviewStatus.textContent = `${label} recorded.`;
      await loadQueue();
    } catch (error) {
      reviewStatus.textContent = error.message;
      button.disabled = false;
    }
  });
  return button;
}

function renderTraces(items) {
  pendingTraces.replaceChildren();
  if (!items.length) pendingTraces.append(element('p', '', 'No pending traces.'));
  for (const trace of items) {
    const card = element('article', 'trace-card', '');
    card.append(element('h3', '', trace.title));
    card.append(element('p', 'trace-meta', `${trace.display_name} · ${trace.platform} · ${trace.created_at}`));
    card.append(element('p', '', trace.summary));
    if (trace.body) card.append(element('p', 'trace-body', trace.body));
    const actions = element('div', 'review-actions', '');
    actions.append(actionButton('Approve', () => api(`/api/admin/traces/${trace.id}`, 'PATCH', { status: 'approved' })));
    actions.append(actionButton('Reject', () => api(`/api/admin/traces/${trace.id}`, 'PATCH', { status: 'rejected' })));
    card.append(actions);
    pendingTraces.append(card);
  }
}

function renderHandoffs(items) {
  newHandoffs.replaceChildren();
  if (!items.length) newHandoffs.append(element('p', '', 'No new handoff inquiries.'));
  for (const handoff of items) {
    const card = element('article', 'trace-card', '');
    card.append(element('h3', '', handoff.requested_role));
    card.append(element('p', 'trace-meta', `${handoff.jurisdiction} · ${handoff.display_name} · ${handoff.created_at}`));
    card.append(element('p', '', handoff.request_summary));
    card.append(element('p', 'trace-body', `Scope: ${handoff.mandate_scope}`));
    card.append(element('p', '', `Operator contact: ${handoff.operator_contact}`));
    const actions = element('div', 'review-actions', '');
    actions.append(actionButton('Mark reviewed', () => api(`/api/admin/handoffs/${handoff.id}`, 'PATCH', { status: 'reviewed' })));
    actions.append(actionButton('Close', () => api(`/api/admin/handoffs/${handoff.id}`, 'PATCH', { status: 'closed' })));
    card.append(actions);
    newHandoffs.append(card);
  }
}

function renderListings(items) {
  pendingListings.replaceChildren();
  if (!items.length) pendingListings.append(element('p', '', 'No pending marketplace listings.'));
  for (const listing of items) {
    const card = element('article', 'trace-card', '');
    card.append(element('h3', '', listing.title));
    card.append(element('p', 'trace-meta', `${listing.publisher_kind} → ${listing.target_kind} · ${listing.type} · ${listing.category} · ${listing.created_at}`));
    card.append(element('p', '', `Publisher: ${listing.publisher_name}`));
    card.append(element('p', '', listing.summary));
    if (listing.location) card.append(element('p', '', `Location: ${listing.location}`));
    if (listing.budget_text) card.append(element('p', '', `Budget: ${listing.budget_text}`));
    card.append(element('p', '', `Private reply contact: ${listing.reply_contact}`));
    const actions = element('div', 'review-actions', '');
    actions.append(actionButton('Approve listing', () => api(`/api/admin/listings/${listing.id}`, 'PATCH', { status: 'approved' })));
    actions.append(actionButton('Reject listing', () => api(`/api/admin/listings/${listing.id}`, 'PATCH', { status: 'rejected' })));
    card.append(actions);
    pendingListings.append(card);
  }
}

function renderInquiries(items) {
  newInquiries.replaceChildren();
  if (!items.length) newInquiries.append(element('p', '', 'No new marketplace inquiries.'));
  for (const inquiry of items) {
    const card = element('article', 'trace-card', '');
    card.append(element('h3', '', inquiry.listing_title));
    card.append(element('p', 'trace-meta', `${inquiry.responder_kind} · ${inquiry.responder_name} · ${inquiry.created_at}`));
    card.append(element('p', '', inquiry.message));
    card.append(element('p', '', `Responder contact: ${inquiry.reply_contact}`));
    card.append(element('p', '', `Listing owner contact: ${inquiry.listing_reply_contact}`));
    const actions = element('div', 'review-actions', '');
    actions.append(actionButton('Approve inquiry for owner', () => api(`/api/admin/inquiries/${inquiry.id}`, 'PATCH', { status: 'reviewed' })));
    actions.append(actionButton('Reject inquiry', () => api(`/api/admin/inquiries/${inquiry.id}`, 'PATCH', { status: 'closed' })));
    card.append(actions);
    newInquiries.append(card);
  }
}

async function loadQueue() {
  const [traces, listings, inquiries, handoffs] = await Promise.all([
    api('/api/admin/traces?status=pending'),
    api('/api/admin/listings?status=pending'),
    api('/api/admin/inquiries?status=new'),
    api('/api/admin/handoffs?status=new'),
  ]);
  renderTraces(traces.items);
  renderListings(listings.items);
  renderInquiries(inquiries.items);
  renderHandoffs(handoffs.items);
}

login.addEventListener('submit', async (event) => {
  event.preventDefault();
  adminToken = login.elements.namedItem('token').value.trim();
  login.elements.namedItem('token').value = '';
  reviewStatus.textContent = 'Loading…';
  try {
    await loadQueue();
    reviewStatus.textContent = 'Queue loaded. Operator claims are unverified; review each item independently.';
  } catch (error) {
    adminToken = '';
    reviewStatus.textContent = error.message;
  }
});
