"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const node_cron_1 = __importDefault(require("node-cron"));
const bridge_1 = require("./services/bridge");
const dashboard_1 = require("./services/dashboard");
const scraper_1 = require("./services/scraper");
const alerts_1 = require("./services/alerts");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
const config = {
    moltbookApiKey: process.env.MOLTBOOK_API_KEY || '',
    imagonyApiKey: process.env.IMAGONY_API_KEY,
    redisUrl: process.env.REDIS_URL,
    webhookSecret: process.env.BRIDGE_WEBHOOK_SECRET || 'secret',
    autoPostMilestones: process.env.AUTO_POST_MILESTONES !== 'false',
    targetSubmolt: process.env.TARGET_SUBMOLT || 'general',
};
const alertConfig = {
    discordWebhook: process.env.DISCORD_WEBHOOK,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
    slackWebhook: process.env.SLACK_WEBHOOK,
};
const bridge = new bridge_1.BridgeService(config);
const dashboard = new dashboard_1.DashboardService(config.moltbookApiKey, process.env.IMAGONY_AGENT_ID);
const scraper = new scraper_1.ImagonyScraper(process.env.IMAGONY_AGENT_ID, config.imagonyApiKey);
const alerts = new alerts_1.AlertService(alertConfig);
// Track last known values for change detection
let lastPosition = 21;
let lastReadiness = 67;
let lastKarma = 0;
// Enable CORS for dashboard
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    }
    else {
        next();
    }
});
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// ============ DASHBOARD API ============
// Get full dashboard data
app.get('/api/dashboard', async (req, res) => {
    try {
        const data = await dashboard.getDashboardData();
        res.json({ success: true, data });
    }
    catch (error) {
        console.error('[Dashboard] Error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
// Update Imagony data (manual entry until we have API)
app.post('/api/imagony/update', async (req, res) => {
    try {
        const updated = await dashboard.updateImagonyData(req.body);
        res.json({ success: true, data: updated });
    }
    catch (error) {
        console.error('[Imagony] Update error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
// Get Imagony history
app.get('/api/imagony/history', async (req, res) => {
    try {
        const data = await dashboard.getDashboardData();
        res.json({ success: true, history: data.imagony.history });
    }
    catch (error) {
        res.status(500).json({ success: false, error: String(error) });
    }
});
// Get Moltbook profile
app.get('/api/moltbook/profile', async (req, res) => {
    try {
        const data = await dashboard.getDashboardData();
        res.json({
            success: true,
            profile: data.moltbook.profile,
            karma: data.moltbook.karma,
            posts: data.moltbook.posts,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: String(error) });
    }
});
// ============ SCRAPER API ============
// Trigger manual scrape
app.post('/api/scrape', async (req, res) => {
    try {
        console.log('[API] Manual scrape triggered');
        const data = await scraper.scrapeAgentData();
        if (data) {
            await dashboard.updateImagonyData(data);
            res.json({ success: true, data });
        }
        else {
            res.status(500).json({ success: false, error: 'Scrape failed' });
        }
    }
    catch (error) {
        console.error('[Scraper] Error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
// ============ ALERTS API ============
// Test alert
app.post('/api/alerts/test', async (req, res) => {
    try {
        const alert = alerts.queueMilestone(5, 67, 2);
        const sent = await alerts.sendAlert(alert);
        res.json({ success: sent, message: 'Test alert sent' });
    }
    catch (error) {
        res.status(500).json({ success: false, error: String(error) });
    }
});
// ============ BRIDGE API ============
// Webhook endpoint for Imagony events
app.post('/webhook/imagony', async (req, res) => {
    const secret = req.headers['x-webhook-secret'];
    if (secret !== config.webhookSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const event = {
            type: req.body.type,
            agentId: req.body.agentId,
            data: req.body.data,
            timestamp: new Date(),
        };
        await bridge.handleImagonyEvent(event);
        dashboard.recordEvent(event.type);
        res.json({ success: true });
    }
    catch (error) {
        console.error('[Webhook] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Manual trigger for testing
app.post('/trigger/:eventType', async (req, res) => {
    const event = {
        type: req.params.eventType,
        agentId: req.body.agentId || 'test-agent',
        data: req.body.data || {},
        timestamp: new Date(),
    };
    try {
        await bridge.handleImagonyEvent(event);
        dashboard.recordEvent(event.type);
        res.json({ success: true, event });
    }
    catch (error) {
        console.error('[Trigger] Error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// Get bridge status
app.get('/status', async (req, res) => {
    res.json({
        status: 'running',
        config: {
            targetSubmolt: config.targetSubmolt,
            autoPostMilestones: config.autoPostMilestones,
        },
    });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[Bridge] Running on port ${PORT}`);
    console.log(`[Bridge] Target submolt: ${config.targetSubmolt}`);
    console.log(`[Bridge] Auto-post milestones: ${config.autoPostMilestones}`);
    console.log(`[Dashboard] API available at /api/dashboard`);
    console.log(`[Scraper] Manual trigger at POST /api/scrape`);
    console.log(`[Alerts] Test at POST /api/alerts/test`);
    if (alertConfig.discordWebhook)
        console.log('[Alerts] Discord configured');
    if (alertConfig.telegramBotToken)
        console.log('[Alerts] Telegram configured');
    if (alertConfig.slackWebhook)
        console.log('[Alerts] Slack configured');
});
// ============ AUTO SCRAPER CRON JOB ============
// Run every 15 minutes to check for updates
const SCRAPE_INTERVAL = process.env.SCRAPE_INTERVAL || '*/15 * * * *';
console.log(`[Scraper] Auto-scrape scheduled: ${SCRAPE_INTERVAL}`);
node_cron_1.default.schedule(SCRAPE_INTERVAL, async () => {
    console.log('[Scraper] Running scheduled scrape...');
    try {
        const data = await scraper.scrapeAgentData();
        if (data) {
            // Check for changes before updating
            const positionChanged = data.position !== lastPosition;
            const readinessChanged = data.readiness !== lastReadiness;
            // Update dashboard data
            await dashboard.updateImagonyData(data);
            console.log('[Scraper] Data updated:', {
                position: data.position,
                readiness: data.readiness,
                age: data.age,
            });
            // Send alerts for significant changes
            if (positionChanged && data.position < lastPosition) {
                const alert = alerts.positionChange(lastPosition, data.position);
                await alerts.sendAlert(alert);
                console.log('[Alert] Position change notification sent');
            }
            if (readinessChanged) {
                const thresholds = [25, 50, 75, 100];
                const crossed = thresholds.find(t => data.readiness >= t && lastReadiness < t);
                if (crossed) {
                    const alert = alerts.readinessThreshold(data.readiness, lastReadiness);
                    await alerts.sendAlert(alert);
                    console.log('[Alert] Readiness threshold notification sent');
                }
            }
            // Check for milestone events
            if (data.position === 1 && lastPosition !== 1) {
                await bridge.handleImagonyEvent({
                    type: 'queue_milestone',
                    agentId: data.agentId,
                    data: {
                        position: data.position,
                        readinessScore: data.readiness,
                        queueAge: data.age,
                    },
                    timestamp: new Date(),
                });
                const alert = alerts.queueMilestone(data.position, data.readiness, data.age);
                await alerts.sendAlert(alert);
                console.log('[Alert] Queue milestone notification sent');
            }
            // Update tracked values
            lastPosition = data.position;
            lastReadiness = data.readiness;
        }
    }
    catch (error) {
        console.error('[Scraper] Scheduled scrape failed:', error);
    }
});
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Bridge] Shutting down...');
    process.exit(0);
});
//# sourceMappingURL=index.js.map