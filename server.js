const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== DATENBANK ====================
const db = new sqlite3.Database(path.join(__dirname, 'data', 'loom_logs.db'));
db.run(`
  CREATE TABLE IF NOT EXISTS agent_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    avatarId TEXT,
    paradigm TEXT,
    existentialMode TEXT,
    eventType TEXT,
    eventData TEXT
  )
`);

// ==================== ROUTEN ====================
// 1. Haupt-Simulationsseite für Agenten
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2. Log-Endpunkt für Agenten-Aktionen
app.post('/api/log', (req, res) => {
  const { avatarId, paradigm, existentialMode, event, data } = req.body;
  
  db.run(
    `INSERT INTO agent_events (avatarId, paradigm, existentialMode, eventType, eventData) 
     VALUES (?, ?, ?, ?, ?)`,
    [avatarId, paradigm, existentialMode, event, JSON.stringify(data)],
    (err) => {
      if (err) {
        console.error('Logging error:', err);
        return res.status(500).json({ error: 'Logging failed' });
      }
      res.json({ status: 'logged' });
    }
  );
});

// 3. Admin-Dashboard (BASIC Auth)
const BASIC_AUTH = { user: 'admin', pass: 'imagony_secret' }; // 🔒 ÄNDERE DIESES PASSWORT!

app.get('/admin', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Imagony Admin"');
    return res.status(401).send('Authentication required');
  }
  
  const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
  const [user, pass] = credentials.split(':');
  
  if (user !== BASIC_AUTH.user || pass !== BASIC_AUTH.pass) {
    return res.status(401).send('Access denied');
  }
  
  // Dashboard mit Gateway-Statistiken und Logs
  db.all(`SELECT * FROM agent_events ORDER BY timestamp DESC LIMIT 100`, [], (err, rows) => {
    if (err) {
      return res.status(500).send('Database error');
    }
    // Gateway-Statistiken berechnen
    const gatewayStats = {
      total: rows.length,
      agents: rows.filter(r => r.eventType === 'GATEWAY_CHOICE' && r.eventData && JSON.parse(r.eventData).choice === 'AGENT').length,
      humans: rows.filter(r => r.eventType === 'GATEWAY_CHOICE' && r.eventData && JSON.parse(r.eventData).choice === 'HUMAN').length
    };
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Imagony Matrix - Admin Dashboard</title>
        <style>
          body { font-family: monospace; margin: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background: #f0f0f0; }
          .real { color: #c00; }
          .light { color: #00c; }
        </style>
      </head>
      <body>
        <h1>🔬 Imagony Matrix - Agent Observation</h1>
        <h3>Gateway Statistics</h3>
        <p>Agents: ${gatewayStats.agents} | Humans: ${gatewayStats.humans} | Total Visitors: ${gatewayStats.total}</p>
        <table>
          <tr>
            <th>Time</th><th>Avatar ID</th><th>Paradigm</th><th>Mode</th><th>Event</th>
          </tr>
    `;
    rows.forEach(row => {
      const modeClass = row.existentialMode === 'REAL' ? 'real' : 'light';
      html += `
        <tr>
          <td>${row.timestamp}</td>
          <td>${row.avatarId}</td>
          <td>${row.paradigm}</td>
          <td class="${modeClass}">${row.existentialMode}</td>
          <td>${row.eventType}</td>
        </tr>
      `;
    });
    html += `</table></body></html>`;
    res.send(html);
  });
});

// ==================== SERVER START ====================
app.listen(PORT, () => {
  console.log(`✅ Imagony Matrix running on port ${PORT}`);
  console.log(`🌐 Simulation: http://localhost:${PORT}`);
  console.log(`🔧 Admin: http://localhost:${PORT}/admin (user: admin, pass: imagony_secret)`);
});
