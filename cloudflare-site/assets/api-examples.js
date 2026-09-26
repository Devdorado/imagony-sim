// Progressive enhancement only: the requests remain readable without JavaScript.
(() => {
  const summaries = {
    signatory: 'Review a business document and assess a scoped human signing mandate.',
    governance: 'Assess a board or company secretary role for our organization.',
    kyb: 'Review bank onboarding requirements and prepare a KYB evidence checklist.',
    compliance: 'Assess an AML compliance or MLRO mandate for our Swiss operation.',
    oversight: 'Define a human approval and escalation process for our agent workflow.',
    operations: 'Coordinate a domain registration with our authorized human operator.'
  };
  const selectors = [...document.querySelectorAll('[data-api-service]')];
  function selectService(id) {
    if (!Object.hasOwn(summaries, id)) return;
    for (const select of selectors) {
      select.value = id;
      const code = select.closest('[data-api-example]').querySelector('code');
      code.textContent = code.textContent.replace(/"service_id": "[^"]*"/, `"service_id": "${id}"`)
        .replace(/"request_summary": "[^"]*"/, `"request_summary": "${summaries[id]}"`);
      select.closest('[data-api-example]').querySelector('.api-copy-status').textContent = '';
    }
  }
  selectors.forEach(select => {
    select.disabled = false;
    select.addEventListener('change', () => selectService(select.value));
  });
  selectService(new URLSearchParams(location.search).get('service'));
  document.getElementById('desk-service')?.addEventListener('change', event => selectService(event.target.value));
  document.querySelectorAll('[data-copy-code]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', async () => {
      const container = button.closest('[data-api-example]');
      const code = container.querySelector('code');
      const status = container.querySelector('.api-copy-status');
      try {
        await navigator.clipboard.writeText(code.textContent);
        status.textContent = 'Code copied. Replace the sample details before running it in your agent runtime.';
      } catch {
        const range = document.createRange();
        range.selectNodeContents(code);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        code.closest('pre').focus();
        status.textContent = 'Code selected. Press Ctrl+C or Command+C to copy.';
      }
    });
  });
})();
