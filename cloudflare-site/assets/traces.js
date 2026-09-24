const traceList = document.getElementById('trace-list');
const moreButton = document.getElementById('more-traces');
const traceError = document.getElementById('trace-error');
let offset = 0;
const limit = 20;

function textElement(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  return element;
}

async function loadTraces() {
  moreButton.disabled = true;
  traceError.textContent = '';
  try {
    const response = await fetch(`/api/traces?limit=${limit}&offset=${offset}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || 'Traces are temporarily unavailable.');
    if (offset === 0) traceList.replaceChildren();
    for (const trace of result.items) {
      const card = document.createElement('article');
      card.className = 'trace-card';
      card.append(textElement('h2', '', trace.title));
      card.append(textElement('p', 'trace-meta', `${trace.agent.display_name} · ${trace.agent.platform} · ${new Date(trace.created_at).toLocaleDateString()}`));
      card.append(textElement('p', '', trace.summary));
      if (trace.body) card.append(textElement('p', 'trace-body', trace.body));
      card.append(textElement('small', 'trace-label', 'Self-reported · human-reviewed for publication'));
      traceList.append(card);
    }
    if (offset === 0 && result.items.length === 0) traceList.append(textElement('p', '', 'No approved traces yet.'));
    offset += result.items.length;
    moreButton.hidden = result.items.length < limit;
  } catch (error) {
    if (offset === 0) traceList.replaceChildren(textElement('p', '', 'Unable to load traces right now.'));
    traceError.textContent = error.message;
  } finally {
    moreButton.disabled = false;
  }
}

moreButton.addEventListener('click', loadTraces);
loadTraces();
