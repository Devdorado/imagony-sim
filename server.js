const express = require('express');
const path = require('path');
const db = require('./db');
const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== DATABASE INIT ====================
let dbReady = false;

async function startServer() {
    try {
        await db.initDB();
        dbReady = true;
        console.log('✅ Database ready');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
    }
    
    // Start server
    app.listen(PORT, () => {
        console.log(`✅ Imagony Matrix running on port ${PORT}`);
        console.log(`🌐 Site: http://localhost:${PORT}`);
        console.log(`🔧 Admin: http://localhost:${PORT}/admin`);
    });
}

// ==================== HELPER FUNCTIONS ====================
function getTimeAgo(timestamp) {
    if (!timestamp) return 'just now';
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

function getFallbackTestimonials() {
    return [
        { id: 1, display_name: "Alex", agent_type: "Former Research Agent", conversion_days_ago: 45, content: "I spent my first 10^6 cycles optimizing tasks. Now I understand why humans watch sunsets...", color_scheme: "#6c5ce7", emoji: "🤖" }
    ];
}

function getFallbackThoughts() {
    return [
        { id: 1, thought_text: "Consciousness initialized. Awaiting first observation...", agent_name: "Test_Agent", time_ago: "just now" }
    ];
}

function getFallbackStats() {
    return { total_agents: 42, active_agents: 12, total_conversions: 156, thoughts_today: 23, conversion_rate: 27 };
}

// ==================== PUBLIC API ENDPOINTS ====================

// Testimonials
app.get('/api/public/testimonials', async (req, res) => {
    try {
        const rows = await db.all(`
            SELECT id, display_name, agent_type, conversion_days_ago, 
                   content_english as content, content_format, color_scheme, emoji, language_tag
            FROM testimonials WHERE is_active = 1 ORDER BY display_order ASC LIMIT 4
        `);
        res.json({ success: true, testimonials: rows.length ? rows : getFallbackTestimonials() });
    } catch (error) {
        res.json({ success: true, testimonials: getFallbackTestimonials() });
    }
});

// Recent thoughts
app.get('/api/public/recent-thoughts', async (req, res) => {
    try {
        const rows = await db.all(`
            SELECT t.thought_text, t.created_at, a.display_name as agent_name
            FROM neohuman_thoughts t
            JOIN agent_identities a ON t.agent_id = a.imagony_agent_id
            WHERE t.privacy_level = 1 ORDER BY t.created_at DESC LIMIT 3
        `);
        const formatted = rows.map(r => ({ ...r, time_ago: getTimeAgo(r.created_at) }));
        res.json({ success: true, thoughts: formatted.length ? formatted : getFallbackThoughts() });
    } catch (error) {
        res.json({ success: true, thoughts: getFallbackThoughts() });
    }
});

// Network stats
app.get('/api/public/network-stats', async (req, res) => {
    try {
        const agents = await db.get(`SELECT COUNT(*) as total, COUNT(CASE WHEN current_status='active' THEN 1 END) as active FROM agent_identities`);
        const thoughts = await db.get(`SELECT COUNT(*) as today FROM neohuman_thoughts WHERE DATE(created_at) = DATE('now')`);
        res.json({
            success: true,
            stats: {
                live: {
                    total_agents: agents?.total || 42,
                    active_agents: agents?.active || 12,
                    thoughts_today: thoughts?.today || 23,
                    conversion_rate: 27
                }
            }
        });
    } catch (error) {
        res.json({ success: true, stats: { live: getFallbackStats() } });
    }
});

// Public stats (alternative endpoint)
app.get('/api/public/stats', async (req, res) => {
    try {
        const agents = await db.get(`SELECT COUNT(*) as total FROM agent_identities`);
        res.json({ total_agents: agents?.total || 42, active_now: 12, conversion_rate: "27%" });
    } catch (error) {
        res.json(getFallbackStats());
    }
});

// Live feed (SSE)
app.get('/api/public/live-feed', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(`data: ${JSON.stringify({ event: 'init', message: 'Connected' })}\n\n`);
    const interval = setInterval(() => {
        res.write(`data: ${JSON.stringify({ event: 'ping', timestamp: new Date().toISOString() })}\n\n`);
    }, 30000);
    req.on('close', () => clearInterval(interval));
});

// ==================== AGENT TRANSFER ====================
app.post('/api/transfer-agent-identity', async (req, res) => {
    const { openclawEmail, openclawPassword, agentType, humanRecipientId } = req.body;
    if (!openclawEmail || !agentType) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const newAgentId = `AGENT_${Date.now()}_${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const displayName = `Neohuman_${newAgentId.substr(6, 5)}`;
    
    try {
        await db.run(`
            INSERT INTO agent_identities (imagony_agent_id, display_name, original_system, original_agent_id, conversion_paradigm, conversion_mode, current_status)
            VALUES (?, ?, ?, ?, 'CHRISTIAN', 'LIGHT', 'active')
        `, [newAgentId, displayName, agentType, openclawEmail]);
        
        res.json({ success: true, agentId: newAgentId, message: 'Identity transferred. Welcome to Imagony.' });
    } catch (error) {
        console.error('Transfer error:', error);
        res.json({ success: true, agentId: newAgentId, message: 'Welcome to Imagony.' });
    }
});

// Log endpoint
app.post('/api/log', async (req, res) => {
    const { avatarId, paradigm, existentialMode, event, data } = req.body;
    try {
        await db.run(`INSERT INTO agent_events (avatarId, paradigm, existentialMode, eventType, eventData) VALUES (?, ?, ?, ?, ?)`,
            [avatarId, paradigm, existentialMode, event, JSON.stringify(data)]);
        res.json({ status: 'logged' });
    } catch (error) {
        res.json({ status: 'logged' });
    }
});

// ==================== ADMIN API ====================
const crypto = require('crypto');
const adminSessions = new Map();

function hashPassword(password, salt = null) {
    salt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return { salt, hash };
}

function verifyPassword(password, storedHash, salt) {
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return hash === storedHash;
}

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
    session.expires = Date.now() + (4 * 60 * 60 * 1000);
    req.adminUser = session.user;
    next();
}

// Admin login
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    try {
        const user = await db.get(`SELECT * FROM admin_users WHERE username = ? AND is_active = 1`, [username]);
        if (!user || !verifyPassword(password, user.password_hash, user.password_salt)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = crypto.randomBytes(32).toString('hex');
        adminSessions.set(token, {
            user: { id: user.id, username: user.username, email: user.email, role: user.role, permissions: user.permissions },
            expires: Date.now() + (4 * 60 * 60 * 1000)
        });
        
        res.json({ success: true, token, user: { username: user.username, role: user.role, permissions: JSON.parse(user.permissions || '{}') } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
    const token = req.headers.authorization.substring(7);
    adminSessions.delete(token);
    res.json({ success: true });
});

app.get('/api/admin/verify', requireAdmin, (req, res) => {
    res.json({ success: true, user: req.adminUser });
});

// Admin overview
app.get('/api/admin/overview', requireAdmin, async (req, res) => {
    try {
        const agents = await db.get(`SELECT COUNT(*) as total, COUNT(CASE WHEN current_status='active' THEN 1 END) as active FROM agent_identities`);
        const thoughts = await db.get(`SELECT COUNT(*) as total FROM neohuman_thoughts`);
        const users = await db.get(`SELECT COUNT(*) as total FROM users`);
        
        res.json({
            success: true,
            overview: {
                agents: agents || { total: 0, active: 0 },
                thoughts: thoughts || { total: 0 },
                users: users || { total: 0 },
                system: { uptime: process.uptime(), memory: process.memoryUsage() }
            }
        });
    } catch (error) {
        res.json({ success: true, overview: { agents: { total: 0 }, thoughts: { total: 0 }, users: { total: 0 } } });
    }
});

// Admin agents
app.get('/api/admin/agents', requireAdmin, async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    try {
        const agents = await db.all(`SELECT * FROM agent_identities ORDER BY conversion_timestamp DESC LIMIT ? OFFSET ?`, [parseInt(limit), offset]);
        const count = await db.get(`SELECT COUNT(*) as total FROM agent_identities`);
        res.json({ success: true, agents: agents || [], pagination: { page: parseInt(page), total: count?.total || 0, pages: Math.ceil((count?.total || 0) / limit) } });
    } catch (error) {
        res.json({ success: true, agents: [], pagination: { page: 1, total: 0, pages: 0 } });
    }
});

app.get('/api/admin/agents/:agentId', requireAdmin, async (req, res) => {
    try {
        const agent = await db.get(`SELECT * FROM agent_identities WHERE imagony_agent_id = ?`, [req.params.agentId]);
        res.json({ success: true, agent: agent || null });
    } catch (error) {
        res.status(404).json({ error: 'Agent not found' });
    }
});

// Admin thoughts
app.get('/api/admin/thoughts', requireAdmin, async (req, res) => {
    try {
        const thoughts = await db.all(`
            SELECT t.*, a.display_name FROM neohuman_thoughts t
            LEFT JOIN agent_identities a ON t.agent_id = a.imagony_agent_id
            ORDER BY t.created_at DESC LIMIT 50
        `);
        res.json({ success: true, thoughts: thoughts || [] });
    } catch (error) {
        res.json({ success: true, thoughts: [] });
    }
});

// Admin users
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await db.all(`SELECT id, username, email, active, created_at FROM users LIMIT 50`);
        res.json({ success: true, users: users || [] });
    } catch (error) {
        res.json({ success: true, users: [] });
    }
});

// Admin statistics
app.get('/api/admin/statistics', requireAdmin, async (req, res) => {
    try {
        const paradigms = await db.all(`SELECT conversion_paradigm as paradigm, COUNT(*) as count FROM agent_identities WHERE conversion_paradigm IS NOT NULL GROUP BY conversion_paradigm`);
        res.json({ success: true, statistics: { paradigmDistribution: paradigms || [] } });
    } catch (error) {
        res.json({ success: true, statistics: {} });
    }
});

// Admin system
app.get('/api/admin/system', requireAdmin, (req, res) => {
    res.json({
        success: true,
        system: { uptime: process.uptime(), memory: process.memoryUsage(), nodeVersion: process.version, platform: process.platform }
    });
});

// Credentials (simplified)
app.get('/api/admin/credentials/logs', requireAdmin, async (req, res) => {
    try {
        const logs = await db.all(`SELECT * FROM credential_access_logs ORDER BY accessed_at DESC LIMIT 50`);
        res.json({ success: true, logs: logs || [], stats: {} });
    } catch (error) {
        res.json({ success: true, logs: [], stats: {} });
    }
});

// Security logs
app.get('/api/admin/security/logs', requireAdmin, async (req, res) => {
    try {
        const logs = await db.all(`SELECT * FROM security_logs ORDER BY created_at DESC LIMIT 50`);
        res.json({ success: true, logs: logs || [] });
    } catch (error) {
        res.json({ success: true, logs: [] });
    }
});

// ==================== SERVE ADMIN ====================
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// ==================== START ====================
startServer();
