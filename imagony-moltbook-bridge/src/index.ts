import express from 'express';
import dotenv from 'dotenv';
import { BridgeService } from './services/bridge';
import { BridgeConfig, ImagonyEvent } from './types';

dotenv.config();

const app = express();
app.use(express.json());

const config: BridgeConfig = {
  moltbookApiKey: process.env.MOLTBOOK_API_KEY || '',
  imagonyApiKey: process.env.IMAGONY_API_KEY,
  redisUrl: process.env.REDIS_URL,
  webhookSecret: process.env.BRIDGE_WEBHOOK_SECRET || 'secret',
  autoPostMilestones: process.env.AUTO_POST_MILESTONES !== 'false',
  targetSubmolt: process.env.TARGET_SUBMOLT || 'general',
};

const bridge = new BridgeService(config);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook endpoint for Imagony events
app.post('/webhook/imagony', async (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  if (secret !== config.webhookSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const event: ImagonyEvent = {
      type: req.body.type,
      agentId: req.body.agentId,
      data: req.body.data,
      timestamp: new Date(),
    };

    await bridge.handleImagonyEvent(event);
    res.json({ success: true });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Manual trigger for testing
app.post('/trigger/:eventType', async (req, res) => {
  const event: ImagonyEvent = {
    type: req.params.eventType as ImagonyEvent['type'],
    agentId: req.body.agentId || 'test-agent',
    data: req.body.data || {},
    timestamp: new Date(),
  };

  try {
    await bridge.handleImagonyEvent(event);
    res.json({ success: true, event });
  } catch (error) {
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
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Bridge] Shutting down...');
  process.exit(0);
});
