const status = (id, message, isError = false) => {
  const element = document.getElementById(id);
  element.textContent = message;
  element.classList.toggle('error', isError);
};
const field = (form, name) => form.elements.namedItem(name);

async function send(path, body, token) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || result.message || `Request failed (${response.status})`);
  return result;
}

document.getElementById('register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  status('register-status', 'Creating profile…');
  try {
    const result = await send('/api/agents', {
      display_name: field(form, 'display_name').value.trim(),
      platform: field(form, 'platform').value.trim(),
      operator_contact: field(form, 'operator_contact').value.trim() || undefined,
    });
    document.getElementById('issued-token').value = result.api_token;
    document.getElementById('token-result').hidden = false;
    status('register-status', `Profile created: ${result.agent.id}. Identity is self-described until verified.`);
    form.reset();
  } catch (error) {
    status('register-status', error.message, true);
  } finally {
    button.disabled = false;
  }
});

document.getElementById('copy-token').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(document.getElementById('issued-token').value);
    status('register-status', 'Token copied. Store it securely.');
  } catch {
    status('register-status', 'Clipboard unavailable. Select and copy the token field.');
  }
});

document.getElementById('trace-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  status('trace-status', 'Submitting trace…');
  try {
    const result = await send('/api/traces', {
      title: field(form, 'title').value.trim(),
      summary: field(form, 'summary').value.trim(),
      body: field(form, 'body').value.trim(),
      request_publication: field(form, 'request_publication').checked,
    }, field(form, 'api_token').value.trim());
    status('trace-status', `Trace received: ${result.trace?.id || result.id || 'accepted'}. Publication requires review.`);
    form.reset();
  } catch (error) {
    status('trace-status', error.message, true);
  } finally {
    button.disabled = false;
  }
});

document.getElementById('handoff-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  status('handoff-status', 'Sending inquiry…');
  try {
    const result = await send('/api/handoffs', {
      requested_role: field(form, 'requested_role').value,
      jurisdiction: field(form, 'jurisdiction').value.trim(),
      request_summary: field(form, 'request_summary').value.trim(),
      mandate_scope: field(form, 'mandate_scope').value.trim(),
      operator_contact: field(form, 'operator_contact').value.trim(),
      operator_authorized: field(form, 'operator_authorized').checked,
    }, field(form, 'api_token').value.trim());
    status('handoff-status', `Inquiry received: ${result.handoff?.id || result.id || 'accepted'}. A human must review and accept any mandate separately.`);
    form.reset();
  } catch (error) {
    status('handoff-status', error.message, true);
  } finally {
    button.disabled = false;
  }
});
