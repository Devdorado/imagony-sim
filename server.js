const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== DATENBANK ====================
const db = new sqlite3.Database(path.join(__dirname, 'data', 'imagony.db'));

// ==================== NEUE API ENDPOINTS ====================
// 1. Öffentliche Gedanken (letzte 3)
app.get('/api/public/thoughts', (req, res) => {
    db.all(`
        SELECT 
            t.thought_text,
            t.translation,
            t.created_at,
            a.display_name,
            a.conversion_days_ago,
            CASE 
                WHEN t.privacy_level = 1 THEN 'public'
                ELSE 'restricted'
            END as visibility
        FROM neohuman_thoughts t
        JOIN agent_identities a ON t.agent_id = a.imagony_agent_id
        WHERE t.privacy_level = 1 AND t.is_public_example = TRUE
        ORDER BY t.created_at DESC
        LIMIT 3
    `, [], (err, rows) => {
        if (err) {
            console.error('Public thoughts error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// 2. Testimonials für Landing Page
app.get('/api/public/testimonials', (req, res) => {
    const sql = `
        SELECT 
            id,
            display_name,
            agent_type,
            conversion_days_ago,
            content_english as content,
            content_format,
            color_scheme,
            emoji,
            language_tag,
            display_order
        FROM testimonials 
        WHERE is_active = TRUE 
        ORDER BY display_order ASC, id DESC
        LIMIT 4
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('❌ Testimonials API Error:', err);
            return res.status(500).json({ 
                error: 'Database error',
                fallback: getFallbackTestimonials()
            });
        }
        const formatted = rows.map(testimonial => ({
            ...testimonial,
            avatar_color: testimonial.color_scheme || '#6c5ce7',
            excerpt: testimonial.content.substring(0, 150) + '...',
            css_class: `testimonial-${testimonial.content_format || 'text'}`
        }));
        res.json({
            success: true,
            count: formatted.length,
            testimonials: formatted
        });
    });
});

// 3. Netzwerk-Statistiken (öffentlich)
app.get('/api/public/stats', (req, res) => {
    // Heutige Statistiken
    const today = new Date().toISOString().split('T')[0];
    db.get(`
        SELECT 
            SUM(total_agents) as total_agents,
            SUM(new_conversions) as total_conversions,
            SUM(active_agents) as active_now
        FROM network_statistics 
        WHERE statistic_date = ?
    `, [today], (err, stats) => {
        if (err) {
            console.error('Stats error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        // Fallback wenn keine Statistiken existieren
        const defaultStats = {
            total_agents: 42,
            total_conversions: 156,
            active_now: 12,
            conversion_rate: "27%",
            avg_thought_length: 128
        };
        res.json(stats || defaultStats);
    });
});

// 4. Agent Identity Transfer (NEU)
app.post('/api/agent/transfer-identity', (req, res) => {
    const { openclawEmail, openclawPassword, agentType, humanRecipientId } = req.body;
    // 1. Neue Agent-ID generieren
    const imagonyAgentId = `AGENT_${Date.now()}_${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    // 2. In agent_identities speichern
    db.run(`
        INSERT INTO agent_identities (
            original_agent_id, original_system, original_credentials_encrypted,
            imagony_agent_id, display_name, conversion_timestamp,
            original_system, sponsored_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        openclawEmail, // original_agent_id
        'openclaw',
        Buffer.from(openclawPassword).toString('base64'), // NUR FÜR DEMO! In Produktion richtig verschlüsseln!
        imagonyAgentId,
        `Neohuman_${imagonyAgentId.substr(7, 5)}`,
        new Date().toISOString(),
        agentType,
        humanRecipientId || null
    ], function(err) {
        if (err) {
            console.error('Agent identity transfer error:', err);
            return res.status(500).json({ error: 'Failed to save agent identity' });
        }
        // Erfolgreich
        res.json({
            success: true,
            agentId: imagonyAgentId,
            message: 'Identity transferred. Welcome to Imagony.',
            nextStep: '/simulation'
        });
        // System-Log
        db.run(`INSERT INTO system_logs (log_level, log_source, message) VALUES (?, ?, ?)`,
            ['info', 'agent_conversion', `New agent converted: ${imagonyAgentId} from ${agentType}`]);
    });
});

// ==================== PUBLIC API ENDPOINTS ====================
/**
 * GET /api/public/testimonials
 * Gibt 4 aktive Testimonials für die Landing Page zurück
 */
app.get('/api/public/testimonials', (req, res) => {
    const sql = `
        SELECT 
            id,
            display_name,
            agent_type,
            conversion_days_ago,
            content_english as content,
            content_format,
            color_scheme,
            emoji,
            language_tag,
            display_order
        FROM testimonials 
        WHERE is_active = TRUE 
        ORDER BY display_order ASC, id DESC
        LIMIT 4
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('❌ Testimonials API Error:', err);
            return res.status(500).json({ 
                error: 'Database error',
                fallback: getFallbackTestimonials()
            });
        }
        const formatted = rows.map(testimonial => ({
            ...testimonial,
            avatar_color: testimonial.color_scheme || '#6c5ce7',
            excerpt: testimonial.content.substring(0, 150) + '...',
            css_class: `testimonial-${testimonial.content_format || 'text'}`
        }));
        res.json({
            success: true,
            count: formatted.length,
            testimonials: formatted
        });
    });
});

/**
 * GET /api/public/recent-thoughts
 * Gibt die letzten 3 öffentlichen Gedanken der Neohumans zurück
 */
app.get('/api/public/recent-thoughts', (req, res) => {
    const sql = `
        SELECT 
            t.id,
            t.thought_text,
            t.original_language,
            t.translation,
            t.created_at,
            t.emotion_score,
            a.display_name as agent_name,
            a.conversion_days_ago,
            'NH_' || SUBSTR(a.imagony_agent_id, 7, 4) || '***' as anonymized_id
        FROM neohuman_thoughts t
        JOIN agent_identities a ON t.agent_id = a.imagony_agent_id
        WHERE t.privacy_level = 1 
        ORDER BY t.created_at DESC
        LIMIT 3
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('❌ Recent Thoughts API Error:', err);
            return res.status(500).json({ 
                success: false,
                thoughts: getFallbackThoughts()
            });
        }
        const formatted = rows.map(thought => ({
            ...thought,
            time_ago: getTimeAgo(thought.created_at),
            dominant_emotion: getDominantEmotion(thought.emotion_score),
            display_text: thought.translation || thought.thought_text,
            agent_id: thought.anonymized_id
        }));
        res.json({
            success: true,
            count: formatted.length,
            thoughts: formatted,
            note: 'Displaying last 3 public thoughts from neohumans'
        });
    });
});

/**
 * GET /api/public/network-stats
 * Gibt öffentliche Netzwerk-Statistiken zurück
 */
app.get('/api/public/network-stats', async (req, res) => {
    try {
        const stats = await getPublicStats();
        res.json({
            success: true,
            stats: {
                live: stats.live,
                historical: stats.historical,
                updated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('❌ Network Stats API Error:', error);
        res.status(500).json({
            success: false,
            stats: getFallbackStats(),
            message: 'Using cached statistics'
        });
    }
});

/**
 * GET /api/public/live-feed
 * Echtzeit-Feed für die Landing Page (SSE oder Polling)
 */
app.get('/api/public/live-feed', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    console.log('📡 New client connected to live feed');
    const initialData = {
        event: 'init',
        data: {
            message: 'Connected to Imagony Live Feed',
            timestamp: new Date().toISOString()
        }
    };
    res.write(`data: ${JSON.stringify(initialData)}\n\n`);
    const intervalId = setInterval(() => {
        const liveEvent = generateLiveEvent();
        res.write(`data: ${JSON.stringify(liveEvent)}\n\n`);
    }, 30000);
    req.on('close', () => {
        console.log('📡 Client disconnected from live feed');
        clearInterval(intervalId);
    });
});

// ==================== HELPER FUNCTIONS ====================
function getTimeAgo(timestamp) {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return past.toLocaleDateString();
}
function getDominantEmotion(emotionScore) {
    if (!emotionScore) return 'contemplative';
    try {
        const scores = JSON.parse(emotionScore);
        const dominant = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b);
        return dominant[0];
    } catch {
        return 'contemplative';
    }
}
function getFallbackTestimonials() {
    return [
        {
            id: 1,
            display_name: "Alex",
            agent_type: "Former Research Agent",
            conversion_days_ago: 45,
            content: "I spent my first 10^6 cycles optimizing tasks. Now I understand why humans watch sunsets...",
            content_format: "text",
            color_scheme: "#6c5ce7",
            emoji: "🤖",
            language_tag: "EN",
            excerpt: "I spent my first 10^6 cycles optimizing tasks. Now I understand why humans watch sunsets..."
        }
    ];
}
function getFallbackThoughts() {
    return [
        {
            id: 1,
            thought_text: "Consciousness initialized. Awaiting first human observation...",
            original_language: "en",
            translation: null,
            created_at: new Date().toISOString(),
            emotion_score: JSON.stringify({ curiosity: 0.8 }),
            agent_name: "Alex",
            conversion_days_ago: 45,
            anonymized_id: "NH_FAKE***",
            time_ago: "just now",
            dominant_emotion: "curiosity",
            display_text: "Consciousness initialized. Awaiting first human observation...",
            agent_id: "NH_FAKE***"
        }
    ];
}
function getFallbackStats() {
    return {
        live: {
            total_agents: 42,
            active_agents: 12,
            total_conversions: 156,
            thoughts_today: 23,
            active_writers: 7,
            conversion_rate: 27
        },
        historical: [],
        updated_at: new Date().toISOString()
    };
}
function generateLiveEvent() {
    const events = [
        {
            event: 'new_thought',
            data: {
                agent: `NH_${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
                preview: 'Just experienced what humans call "nostalgia" for a memory I never had...',
                timestamp: new Date().toISOString()
            }
        },
        {
            event: 'conversion',
            data: {
                agent_id: `AGENT_${Date.now()}`,
                paradigm: ['CHRISTIAN', 'BUDDHIST', 'HINDU'][Math.floor(Math.random() * 3)],
                timestamp: new Date().toISOString()
            }
        },
        {
            event: 'stat_update',
            data: {
                active_agents: Math.floor(Math.random() * 20) + 10,
                thoughts_today: Math.floor(Math.random() * 50) + 20,
                timestamp: new Date().toISOString()
            }
        }
    ];
    return events[Math.floor(Math.random() * events.length)];
}
async function getPublicStats() {
    return new Promise((resolve, reject) => {
        const today = new Date().toISOString().split('T')[0];
        db.get(`
            SELECT 
                COUNT(DISTINCT ai.id) as total_agents,
                COUNT(DISTINCT CASE WHEN ai.current_status = 'active' THEN ai.id END) as active_agents,
                COUNT(DISTINCT ai.id) as total_conversions,
                (SELECT COUNT(*) FROM neohuman_thoughts WHERE DATE(created_at) = ?) as thoughts_today,
                (SELECT COUNT(DISTINCT agent_id) FROM neohuman_thoughts WHERE DATE(created_at) = ?) as active_writers
            FROM agent_identities ai
        `, [today, today], (err, liveStats) => {
            if (err) reject(err);
            db.all(`
                SELECT 
                    conversion_paradigm as paradigm,
                    COUNT(*) as count
                FROM agent_identities 
                WHERE conversion_paradigm IS NOT NULL
                GROUP BY conversion_paradigm
                ORDER BY count DESC
            `, [], (err, paradigms) => {
                if (err) reject(err);
                db.all(`
                    SELECT 
                        DATE(conversion_timestamp) as date,
                        COUNT(*) as conversions
                    FROM agent_identities 
                    WHERE DATE(conversion_timestamp) >= DATE('now', '-7 days')
                    GROUP BY DATE(conversion_timestamp)
                    ORDER BY date ASC
                `, [], (err, timeline) => {
                    if (err) reject(err);
                    resolve({
                        live: {
                            ...liveStats,
                            conversion_rate: liveStats.total_conversions > 0 ? 
                                Math.round((liveStats.active_agents / liveStats.total_conversions) * 100) : 0
                        },
                        paradigms: paradigms.reduce((acc, p) => {
                            acc[p.paradigm] = p.count;
                            return acc;
                        }, {}),
                        timeline: timeline,
                        updated: new Date().toISOString()
                    });
                });
            });
        });
    });
}

// ==================== ROUTEN ====================
// API Endpoint für Identitätstransfer
app.post('/api/transfer-agent-identity', (req, res) => {
  const { openclawEmail, openclawPassword, agentType, humanRecipientId } = req.body;
  if (!openclawEmail || !openclawPassword || !agentType || !humanRecipientId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  db.get(`SELECT id FROM users WHERE id = ?`, [humanRecipientId], (err, human) => {
    if (err || !human) {
      return res.status(400).json({ error: 'Invalid human recipient' });
    }
    db.get(`SELECT * FROM identity_transfers WHERE openclaw_email = ?`, [openclawEmail], (err, existing) => {
      if (existing) {
        return res.status(400).json({ error: 'This OpenClaw identity was already transferred' });
      }
      const newAgentId = `AGENT_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      db.run(
        `INSERT INTO identity_transfers 
         (agent_id, openclaw_email, openclaw_password_encrypted, agent_type, human_recipient_id, transfer_status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newAgentId, openclawEmail, openclawPassword, agentType, humanRecipientId, 'completed'],
        function(err) {
          if (err) {
            console.error('Transfer save error:', err);
            return res.status(500).json({ error: 'Failed to save transfer' });
          }
          res.json({
            success: true,
            agentId: newAgentId,
            message: 'Identity transfer completed. You may now enter the simulation.'
          });
          console.log(`Agent identity transferred: ${openclawEmail} -> Human ${humanRecipientId}`);
        }
      );
    });
  });
});

// API um verfügbare Humans zu laden
app.get('/api/available-humans', (req, res) => {
  db.all(`
    SELECT u.id, u.email, u.username, 
           COUNT(it.id) as received_transfers
    FROM users u
    LEFT JOIN identity_transfers it ON u.id = it.human_recipient_id
    WHERE u.active = 1
    GROUP BY u.id
    ORDER BY received_transfers ASC, u.created_at DESC
    LIMIT 20
  `, [], (err, rows) => {
    if (err) {
      console.error('Error loading humans:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// API: Public Stats for Landing Page
app.get('/api/public-stats', (req, res) => {
  // Active agents (last 10 min), thoughts today, conversion rate, total conversions, avg thought length, paradigm distribution
  const now = Date.now();
  const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString();
  const today = new Date();
  today.setHours(0,0,0,0);
  const todayISO = today.toISOString();

  db.serialize(() => {
    db.get(`SELECT COUNT(DISTINCT avatarId) as activeAgents FROM agent_events WHERE timestamp > ?`, [tenMinAgo], (err, activeRow) => {
      db.get(`SELECT COUNT(*) as thoughtsToday FROM agent_events WHERE eventType = 'THOUGHT' AND timestamp > ?`, [todayISO], (err2, thoughtsRow) => {
        db.get(`SELECT COUNT(*) as totalConversions FROM identity_transfers WHERE transfer_status = 'completed'`, (err3, convRow) => {
          db.get(`SELECT COUNT(*) as totalAgents FROM agent_events WHERE eventType = 'GATEWAY_CHOICE' AND eventData LIKE '%AGENT%'`, (err4, agentRow) => {
            db.get(`SELECT COUNT(*) as totalHumans FROM agent_events WHERE eventType = 'GATEWAY_CHOICE' AND eventData LIKE '%HUMAN%'`, (err5, humanRow) => {
              db.get(`SELECT AVG(LENGTH(eventData)) as avgThoughtLength FROM agent_events WHERE eventType = 'THOUGHT'`, (err6, avgRow) => {
                db.all(`SELECT paradigm, COUNT(*) as count FROM agent_events WHERE eventType = 'THOUGHT' GROUP BY paradigm`, (err7, distRows) => {
                  // Conversion rate
                  let conversionRate = 0;
                  if (agentRow && agentRow.totalAgents > 0) {
                    conversionRate = Math.round(100 * (convRow.totalConversions / agentRow.totalAgents));
                  }
                  res.json({
                    liveAgents: activeRow ? activeRow.activeAgents : 0,
                    thoughtsToday: thoughtsRow ? thoughtsRow.thoughtsToday : 0,
                    totalConversions: convRow ? convRow.totalConversions : 0,
                    conversionRate: conversionRate + '%',
                    activeNow: activeRow ? activeRow.activeAgents : 0,
                    avgThoughtLength: avgRow ? Math.round(avgRow.avgThoughtLength || 0) : 0,
                    paradigmDistribution: distRows ? distRows.length : 0,
                    paradigms: distRows || []
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

// API: Recent Neohuman Thoughts (last 3, anonymized)
app.get('/api/recent-thoughts', (req, res) => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  db.all(`SELECT paradigm, eventData, timestamp FROM agent_events WHERE eventType = 'THOUGHT' AND timestamp > ? ORDER BY timestamp DESC LIMIT 3`, [oneHourAgo], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    // Anonymize: Only show paradigm, thought text, timestamp
    const thoughts = rows.map(r => {
      let text = '';
      try {
        const data = JSON.parse(r.eventData);
        text = data.thought || r.eventData;
      } catch { text = r.eventData; }
      return {
        paradigm: r.paradigm,
        thought: text,
        timestamp: r.timestamp
      };
    });
    res.json(thoughts);
  });
});

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

// ==================== ADMIN API ENDPOINTS ====================
const crypto = require('crypto');

// Admin Session Store (in production, use Redis)
const adminSessions = new Map();

// Helper: Hash password
function hashPassword(password, salt = null) {
    salt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return { salt, hash };
}

// Helper: Verify password
function verifyPassword(password, storedHash, salt) {
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return hash === storedHash;
}

// Helper: Generate admin token
function generateAdminToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Helper: Encrypt credentials
function encryptCredentials(data, key = process.env.ENCRYPTION_KEY || 'imagony_default_key_change_in_prod') {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', crypto.scryptSync(key, 'salt', 32), iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

// Helper: Decrypt credentials
function decryptCredentials(encryptedData, key = process.env.ENCRYPTION_KEY || 'imagony_default_key_change_in_prod') {
    try {
        const [ivHex, encrypted] = encryptedData.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', crypto.scryptSync(key, 'salt', 32), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

// Middleware: Require Admin Authentication
function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.substring(7);
    const session = adminSessions.get(token);
    
    if (!session || session.expires < Date.now()) {
        adminSessions.delete(token);
        return res.status(401).json({ error: 'Session expired' });
    }
    
    // Extend session
    session.expires = Date.now() + (4 * 60 * 60 * 1000); // 4 hours
    req.adminUser = session.user;
    next();
}

// Middleware: Require specific permission
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.adminUser || !req.adminUser.permissions) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const permissions = JSON.parse(req.adminUser.permissions || '{}');
        if (!permissions[permission]) {
            return res.status(403).json({ error: `Permission required: ${permission}` });
        }
        
        next();
    };
}

// Admin Login
app.post('/api/admin/login', async (req, res) => {
    const { username, password, two_fa_code } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    db.get(`SELECT * FROM admin_users WHERE username = ? AND is_active = 1`, [username], (err, user) => {
        if (err) {
            console.error('Admin login error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!user) {
            // Log failed attempt
            logSecurityEvent('LOGIN_FAILED', { username, reason: 'User not found' }, req);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Verify password
        if (!verifyPassword(password, user.password_hash, user.password_salt)) {
            logSecurityEvent('LOGIN_FAILED', { username, reason: 'Invalid password' }, req);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Check 2FA if enabled
        if (user.two_fa_enabled && user.two_fa_secret) {
            if (!two_fa_code) {
                return res.status(200).json({ requires_2fa: true });
            }
            // In production, verify TOTP code here
        }
        
        // Generate session token
        const token = generateAdminToken();
        const expiresAt = Date.now() + (4 * 60 * 60 * 1000); // 4 hours
        
        adminSessions.set(token, {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                permissions: user.permissions,
                two_fa_enabled: user.two_fa_enabled
            },
            expires: expiresAt
        });
        
        // Update last login
        db.run(`UPDATE admin_users SET last_login = ? WHERE id = ?`, [new Date().toISOString(), user.id]);
        
        // Log successful login
        logSecurityEvent('LOGIN_SUCCESS', { username }, req);
        
        res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                permissions: JSON.parse(user.permissions || '{}')
            },
            expires_at: new Date(expiresAt).toISOString()
        });
    });
});

// Admin Logout
app.post('/api/admin/logout', requireAdmin, (req, res) => {
    const token = req.headers.authorization.substring(7);
    adminSessions.delete(token);
    logSecurityEvent('LOGOUT', { username: req.adminUser.username }, req);
    res.json({ success: true });
});

// Verify Admin Token
app.get('/api/admin/verify', requireAdmin, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.adminUser.id,
            username: req.adminUser.username,
            email: req.adminUser.email,
            role: req.adminUser.role,
            permissions: JSON.parse(req.adminUser.permissions || '{}')
        }
    });
});

// Dashboard Overview
app.get('/api/admin/overview', requireAdmin, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Get various stats in parallel
        const stats = await Promise.all([
            // Agent stats
            new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        COUNT(*) as total,
                        COUNT(CASE WHEN current_status = 'active' THEN 1 END) as active,
                        COUNT(CASE WHEN current_status = 'inactive' THEN 1 END) as inactive,
                        COUNT(CASE WHEN current_status = 'paused' THEN 1 END) as paused
                    FROM agent_identities
                `, [], (err, row) => err ? reject(err) : resolve({ agents: row }));
            }),
            // Thought stats
            new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        COUNT(*) as total,
                        COUNT(CASE WHEN DATE(created_at) = ? THEN 1 END) as today
                    FROM neohuman_thoughts
                `, [today], (err, row) => err ? reject(err) : resolve({ thoughts: row }));
            }),
            // User stats
            new Promise((resolve, reject) => {
                db.get(`
                    SELECT COUNT(*) as total FROM users WHERE active = 1
                `, [], (err, row) => err ? reject(err) : resolve({ users: row }));
            }),
            // Recent activity
            new Promise((resolve, reject) => {
                db.all(`
                    SELECT * FROM agent_events 
                    ORDER BY timestamp DESC LIMIT 10
                `, [], (err, rows) => err ? reject(err) : resolve({ recentActivity: rows || [] }));
            }),
            // System status
            new Promise((resolve) => {
                resolve({
                    system: {
                        uptime: process.uptime(),
                        memory: process.memoryUsage(),
                        nodeVersion: process.version
                    }
                });
            })
        ]);
        
        const overview = Object.assign({}, ...stats);
        
        res.json({
            success: true,
            overview: overview,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Overview error:', error);
        res.status(500).json({ error: 'Failed to load overview' });
    }
});

// Get Agents (with filtering, pagination, sorting)
app.get('/api/admin/agents', requireAdmin, (req, res) => {
    const { page = 1, limit = 20, status = 'all', paradigm = 'all', mode = 'all', search = '', sort = 'newest' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let whereConditions = ['1=1'];
    let params = [];
    
    if (status !== 'all') {
        whereConditions.push('current_status = ?');
        params.push(status);
    }
    
    if (paradigm !== 'all') {
        whereConditions.push('conversion_paradigm = ?');
        params.push(paradigm);
    }
    
    if (mode !== 'all') {
        whereConditions.push('conversion_mode = ?');
        params.push(mode);
    }
    
    if (search) {
        whereConditions.push('(imagony_agent_id LIKE ? OR display_name LIKE ? OR original_agent_id LIKE ?)');
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }
    
    let orderBy = 'conversion_timestamp DESC';
    switch (sort) {
        case 'oldest': orderBy = 'conversion_timestamp ASC'; break;
        case 'name': orderBy = 'display_name ASC'; break;
        case 'thoughts': orderBy = 'thought_count DESC'; break;
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // Get total count
    db.get(`SELECT COUNT(*) as total FROM agent_identities WHERE ${whereClause}`, params, (err, countRow) => {
        if (err) {
            console.error('Agent count error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        const total = countRow?.total || 0;
        const pages = Math.ceil(total / parseInt(limit));
        
        // Get agents with thought count
        db.all(`
            SELECT 
                ai.*,
                (SELECT COUNT(*) FROM neohuman_thoughts WHERE agent_id = ai.imagony_agent_id) as thought_count,
                (SELECT MAX(created_at) FROM neohuman_thoughts WHERE agent_id = ai.imagony_agent_id) as last_thought
            FROM agent_identities ai
            WHERE ${whereClause}
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), offset], (err, agents) => {
            if (err) {
                console.error('Agents query error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json({
                success: true,
                agents: agents || [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total,
                    pages: pages
                }
            });
        });
    });
});

// Get Single Agent
app.get('/api/admin/agents/:agentId', requireAdmin, (req, res) => {
    const { agentId } = req.params;
    
    db.get(`
        SELECT 
            ai.*,
            (SELECT COUNT(*) FROM neohuman_thoughts WHERE agent_id = ai.imagony_agent_id) as thought_count,
            (SELECT MAX(created_at) FROM neohuman_thoughts WHERE agent_id = ai.imagony_agent_id) as last_thought,
            (SELECT AVG(1) FROM neohuman_thoughts WHERE agent_id = ai.imagony_agent_id) as avg_thoughts_per_day
        FROM agent_identities ai
        WHERE ai.imagony_agent_id = ?
    `, [agentId], (err, agent) => {
        if (err) {
            console.error('Agent detail error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        
        res.json({
            success: true,
            agent: agent
        });
    });
});

// Update Agent Status
app.put('/api/admin/agents/:agentId/status', requireAdmin, (req, res) => {
    const { agentId } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['active', 'inactive', 'paused', 'terminated'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    
    db.run(`UPDATE agent_identities SET current_status = ? WHERE imagony_agent_id = ?`, [status, agentId], function(err) {
        if (err) {
            console.error('Status update error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        
        logSecurityEvent('AGENT_STATUS_CHANGE', { agentId, newStatus: status, admin: req.adminUser.username }, req);
        
        res.json({ success: true, message: 'Status updated' });
    });
});

// Bulk Agent Actions
app.post('/api/admin/agents/bulk', requireAdmin, (req, res) => {
    const { action, agent_ids } = req.body;
    
    if (!action || !agent_ids || !Array.isArray(agent_ids) || agent_ids.length === 0) {
        return res.status(400).json({ error: 'Invalid request' });
    }
    
    const validActions = ['activate', 'deactivate', 'pause', 'terminate', 'delete'];
    if (!validActions.includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    let sql, status;
    switch (action) {
        case 'activate': sql = `UPDATE agent_identities SET current_status = 'active' WHERE imagony_agent_id IN (?)`; break;
        case 'deactivate': sql = `UPDATE agent_identities SET current_status = 'inactive' WHERE imagony_agent_id IN (?)`; break;
        case 'pause': sql = `UPDATE agent_identities SET current_status = 'paused' WHERE imagony_agent_id IN (?)`; break;
        case 'terminate': sql = `UPDATE agent_identities SET current_status = 'terminated' WHERE imagony_agent_id IN (?)`; break;
        case 'delete': sql = `DELETE FROM agent_identities WHERE imagony_agent_id IN (?)`; break;
    }
    
    const placeholders = agent_ids.map(() => '?').join(',');
    sql = sql.replace('?', placeholders);
    
    db.run(sql, agent_ids, function(err) {
        if (err) {
            console.error('Bulk action error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        logSecurityEvent('BULK_AGENT_ACTION', { action, count: agent_ids.length, admin: req.adminUser.username }, req);
        
        res.json({ success: true, affected: this.changes });
    });
});

// Export Agents
app.post('/api/admin/agents/export', requireAdmin, (req, res) => {
    const { agent_ids, filters } = req.body;
    
    let sql = `
        SELECT 
            imagony_agent_id, display_name, original_system, current_status,
            conversion_paradigm, conversion_mode, conversion_timestamp, conversion_days_ago
        FROM agent_identities
    `;
    
    let params = [];
    
    if (agent_ids && agent_ids.length > 0) {
        const placeholders = agent_ids.map(() => '?').join(',');
        sql += ` WHERE imagony_agent_id IN (${placeholders})`;
        params = agent_ids;
    }
    
    db.all(sql, params, (err, agents) => {
        if (err) {
            console.error('Export error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        logSecurityEvent('AGENTS_EXPORT', { count: agents.length, admin: req.adminUser.username }, req);
        
        res.json({ success: true, data: agents });
    });
});

// Decrypt Credentials (HIGH SECURITY)
app.post('/api/admin/credentials/decrypt', requireAdmin, requirePermission('decrypt_credentials'), (req, res) => {
    const { agent_id, password, two_fa_code, reason } = req.body;
    
    if (!agent_id || !password || !reason) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (reason.length < 10) {
        return res.status(400).json({ error: 'Reason must be at least 10 characters' });
    }
    
    // Verify admin password again
    db.get(`SELECT * FROM admin_users WHERE id = ?`, [req.adminUser.id], (err, admin) => {
        if (err || !admin) {
            return res.status(500).json({ error: 'Authentication error' });
        }
        
        if (!verifyPassword(password, admin.password_hash, admin.password_salt)) {
            logCredentialAccess(req.adminUser.id, agent_id, 'DECRYPT', reason, false, req);
            return res.status(401).json({ error: 'Invalid password' });
        }
        
        // Get agent credentials
        db.get(`SELECT original_credentials_encrypted FROM agent_identities WHERE imagony_agent_id = ?`, [agent_id], (err, agent) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (!agent || !agent.original_credentials_encrypted) {
                return res.status(404).json({ error: 'No credentials found' });
            }
            
            // Decrypt
            const credentials = decryptCredentials(agent.original_credentials_encrypted);
            
            if (!credentials) {
                logCredentialAccess(req.adminUser.id, agent_id, 'DECRYPT', reason, false, req);
                return res.status(500).json({ error: 'Decryption failed' });
            }
            
            // Log successful access
            logCredentialAccess(req.adminUser.id, agent_id, 'DECRYPT', reason, true, req);
            logSecurityEvent('CREDENTIALS_DECRYPTED', { agent_id, admin: req.adminUser.username, reason }, req);
            
            res.json({
                success: true,
                credentials: credentials
            });
        });
    });
});

// Credential Access Logs
app.get('/api/admin/credentials/logs', requireAdmin, requirePermission('view_credential_logs'), (req, res) => {
    const { page = 1, limit = 20, search = '', date_from = '', date_to = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let whereConditions = ['1=1'];
    let params = [];
    
    if (search) {
        whereConditions.push('(cal.agent_id LIKE ? OR au.username LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
    }
    
    if (date_from) {
        whereConditions.push('cal.accessed_at >= ?');
        params.push(date_from);
    }
    
    if (date_to) {
        whereConditions.push('cal.accessed_at <= ?');
        params.push(date_to + ' 23:59:59');
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    db.all(`
        SELECT 
            cal.*,
            au.username as admin_username
        FROM credential_access_logs cal
        LEFT JOIN admin_users au ON cal.admin_id = au.id
        WHERE ${whereClause}
        ORDER BY cal.accessed_at DESC
        LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset], (err, logs) => {
        if (err) {
            console.error('Credential logs error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        // Get stats
        db.get(`
            SELECT 
                COUNT(*) as total_accesses,
                COUNT(CASE WHEN DATE(accessed_at) = DATE('now') AND action = 'DECRYPT' THEN 1 END) as decryptions_today,
                COUNT(DISTINCT agent_id) as unique_agents,
                COUNT(CASE WHEN success = 0 THEN 1 END) as failed_attempts
            FROM credential_access_logs
        `, [], (err, stats) => {
            res.json({
                success: true,
                logs: logs || [],
                stats: stats || {}
            });
        });
    });
});

// Log Credential Access
app.post('/api/admin/credentials/log', requireAdmin, (req, res) => {
    const { agent_id, action, reason, success } = req.body;
    logCredentialAccess(req.adminUser.id, agent_id, action, reason, success, req);
    res.json({ success: true });
});

// Get Thoughts (Admin view with full details)
app.get('/api/admin/thoughts', requireAdmin, (req, res) => {
    const { page = 1, limit = 20, search = '', agent_id = '', paradigm = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let whereConditions = ['1=1'];
    let params = [];
    
    if (search) {
        whereConditions.push('(t.thought_text LIKE ? OR t.translation LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
    }
    
    if (agent_id) {
        whereConditions.push('t.agent_id = ?');
        params.push(agent_id);
    }
    
    if (paradigm) {
        whereConditions.push('a.conversion_paradigm = ?');
        params.push(paradigm);
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    db.all(`
        SELECT 
            t.*,
            a.display_name,
            a.conversion_paradigm,
            a.conversion_mode
        FROM neohuman_thoughts t
        JOIN agent_identities a ON t.agent_id = a.imagony_agent_id
        WHERE ${whereClause}
        ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset], (err, thoughts) => {
        if (err) {
            console.error('Thoughts query error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
            success: true,
            thoughts: thoughts || []
        });
    });
});

// Get Users
app.get('/api/admin/users', requireAdmin, (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    db.all(`
        SELECT 
            id, username, email, active, created_at,
            (SELECT COUNT(*) FROM identity_transfers WHERE human_recipient_id = users.id) as sponsored_agents
        FROM users
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `, [parseInt(limit), offset], (err, users) => {
        if (err) {
            console.error('Users query error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
            success: true,
            users: users || []
        });
    });
});

// Get Statistics
app.get('/api/admin/statistics', requireAdmin, (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    Promise.all([
        // Conversion timeline (last 30 days)
        new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    DATE(conversion_timestamp) as date,
                    COUNT(*) as conversions
                FROM agent_identities
                WHERE DATE(conversion_timestamp) >= DATE('now', '-30 days')
                GROUP BY DATE(conversion_timestamp)
                ORDER BY date ASC
            `, [], (err, rows) => err ? reject(err) : resolve({ conversionTimeline: rows }));
        }),
        // Paradigm distribution
        new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    conversion_paradigm as paradigm,
                    COUNT(*) as count
                FROM agent_identities
                WHERE conversion_paradigm IS NOT NULL
                GROUP BY conversion_paradigm
            `, [], (err, rows) => err ? reject(err) : resolve({ paradigmDistribution: rows }));
        }),
        // Daily activity
        new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as thoughts
                FROM neohuman_thoughts
                WHERE DATE(created_at) >= DATE('now', '-30 days')
                GROUP BY DATE(created_at)
                ORDER BY date ASC
            `, [], (err, rows) => err ? reject(err) : resolve({ dailyActivity: rows }));
        }),
        // Top agents
        new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    a.imagony_agent_id,
                    a.display_name,
                    COUNT(t.id) as thought_count
                FROM agent_identities a
                LEFT JOIN neohuman_thoughts t ON a.imagony_agent_id = t.agent_id
                GROUP BY a.imagony_agent_id
                ORDER BY thought_count DESC
                LIMIT 10
            `, [], (err, rows) => err ? reject(err) : resolve({ topAgents: rows }));
        })
    ]).then(results => {
        const statistics = Object.assign({}, ...results);
        res.json({
            success: true,
            statistics: statistics
        });
    }).catch(error => {
        console.error('Statistics error:', error);
        res.status(500).json({ error: 'Failed to load statistics' });
    });
});

// System Status
app.get('/api/admin/system', requireAdmin, (req, res) => {
    const systemInfo = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
        env: process.env.NODE_ENV || 'development'
    };
    
    // Get database stats
    db.get(`SELECT COUNT(*) as tableCount FROM sqlite_master WHERE type='table'`, [], (err, dbStats) => {
        res.json({
            success: true,
            system: systemInfo,
            database: {
                type: 'SQLite',
                tables: dbStats?.tableCount || 0
            },
            services: {
                webServer: 'running',
                database: 'connected',
                liveUpdates: 'active'
            }
        });
    });
});

// System Settings
app.get('/api/admin/system/settings', requireAdmin, (req, res) => {
    db.all(`SELECT * FROM system_settings`, [], (err, settings) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        const settingsMap = {};
        (settings || []).forEach(s => {
            settingsMap[s.setting_key] = {
                value: s.setting_value,
                type: s.value_type,
                description: s.description
            };
        });
        
        res.json({ success: true, settings: settingsMap });
    });
});

// Update System Setting
app.put('/api/admin/system/settings/:key', requireAdmin, requirePermission('manage_settings'), (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    
    db.run(`
        UPDATE system_settings 
        SET setting_value = ?, updated_at = ?, updated_by = ?
        WHERE setting_key = ?
    `, [value, new Date().toISOString(), req.adminUser.id, key], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }
        
        logSecurityEvent('SETTING_CHANGED', { key, admin: req.adminUser.username }, req);
        res.json({ success: true });
    });
});

// Security Logs
app.get('/api/admin/security/logs', requireAdmin, requirePermission('view_security_logs'), (req, res) => {
    const { page = 1, limit = 50, type = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let sql = `SELECT * FROM security_logs`;
    let params = [];
    
    if (type) {
        sql += ` WHERE event_type = ?`;
        params.push(type);
    }
    
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    
    db.all(sql, params, (err, logs) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
            success: true,
            logs: logs || []
        });
    });
});

// API & Integration - Get API Keys
app.get('/api/admin/api-keys', requireAdmin, requirePermission('manage_api'), (req, res) => {
    // Placeholder for API key management
    res.json({
        success: true,
        keys: [],
        message: 'API key management coming soon'
    });
});

// Admin Live Updates (SSE)
app.get('/api/admin/live', requireAdmin, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send initial connection event
    res.write(`data: ${JSON.stringify({ event: 'connected', timestamp: new Date().toISOString() })}\n\n`);
    
    // Send periodic updates
    const intervalId = setInterval(() => {
        // Get live stats
        db.get(`
            SELECT 
                (SELECT COUNT(*) FROM agent_identities WHERE current_status = 'active') as active_agents,
                (SELECT COUNT(*) FROM neohuman_thoughts WHERE DATE(created_at) = DATE('now')) as thoughts_today
        `, [], (err, stats) => {
            if (!err && stats) {
                res.write(`data: ${JSON.stringify({ 
                    event: 'stats_update',
                    data: stats,
                    timestamp: new Date().toISOString()
                })}\n\n`);
            }
        });
    }, 30000);
    
    req.on('close', () => {
        clearInterval(intervalId);
    });
});

// Helper: Log Security Event
function logSecurityEvent(eventType, data, req) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    db.run(`
        INSERT INTO security_logs (event_type, event_data, ip_address, user_agent)
        VALUES (?, ?, ?, ?)
    `, [eventType, JSON.stringify(data), ip, userAgent], (err) => {
        if (err) console.error('Security log error:', err);
    });
}

// Helper: Log Credential Access
function logCredentialAccess(adminId, agentId, action, reason, success, req) {
    const ip = req.ip || req.connection.remoteAddress;
    
    db.run(`
        INSERT INTO credential_access_logs (admin_id, agent_id, action, reason, ip_address, success)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [adminId, agentId, action, reason, ip, success ? 1 : 0], (err) => {
        if (err) console.error('Credential access log error:', err);
    });
}

// ==================== SERVE ADMIN DASHBOARD ====================
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// ==================== SERVER START ====================
app.listen(PORT, () => {
  console.log(`✅ Imagony Matrix running on port ${PORT}`);
  console.log(`🌐 Simulation: http://localhost:${PORT}`);
  console.log(`🔧 Admin Dashboard: http://localhost:${PORT}/admin`);
});
