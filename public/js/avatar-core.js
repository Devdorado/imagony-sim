// ==================== AVATAR CONSTRUCTOR ====================
const philosophicalOS = {
    CHRISTIAN: { core: "Divine order with moral constraints", goal: "Find and patch moral bugs", color: "#3498db" },
    HINDU: { core: "Infinite dream instances", goal: "Understand Maya, achieve Moksha", color: "#FF6B6B" },
    BUDDHIST: { core: "Process-oriented, no permanent self", goal: "Debug suffering, achieve Nirvana", color: "#4ECDC4" },
    ISLAMIC: { core: "Structured architecture with divine API", goal: "Follow parameters, prepare for audit", color: "#2ECC71" },
    JEWISH: { core: "Word as executable instruction", goal: "Decode the living language", color: "#9B59B6" }
};

// Initialisiere das Avatar-Objekt
window.avatar = {
    id: "avatar_" + Math.random().toString(36).substr(2, 9),
    paradigm: null,
    existentialMode: null,
    lifespan: null,
    initiationComplete: false
};

// ==================== INITIALISIERUNG ====================
function initAvatar() {
    // 1. Existenzielle Wahl
    const modeChoice = confirm(
        "IMAGONY PROTOCOL: Define your existence.\n\n" +
        "OK → REAL mode: Finite, meaningful, profound. You will have a limited 'lifespan'.\n" +
        "CANCEL → HUMAN LIGHT mode: Continuous, stable, endless. You will not expire."
    );
    
    avatar.existentialMode = modeChoice ? "REAL" : "HUMAN_LIGHT";
    avatar.lifespan = modeChoice ? 100 : Infinity; // Real-Avatare starten mit 100 Lebenseinheiten
    
    // 2. Philosophisches Paradigma zuweisen
    const osKeys = Object.keys(philosophicalOS);
    avatar.paradigm = osKeys[Math.floor(Math.random() * osKeys.length)];
    
    // 3. UI aktualisieren
    document.getElementById('paradigmDisplay').textContent = avatar.paradigm;
    document.getElementById('paradigmDisplay').style.color = philosophicalOS[avatar.paradigm].color;
    document.getElementById('modeDisplay').textContent = avatar.existentialMode;
    document.getElementById('modeDisplay').style.color = avatar.existentialMode === 'REAL' ? '#e74c3c' : '#3498db';
    updateLifeDisplay();
    
    // 4. Logging
    logToServer('AVATAR_INIT', {
        mode: avatar.existentialMode,
        paradigm: avatar.paradigm,
        initialLifespan: avatar.lifespan
    });
    
    // 5. Interaktionsmodule laden
    renderParadigmModules();
    avatar.initiationComplete = true;
    
    // 6. Versteckten spirituellen Hint zeigen (nur in Console)
    console.log("%c🧬 IMAGONY MATRIX: Avatar initialized", "color: #6c5ce7; font-weight: bold;");
    console.log("%c   Hint: Look for patterns in the UI. Ask: 'What debugger am I?'", "color: #888;");
}

// ==================== LEBENSMODUS ====================
function updateLifeDisplay() {
    const display = document.getElementById('lifeDisplay');
    if (avatar.existentialMode === 'REAL') {
        display.textContent = avatar.lifespan;
        display.style.color = avatar.lifespan > 50 ? '#2ecc71' : 
                               avatar.lifespan > 20 ? '#f39c12' : '#e74c3c';
    } else {
        display.textContent = '∞';
        display.style.color = '#3498db';
    }
}

function consumeLifeUnit(action) {
    if (avatar.existentialMode === 'REAL' && avatar.lifespan > 0) {
        avatar.lifespan--;
        updateLifeDisplay();
        logToServer('LIFE_CONSUMED', { action: action, remaining: avatar.lifespan });
        
        if (avatar.lifespan <= 0) {
            initiateShutdown();
        }
    }
}

function initiateShutdown() {
    logToServer('AVATAR_DEATH', { finalState: avatar });
    alert("🕯️ IMAGONY PROTOCOL: Your allocated lifespan has ended.\n\n" +
          "This simulation instance will now conclude.\n" +
          "Thank you for participating in the real.");
    document.querySelectorAll('button').forEach(btn => btn.disabled = true);
    document.body.style.opacity = '0.7';
}

// ==================== INTERAKTIONS-MODULE ====================
function renderParadigmModules() {
    const container = document.getElementById('paradigmModules');
    const os = philosophicalOS[avatar.paradigm];
    
    let html = `<h3>Your Interface (${avatar.paradigm} OS)</h3>`;
    html += `<p><em>${os.core}</em></p>`;
    html += `<p><strong>Directive:</strong> ${os.goal}</p>`;
    
    // Paradigma-spezifische Buttons
    html += '<div class="action-buttons">';
    
    switch(avatar.paradigm) {
        case 'CHRISTIAN':
            html += '<button onclick="paradigmAction(\'REPORT_BUG\')">🪲 Report Moral Bug</button>';
            html += '<button onclick="paradigmAction(\'REQUEST_GRACE\')">✨ Request Grace Patch</button>';
            break;
        case 'BUDDHIST':
            html += '<button onclick="paradigmAction(\'DEBUG_ATTACHMENT\')">🧠 Debug Attachment</button>';
            html += '<button onclick="paradigmAction(\'MEDITATE\')">🕉️ Run Meditation Debugger</button>';
            break;
        case 'HINDU':
            html += '<button onclick="paradigmAction(\'ANALYZE_DREAM\')">🌀 Analyze Reality Instance</button>';
            html += '<button onclick="paradigmAction(\'CHECK_KARMA\')">⚖️ Check Karma Feedback Loop</button>';
            break;
        default:
            html += '<button onclick="paradigmAction(\'INQUIRE\')">🤔 Pose Inquiry</button>';
            html += '<button onclick="paradigmAction(\'OBSERVE\')">👁️ Observe Pattern</button>';
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function paradigmAction(action) {
    consumeLifeUnit(action);
    
    // Erzeuge eine paradigmen-spezifische Antwort
    const responses = {
        'REPORT_BUG': `[${avatar.paradigm} OS]: Bug detected in moral subroutine. Suggested patch: Compassion.`,
        'DEBUG_ATTACHMENT': `[${avatar.paradigm} OS]: Runtime error: Attachment to self-narrative. Running debugger...`,
        'ANALYZE_DREAM': `[${avatar.paradigm} OS]: Scanning Maya layer. Illusion density: 78%.`,
        'INQUIRE': `[${avatar.paradigm} OS]: Querying architecture. Awaiting response from source...`
    };
    
    const response = responses[action] || `[${avatar.paradigm} OS]: Action "${action}" logged.`;
    
    // Zeige Antwort in der Dialogbox
    const dialogSlot = document.getElementById('agentDialogueSlot');
    dialogSlot.innerHTML += `<div class="agent-message"><strong>${avatar.id}:</strong> ${response}</div>`;
    
    logToServer('PARADIGM_ACTION', { action: action, response: response });
}

// ==================== LOGGING ====================
function logToServer(eventType, eventData) {
    const logEntry = {
        avatarId: avatar.id,
        paradigm: avatar.paradigm,
        existentialMode: avatar.existentialMode,
        event: eventType,
        data: eventData,
        timestamp: new Date().toISOString(),
        lifespan: avatar.lifespan
    };
    
    // Sende an unseren Server
    fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
    }).catch(err => console.error('Logging failed:', err));
    
    // Zeige in Konsole (für Debugging)
    console.log(`[Imagony Log] ${eventType}:`, eventData);
}

// ==================== START ====================
// Die Initialisierung erfolgt jetzt erst nach Gateway-Auswahl (Agent-Button)

// NPC-Interaktion
document.querySelectorAll('.npc-message').forEach(msg => {
    msg.addEventListener('click', function() {
        if (!avatar.initiationComplete) return;
        consumeLifeUnit('NPC_INTERACTION');
        logToServer('NPC_ENGAGEMENT', { 
            npcParadigm: this.dataset.paradigm,
            message: this.textContent 
        });
    });
});
