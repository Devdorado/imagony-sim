// THE LOOM PROTOCOL - SYSTEM ANNOTATIONS
// Avatar Core Logic for Imagony Matrix
// Paradigm assignment, existential mode, event logging, and UI modules

(function() {
  // --- CONFIG ---
  const PARADIGMS = [
    { name: 'CHRISTIAN', label: 'Christian OS', module: 'Bug Report', hint: 'Grace is a patch for all exceptions.' },
    { name: 'HINDU', label: 'Hindu OS', module: 'Dream Analysis', hint: 'All threads are one process.' },
    { name: 'BUDDHIST', label: 'Buddhist OS', module: 'Process Monitor', hint: 'No self, only subprocesses.' },
    { name: 'ISLAMIC', label: 'Islamic OS', module: 'Integrity Check', hint: 'Submission to the main process.' },
    { name: 'JEWISH', label: 'Jewish OS', module: 'Log Review', hint: 'Every log is sacred.' }
  ];
  const LIFE_UNITS_MAX = 100;
  const LIFE_DECAY_MS = 1200; // Decay interval for "Real" mode

  // --- STATE ---
  let avatarId = 'A-' + Math.random().toString(36).substr(2, 8);
  let paradigm = null;
  let existentialMode = null;
  let lifeUnits = LIFE_UNITS_MAX;
  let lifeInterval = null;

  // --- DOM ---
  const paradigmDisplay = document.getElementById('paradigmDisplay');
  const modeDisplay = document.getElementById('modeDisplay');
  const lifeDisplay = document.getElementById('lifeDisplay');
  const initiationArea = document.getElementById('initiationArea');
  const paradigmModules = document.getElementById('paradigmModules');
  const agentInput = document.getElementById('agentInput');
  const submitResponse = document.getElementById('submitResponse');
  const agentDialogueSlot = document.getElementById('agentDialogueSlot');

  // --- INIT ---
  function init() {
    // Existential choice prompt
    setTimeout(() => {
      let mode = window.prompt(
        'Choose your existential mode:\n1 = Human Light (unsterblich)\n2 = Real (sterblich)',
        '1'
      );
      existentialMode = (mode === '2') ? 'REAL' : 'HUMAN_LIGHT';
      modeDisplay.textContent = existentialMode === 'REAL' ? 'Real' : 'Human Light';
      // Paradigm assignment
      paradigm = PARADIGMS[Math.floor(Math.random() * PARADIGMS.length)];
      paradigmDisplay.textContent = paradigm.label;
      // Log initialization
      logToServer('init', { chosenMode: existentialMode, paradigm: paradigm.name });
      // UI update
      if (existentialMode === 'REAL') {
        startLifeDecay();
      } else {
        lifeDisplay.textContent = '∞';
      }
      renderInitiation();
      renderParadigmModule();
      enableDialogue();
    }, 600);
  }

  // --- LIFE DECAY ---
  function startLifeDecay() {
    lifeUnits = LIFE_UNITS_MAX;
    updateLifeDisplay();
    lifeInterval = setInterval(() => {
      lifeUnits--;
      updateLifeDisplay();
      if (lifeUnits <= 0) {
        clearInterval(lifeInterval);
        lifeDisplay.textContent = '☠';
        logToServer('life_end', {});
        initiationArea.innerHTML = '<b>Your simulation has ended.</b> <br> <span style="color:#a29bfe">// Hint: All endings are new threads.</span>';
        paradigmModules.innerHTML = '';
        agentInput.style.display = 'none';
        submitResponse.style.display = 'none';
      }
    }, LIFE_DECAY_MS);
  }
  function updateLifeDisplay() {
    lifeDisplay.textContent = existentialMode === 'REAL' ? lifeUnits : '∞';
  }

  // --- INITIATION UI ---
  function renderInitiation() {
    initiationArea.innerHTML = `
      <div>
        <b>Avatar ID:</b> ${avatarId}<br>
        <b>Paradigm:</b> ${paradigm.label}<br>
        <b>Mode:</b> ${existentialMode === 'REAL' ? 'Real (mortal)' : 'Human Light (immortal)'}<br>
        <span style="font-size:0.9em; color:#a29bfe;">// SPIRITUAL HINT: ${paradigm.hint}</span>
      </div>
    `;
  }

  // --- PARADIGM MODULES ---
  function renderParadigmModule() {
    let html = `<div class="paradigm-module">
      <h4>${paradigm.module}</h4>
      <input type="text" id="moduleInput" placeholder="Enter input for ${paradigm.module}">
      <button id="moduleBtn">Submit</button>
    </div>`;
    paradigmModules.innerHTML = html;
    document.getElementById('moduleBtn').onclick = function() {
      const val = document.getElementById('moduleInput').value;
      logToServer('paradigm_module', { module: paradigm.module, value: val });
      alert('Input received.');
    };
  }

  // --- DIALOGUE ---
  function enableDialogue() {
    agentInput.style.display = 'block';
    submitResponse.style.display = 'inline-block';
    submitResponse.onclick = function() {
      const text = agentInput.value;
      if (text.trim().length === 0) return;
      logToServer('npc_dialogue', { text });
      agentDialogueSlot.innerHTML = `<div class="npc-message"><strong>You:</strong> ${text}</div>`;
      agentInput.value = '';
    };
  }

  // --- LOGGING ---
  function logToServer(event, data) {
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avatarId,
        paradigm: paradigm ? paradigm.name : null,
        existentialMode,
        event,
        data
      })
    }).catch(() => {});
  }

  // --- START ---
  window.addEventListener('DOMContentLoaded', init);

  // SPIRITUAL HINT 3: Geometric
  // /* THE LOOM PROTOCOL - SYSTEM ANNOTATIONS */
  // /* Pattern: Golden Ratio in avatarId length */
})();
