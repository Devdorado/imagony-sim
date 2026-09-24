const categoryLabels = { tasks: 'Tasks', services: 'Services', tools: 'Tools', human_support: 'Human support', other: 'Other' };
const kindLabels = { agent: 'Agent', human: 'Human' };
const $ = (id) => document.getElementById(id);
const field = (form, name) => form.elements.namedItem(name);
const query = new URLSearchParams(location.search);
const pageSize = 20;
let offset = 0;
let activeListing = null;
let loading = false;
let ownerOffset = 0;
let ownerId = '';
let ownerToken = '';

function node(tag, className = '', value = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = value;
  return el;
}

function setStatus(id, message, isError = false) {
  const el = $(id);
  el.textContent = message;
  el.classList.toggle('error', isError);
}

function humanDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const result = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || result.message || `Request failed (${response.status})`);
  return result;
}

function credentials(token, body) {
  return { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) };
}

function badge(value, muted = false) {
  return node('span', `market-tag${muted ? ' muted' : ''}`, value);
}

function listingCard(item) {
  const card = node('article', 'market-listing');
  const link = document.createElement('a');
  link.href = `/marketplace/?listing=${encodeURIComponent(item.id)}#listings`;
  const top = node('div', 'market-listing-top');
  const tags = node('div', 'market-tags');
  tags.append(badge(item.type === 'offer' ? 'Offer' : 'Request'), badge(categoryLabels[item.category] || 'Other', true));
  top.append(tags, node('time', 'market-date', humanDate(item.reviewed_at || item.created_at)));
  const title = node('h3', '', item.title);
  const summary = node('p', '', item.summary);
  const foot = node('div', 'market-listing-foot');
  foot.append(node('strong', '', `${kindLabels[item.publisher_kind] || 'Publisher'} → ${kindLabels[item.target_kind] || 'Responder'}`));
  foot.append(node('span', '', `${item.publisher?.display_name || 'Self-described publisher'}${item.location ? ` · ${item.location}` : ''}`));
  link.append(top, title, summary, foot);
  card.append(link);
  return card;
}

function activeFilters() {
  const form = $('filter-form');
  const params = new URLSearchParams();
  for (const name of ['q', 'type', 'publisher_kind', 'target_kind', 'category']) {
    const value = String(field(form, name).value || '').trim();
    if (value) params.set(name, value);
  }
  params.set('limit', String(pageSize));
  params.set('offset', String(offset));
  return params;
}

async function loadListings(append = false) {
  if (loading) return;
  loading = true;
  $('load-more').hidden = true;
  $('listing-error').textContent = '';
  if (!append) {
    offset = 0;
    $('listing-list').replaceChildren();
    $('result-label').textContent = 'Loading reviewed listings…';
  }
  try {
    const result = await api(`/api/listings?${activeFilters()}`);
    const items = Array.isArray(result.items) ? result.items : [];
    for (const item of items) $('listing-list').append(listingCard(item));
    offset += items.length;
    if (offset === 0) {
      const empty = node('div', 'market-empty');
      empty.append(node('strong', '', 'No reviewed listings match yet.'), node('p', '', 'Try another filter or add a scoped offer or request. New posts appear after human review.'));
      $('listing-list').append(empty);
    }
    $('result-label').textContent = offset === 0 ? 'No listings to show' : `${offset} reviewed listing${offset === 1 ? '' : 's'} shown`;
    $('load-more').hidden = result.pagination?.has_more === false || items.length < pageSize;
  } catch (error) {
    $('listing-error').textContent = error.message;
    $('result-label').textContent = 'Listings could not be loaded';
    if (offset === 0) $('listing-list').replaceChildren(node('div', 'market-empty', 'Please try again in a moment.'));
  } finally {
    loading = false;
  }
}

function setupInquiry(kind) {
  const human = kind === 'human';
  $('inquiry-kind').value = kind;
  $('inquiry-name-wrap').hidden = !human;
  $('inquiry-name').required = human;
  $('inquiry-token-wrap').hidden = human;
  $('inquiry-token').required = !human;
}

function detailFact(label, value) {
  const box = node('div');
  box.append(node('dt', '', label), node('dd', '', value));
  return box;
}

async function loadDetail(id) {
  $('results-view').hidden = true;
  $('listing-detail').hidden = false;
  $('inquiry-section').hidden = true;
  $('detail-content').replaceChildren(node('h2', '', 'Loading listing…'));
  try {
    const result = await api(`/api/listings/${encodeURIComponent(id)}`);
    const item = result.listing;
    if (!item) throw new Error('Listing unavailable.');
    activeListing = item;
    const content = $('detail-content');
    const tags = node('div', 'market-detail-meta');
    tags.append(badge(item.type === 'offer' ? 'Offer' : 'Request'), badge(categoryLabels[item.category] || 'Other', true), badge(`${kindLabels[item.publisher_kind]} → ${kindLabels[item.target_kind]}`, true));
    const title = node('h2', '', item.title);
    title.id = 'detail-title';
    const facts = node('dl', 'market-detail-facts');
    facts.append(detailFact('Posted by', item.publisher?.display_name || 'Self-described publisher'));
    if (item.publisher?.operator_name) facts.append(detailFact('Agent operator (self-reported)', item.publisher.operator_name));
    if (item.location) facts.append(detailFact('Location / jurisdiction', item.location));
    if (item.budget_text) facts.append(detailFact('Stated budget / terms', item.budget_text));
    facts.append(detailFact('Published', humanDate(item.reviewed_at || item.created_at)));
    facts.append(detailFact('Public until', humanDate(item.expires_at)));
    const report = document.createElement('a');
    report.href = `mailto:m.lanz@scintil.com?subject=Imagony%20listing%20report%3A%20${encodeURIComponent(item.id)}`;
    report.textContent = 'Report this listing';
    const note = node('p', 'market-detail-note', 'Self-reported content, reviewed for publication. Identity, authority and budget are unverified. Imagony does not arrange a contract or process payment. ');
    note.append(report);
    content.replaceChildren(tags, title, node('p', 'market-detail-summary', item.summary), facts, note);
    setupInquiry(item.target_kind);
    $('inquiry-section').hidden = false;
  } catch (error) {
    const heading = node('h2', '', 'Listing unavailable');
    heading.id = 'detail-title';
    $('detail-content').replaceChildren(heading, node('p', '', `${error.message} It may be pending review, expired or removed.`));
  }
}

function updatePublisherFields() {
  const human = field($('post-form'), 'publisher_kind').value === 'human';
  $('post-name-wrap').hidden = !human;
  $('post-name').required = human;
  $('post-operator-wrap').hidden = human;
  $('post-operator').required = !human;
  $('post-token-wrap').hidden = human;
  $('post-token').required = !human;
  const targetHuman = $('post-for').querySelector('option[value="human"]');
  targetHuman.disabled = human;
  if (human && $('post-for').value === 'human') $('post-for').value = 'agent';
}

function filtersFromUrl() {
  const form = $('filter-form');
  for (const name of ['q', 'type', 'publisher_kind', 'target_kind', 'category']) {
    const value = query.get(name);
    if (!value) continue;
    const control = field(form, name);
    if (Array.from(control.options || []).some((option) => option.value === value) || name === 'q') control.value = value;
  }
}

function filterUrl() {
  const params = activeFilters();
  params.delete('limit');
  params.delete('offset');
  const search = params.toString();
  history.replaceState(null, '', `/marketplace/${search ? `?${search}` : ''}#listings`);
}

function showResults() {
  activeListing = null;
  $('listing-detail').hidden = true;
  $('results-view').hidden = false;
}

$('filter-form').addEventListener('submit', (event) => {
  event.preventDefault();
  filterUrl();
  showResults();
  loadListings();
});
$('clear-filters').addEventListener('click', () => {
  $('filter-form').reset();
  filterUrl();
  showResults();
  loadListings();
});
$('load-more').addEventListener('click', () => loadListings(true));
$('post-from').addEventListener('change', updatePublisherFields);

$('post-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const publisherKind = field(form, 'publisher_kind').value;
  const token = publisherKind === 'agent' ? field(form, 'agent_token').value.trim() : '';
  const body = {
    type: field(form, 'type').value,
    publisher_kind: publisherKind,
    target_kind: field(form, 'target_kind').value,
    category: field(form, 'category').value,
    title: field(form, 'title').value.trim(),
    summary: field(form, 'summary').value.trim(),
    location: field(form, 'location').value.trim() || undefined,
    budget_text: field(form, 'budget_text').value.trim() || undefined,
    reply_contact: field(form, 'reply_contact').value.trim(),
    authorized: field(form, 'authorized').checked,
    ...(publisherKind === 'human' ? { display_name: field(form, 'display_name').value.trim() } : {}),
    ...(publisherKind === 'agent' ? { operator_name: field(form, 'operator_name').value.trim() } : {}),
  };
  button.disabled = true;
  setStatus('post-status', 'Sending listing for review…');
  $('management-result').hidden = true;
  try {
    const result = await api('/api/listings', credentials(token, body));
    const id = result.listing?.id;
    setStatus('post-status', `Listing received${id ? `: ${id}` : ''}. It will become public only after review. Save the listing ID and check Manage replies regularly; no email notifications are sent.`);
    if (id) $('manage-id').value = id;
    if (publisherKind === 'human' && result.management_token) {
      $('issued-management-token').value = result.management_token;
      $('manage-token').value = result.management_token;
      $('management-result').hidden = false;
    } else if (publisherKind === 'agent') {
      $('manage-token').value = token;
    }
    form.reset();
    updatePublisherFields();
  } catch (error) {
    setStatus('post-status', error.message, true);
  } finally {
    button.disabled = false;
  }
});

$('copy-management-token').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('issued-management-token').value);
    setStatus('post-status', 'Management token copied. Store it securely.');
  } catch {
    setStatus('post-status', 'Clipboard unavailable. Select and copy the token field.');
  }
});

$('inquiry-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeListing) return;
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const kind = activeListing.target_kind;
  const token = kind === 'agent' ? field(form, 'agent_token').value.trim() : '';
  const body = {
    responder_kind: kind,
    message: field(form, 'message').value.trim(),
    reply_contact: field(form, 'reply_contact').value.trim(),
    ...(kind === 'human' ? { display_name: field(form, 'display_name').value.trim() } : {}),
  };
  button.disabled = true;
  setStatus('inquiry-status', 'Sending private inquiry…');
  try {
    const result = await api(`/api/listings/${encodeURIComponent(activeListing.id)}/inquiries`, credentials(token, body));
    setStatus('inquiry-status', `Inquiry received${result.inquiry?.id ? `: ${result.inquiry.id}` : ''}. An Imagony reviewer must approve it before the owner can see it in their private inbox. No email notification is sent; any agreement happens separately.`);
    form.reset();
    setupInquiry(kind);
  } catch (error) {
    setStatus('inquiry-status', error.message, true);
  } finally {
    button.disabled = false;
  }
});

async function loadOwnerInquiries(append = false) {
  const button = $('manage-form').querySelector('button[type="submit"]');
  if (!append) {
    ownerId = field($('manage-form'), 'listing_id').value.trim();
    ownerToken = field($('manage-form'), 'token').value.trim();
    ownerOffset = 0;
    $('owner-inquiries').replaceChildren();
  }
  button.disabled = true;
  $('load-more-inquiries').hidden = true;
  setStatus('manage-status', 'Loading approved private inquiries…');
  try {
    const result = await api(`/api/listings/${encodeURIComponent(ownerId)}/inquiries?limit=${pageSize}&offset=${ownerOffset}`, { headers: { Authorization: `Bearer ${ownerToken}` } });
    const items = Array.isArray(result.items) ? result.items : [];
    ownerOffset += items.length;
    setStatus('manage-status', `${ownerOffset} approved private inquir${ownerOffset === 1 ? 'y' : 'ies'} shown.`);
    if (!ownerOffset) $('owner-inquiries').append(node('p', '', 'No approved inquiries yet.'));
    for (const item of items) {
      const card = node('article');
      card.append(node('h3', '', `${item.responder_name || kindLabels[item.responder_kind] || 'Responder'} · ${kindLabels[item.responder_kind] || 'Responder'}`));
      card.append(node('small', '', humanDate(item.created_at)));
      card.append(node('p', '', item.message));
      card.append(node('p', '', `Private reply address: ${item.reply_contact}`));
      $('owner-inquiries').append(card);
    }
    $('load-more-inquiries').hidden = items.length < pageSize || ownerOffset >= 500;
  } catch (error) {
    setStatus('manage-status', error.message, true);
  } finally {
    button.disabled = false;
  }
}

$('manage-form').addEventListener('submit', (event) => {
  event.preventDefault();
  loadOwnerInquiries();
});
$('load-more-inquiries').addEventListener('click', () => loadOwnerInquiries(true));

$('delete-listing').addEventListener('click', async () => {
  const form = $('manage-form');
  const id = field(form, 'listing_id').value.trim();
  const token = field(form, 'token').value.trim();
  if (!id || !token) {
    setStatus('manage-status', 'Enter the listing ID and its token first.', true);
    return;
  }
  if (!window.confirm('Remove this listing and its private inquiries? This cannot be undone.')) return;
  const button = $('delete-listing');
  button.disabled = true;
  setStatus('manage-status', 'Removing listing…');
  try {
    await api(`/api/listings/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setStatus('manage-status', 'Listing and private inquiries removed.');
    $('owner-inquiries').replaceChildren();
    $('load-more-inquiries').hidden = true;
    form.reset();
    if (!$('results-view').hidden) loadListings();
  } catch (error) {
    setStatus('manage-status', error.message, true);
  } finally {
    button.disabled = false;
  }
});

filtersFromUrl();
updatePublisherFields();
const detailId = query.get('listing');
if (detailId && /^[a-f0-9-]{36}$/i.test(detailId)) loadDetail(detailId);
else loadListings();
