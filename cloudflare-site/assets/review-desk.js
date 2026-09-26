const LABELS = { new: 'Received', reviewing: 'Under review', needs_info: 'More information needed', quoted: 'Offer issued', accepted: 'Offer accepted', in_progress: 'In progress', completed: 'Completed', rejected: 'Declined', withdrawn: 'Withdrawn', link_ready: 'Payment requested', confirmed: 'Receipt confirmed' };
const SERVICES = { signatory: 'Signature & representation', governance: 'Board & secretariat', kyb: 'Bank & KYB onboarding', compliance: 'AML & compliance', oversight: 'Human review', operations: 'Operational support' };
const $ = id => document.getElementById(id);
function node(tag, value, className = '') { const n = document.createElement(tag); n.textContent = value; if (className) n.className = className; return n; }
function label(value) { return LABELS[value] || value || 'Not set'; }
function date(value) { return value ? new Date(value).toLocaleString() : 'Not set'; }
function money(amount, currency) { return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount / 100); }
function minor(value) { if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('Enter a positive amount with up to two decimal places.'); const result = Math.round(Number(value) * 100); if (!Number.isSafeInteger(result) || result <= 0) throw new Error('Enter a valid positive amount.'); return result; }
function field(form, name) { return form.elements.namedItem(name); }

export function createDeskReview(api) {
  let active = null;
  let activeId = '';
  let offset = 0;
  let busy = false;
  let generation = 0;
  let listSerial = 0;
  let caseSerial = 0;
  const pageSize = 20;
  const notify = (message, error = false) => { $('desk-review-status').textContent = message; $('desk-review-status').classList.toggle('error', error); };
  const url = suffix => `/api/admin/desk/requests/${encodeURIComponent(activeId)}${suffix}`;
  const baseStates = ['reviewing', 'needs_info', 'quoted'];

  function clear() {
    generation++;
    active = null; activeId = ''; offset = 0;
    $('desk-case').hidden = true;
    $('desk-case-summary').replaceChildren(); $('desk-case-report').replaceChildren();
    $('desk-events').replaceChildren(); $('desk-quotes').replaceChildren(); $('desk-payment-summary').replaceChildren();
    $('desk-request-list').replaceChildren(node('p', 'Enter your admin token to load requests.'));
    $('desk-previous').hidden = true; $('desk-next').hidden = true;
    for (const form of document.querySelectorAll('.desk-admin-card')) form.reset();
    notify('');
  }

  async function load() {
    const currentGeneration = generation;
    const serial = ++listSerial;
    const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
    for (const key of ['status', 'payment_status']) { const value = field($('desk-filters'), key).value; if (value) params.set(key, value); }
    const result = await api(`/api/admin/desk/requests?${params}`);
    if (currentGeneration !== generation || serial !== listSerial) return;
    const container = $('desk-request-list'); container.replaceChildren();
    if (!result.items.length) container.append(node('p', 'No requests match these filters.'));
    for (const item of result.items) {
      const row = node('article', '', 'desk-request-row');
      const copy = node('div', '');
      copy.append(node('strong', `${SERVICES[item.service_id] || item.service_id} · ${item.operator_name || item.display_name}`));
      copy.append(node('p', `${label(item.status)} · ${date(item.created_at)}`));
      copy.append(node('p', item.id));
      const button = node('button', 'Open request', 'button secondary'); button.type = 'button'; button.disabled = busy;
      button.addEventListener('click', async () => { if (busy) return; try { await open(item.id, true); } catch (error) { notify(error.message, true); } });
      row.append(copy, button); container.append(row);
    }
    $('desk-previous').hidden = offset === 0;
    $('desk-next').hidden = !result.pagination.has_more;
    window.imagonyMotion?.enhanceButtons(container);
  }

  async function open(id, focus = false) {
    if (id !== activeId) {
      $('desk-case').hidden = true;
      for (const form of document.querySelectorAll('.desk-admin-card')) form.reset();
    }
    active = null;
    activeId = id;
    const currentGeneration = generation;
    const serial = ++caseSerial;
    const data = await api(url(''));
    if (activeId !== id || currentGeneration !== generation || serial !== caseSerial) return;
    render(data);
    if (focus) $('desk-case-heading').focus();
  }

  function render(data) {
    active = data;
    const item = data.request;
    $('desk-case').hidden = false;
    $('desk-case-reference').textContent = item.id;
    $('desk-case-heading').textContent = `${SERVICES[item.service_id] || item.service_id} · ${label(item.status)}`;
    const details = node('dl', '');
    for (const [key, value] of [['Operator', item.operator_name], ['Applicant', item.display_name || item.applicant_kind], ['Jurisdiction', item.jurisdiction], ['Requested action', item.request_summary], ['Mandate scope', item.mandate_scope], ['Desired deadline', item.deadline || 'Not specified'], ['Budget indication', item.budget_text || 'Not specified'], ['Received', date(item.created_at)], ['Last updated', date(item.updated_at)]]) {
      details.append(node('dt', key), node('dd', value || 'Not specified'));
    }
    details.append(node('dt', 'Contact'));
    const contact = node('dd', ''); const email = node('a', item.contact); email.href = `mailto:${encodeURIComponent(item.contact)}?subject=${encodeURIComponent(`Imagony Human Desk ${item.id}`)}`; contact.append(email); details.append(contact);
    $('desk-case-summary').replaceChildren(details);
    $('desk-case-report').replaceChildren();
    if (item.report) { const report = node('div', '', 'desk-result-report'); report.append(node('strong', 'Completion report'), node('p', item.report)); $('desk-case-report').append(report); }
    $('desk-quotes').replaceChildren();
    if (!data.quotes.length) $('desk-quotes').append(node('p', 'No offer has been issued.'));
    for (const quote of data.quotes) {
      const card = node('article', '', 'desk-quote');
      card.append(node('strong', `Offer ${quote.version} · ${money(quote.amount_minor, quote.currency)}`));
      card.append(node('p', quote.scope)); card.append(node('p', quote.payment_terms));
      card.append(node('small', `Valid until ${date(quote.valid_until)} · Payment ${quote.payment_due === 'before_work' ? 'before work' : 'on completion'}`));
      if (quote.id === item.accepted_quote_id) card.append(node('p', 'Accepted offer', 'desk-tag'));
      else if (quote.id !== item.current_quote_id) card.append(node('p', 'Superseded', 'desk-tag'));
      else if (new Date(quote.valid_until) <= new Date()) card.append(node('p', 'Expired', 'desk-tag'));
      $('desk-quotes').append(card);
    }
    if (data.quotes_has_more) $('desk-quotes').prepend(node('p', 'Showing the most recent offers plus the current and accepted offer.'));
    $('desk-events').replaceChildren();
    for (const event of data.events) {
      const card = node('article', '', `desk-event ${event.visibility === 'internal' ? 'internal' : ''}`);
      card.append(node('small', `${date(event.created_at)} · ${event.actor} · ${event.visibility === 'internal' ? 'Internal note' : 'Visible to requester'}`));
      card.append(node('p', event.body || label(event.kind))); $('desk-events').append(card);
    }
    if (data.events_has_more) $('desk-events').prepend(node('p', 'Showing the most recent 500 updates. Earlier history remains in the business record.'));
    const payment = data.payment;
    $('desk-payment-summary').replaceChildren(node('p', payment ? `${label(payment.status)} · ${money(payment.amount_minor, payment.currency)} · Reference: ${payment.reference}` : 'No payment record.'));
    if (payment?.url) { const link = node('a', 'View saved Payrexx link'); link.href = payment.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; $('desk-payment-summary').append(link); }
    if (payment?.received_at) $('desk-payment-summary').append(node('p', `Manually confirmed ${date(payment.received_at)}`));
    const state = field($('desk-state-form'), 'status'); state.replaceChildren();
    for (const value of data.available_statuses || []) { const option = node('option', label(value)); option.value = value; state.append(option); }
    $('desk-state-form').hidden = !state.options.length;
    field($('desk-state-form'), 'report').required = state.value === 'completed';
    field($('desk-state-form'), 'report').disabled = state.value !== 'completed';
    const publicMessage = field($('desk-message-form'), 'visibility').querySelector('option[value="public"]');
    publicMessage.disabled = ['completed', 'rejected', 'withdrawn'].includes(item.status);
    if (publicMessage.disabled) field($('desk-message-form'), 'visibility').value = 'internal';
    $('desk-quote-form').hidden = !baseStates.includes(item.status) || Boolean(item.accepted_quote_id);
    const accepted = data.quotes.find(q => q.id === item.accepted_quote_id);
    $('desk-payment-form').hidden = !accepted;
    if (accepted) {
      field($('desk-payment-form'), 'reference').value = item.id;
      field($('desk-payment-form'), 'amount').value = (accepted.amount_minor / 100).toFixed(2);
      field($('desk-payment-form'), 'currency').value = accepted.currency;
      field($('desk-payment-form'), 'url').value = payment?.url || '';
      field($('desk-payment-form'), 'verified').checked = false;
    }
    $('desk-payment-config').textContent = data.payrexx_configured ? 'The approved Payrexx host is configured. Attach the exact payment link created for this accepted offer.' : 'Payrexx links are not enabled yet. Configure the approved account hostname when connecting Payrexx. Verified Payrexx receipts can be recorded even before a link hostname is configured.';
    field($('desk-payment-form'), 'action').querySelector('option[value="set_link"]').disabled = !data.payrexx_configured;
    if (!data.payrexx_configured) field($('desk-payment-form'), 'action').value = 'confirm_received';
    paymentFields();
    const validUntil = field($('desk-quote-form'), 'valid_until');
    if (!validUntil.value) { const future = new Date(Date.now() + 14 * 86400000); future.setMinutes(future.getMinutes() - future.getTimezoneOffset()); validUntil.value = future.toISOString().slice(0, 16); }
  }

  function paymentFields() {
    const form = $('desk-payment-form'); const confirm = field(form, 'action').value === 'confirm_received';
    field(form, 'url').required = !confirm; field(form, 'url').disabled = confirm;
    field(form, 'received_amount').required = confirm; field(form, 'received_amount').disabled = !confirm;
    field(form, 'verified').checked = false;
    const copy = form.querySelector('.desk-check');
    while (copy.childNodes.length > 1) copy.lastChild.remove();
    copy.append(document.createTextNode(confirm ? ' I verified the settled payment in Payrexx against this request, accepted offer, amount and currency.' : ' I checked that the Payrexx link uses this request reference and the accepted offer amount and currency.'));
  }

  async function mutate(form, suffix, method, body) {
    if (busy || !active) return;
    busy = true;
    document.querySelectorAll('.desk-review button').forEach(button => { button.disabled = true; });
    const selectedId = activeId; const currentGeneration = generation;
    notify('Saving…');
    try {
      const data = await api(url(suffix), method, { ...body, expected_revision: active.request.revision });
      if (currentGeneration !== generation) return;
      form.reset();
      if (data.request) render(data); else await open(selectedId);
      await load(); notify('Saved. Contact the requester manually if a response is needed.');
    } catch (error) {
      if (currentGeneration !== generation) return;
      if (error.status === 409) { try { await open(selectedId); } catch { /* Preserve the original failure. */ } }
      notify(`${error.message}${error.status === 409 ? ' Review the refreshed request before trying again.' : ''}`, true);
    } finally {
      busy = false;
      document.querySelectorAll('.desk-review button').forEach(button => { button.disabled = false; });
    }
  }

  function submit(id, build) {
    $(id).addEventListener('submit', async event => {
      event.preventDefault(); if (!active || busy) return;
      try { const [suffix, method, body] = build(event.currentTarget); await mutate(event.currentTarget, suffix, method, body); } catch (error) { notify(error.message, true); }
    });
  }
  submit('desk-message-form', form => ['/messages', 'POST', { body: field(form, 'body').value.trim(), visibility: field(form, 'visibility').value }]);
  submit('desk-state-form', form => ['', 'PATCH', { status: field(form, 'status').value, ...(field(form, 'status').value === 'completed' ? { report: field(form, 'report').value.trim() } : {}) }]);
  submit('desk-quote-form', form => ['/quotes', 'POST', { scope: field(form, 'scope').value.trim(), amount_minor: minor(field(form, 'amount').value), currency: field(form, 'currency').value, payment_terms: field(form, 'payment_terms').value.trim(), payment_due: field(form, 'payment_due').value, valid_until: new Date(field(form, 'valid_until').value).toISOString() }]);
  submit('desk-payment-form', form => {
    if (!active.request.accepted_quote_id) throw new Error('An accepted offer is required.');
    const action = field(form, 'action').value;
    return ['/payment', 'PUT', { action, quote_id: active.request.accepted_quote_id, reference: field(form, 'reference').value.trim(), amount_minor: minor(field(form, 'amount').value), currency: field(form, 'currency').value, ...(action === 'set_link' ? { url: field(form, 'url').value.trim() } : { received_amount_minor: minor(field(form, 'received_amount').value), received_currency: field(form, 'currency').value }) }];
  });
  field($('desk-state-form'), 'status').addEventListener('change', event => { field($('desk-state-form'), 'report').required = event.target.value === 'completed'; field($('desk-state-form'), 'report').disabled = event.target.value !== 'completed'; });
  field($('desk-payment-form'), 'action').addEventListener('change', paymentFields);
  $('desk-filters').addEventListener('submit', async event => { event.preventDefault(); if (busy) return; offset = 0; try { await load(); notify('Requests refreshed.'); } catch (error) { notify(error.message, true); } });
  $('desk-previous').addEventListener('click', async () => { if (busy) return; offset = Math.max(0, offset - pageSize); try { await load(); } catch (error) { notify(error.message, true); } });
  $('desk-next').addEventListener('click', async () => { if (busy) return; offset += pageSize; try { await load(); } catch (error) { offset -= pageSize; notify(error.message, true); } });
  $('desk-refresh-case').addEventListener('click', async () => { if (busy || !activeId) return; try { await open(activeId); notify('Request refreshed.'); } catch (error) { notify(error.message, true); } });
  return { load, clear };
}
