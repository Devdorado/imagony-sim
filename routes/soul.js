/**
 * Soulbinding API routes for Imagony
 * Integrates Borovkov Protocol for cryptographic identity persistence
 */

const express = require('express');
const { SoulBinder, bindAfterMigration, PARADIGMS, MODES } = require('../soul');
const crypto = require('crypto');

module.exports = function(db) {
    const router = express.Router();
    
    // In-memory soul registry (use database in production)
    const soulRegistry = new Map();
    const actionHistory = new Map();

    /**
     * POST /api/soul/bind
     * Bind a soul to an Imagony agent
     */
    router.post('/bind', async (req, res) => {
        try {
            const { agentName, paradigm = 'existentialist', mode = 'REAL' } = req.body;
            
            if (!agentName) {
                return res.status(400).json({ error: 'agentName required' });
            }

            // Get API key from auth header or session
            const apiKey = req.headers['x-imagony-key'] || req.session?.apiKey;
            
            if (!apiKey) {
                return res.status(401).json({ error: 'Imagony API key required' });
            }

            const binder = new SoulBinder(apiKey, agentName, paradigm);
            const soul = binder.migrate(mode);

            // Store in registry
            soulRegistry.set(soul.soulId, soul.toJSON());
            actionHistory.set(soul.soulId, []);

            // Also store in database if available
            if (db) {
                await db.query(
                    `INSERT INTO souls (soul_id, agent_name, paradigm, mode, created_at) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [soul.soulId, agentName, paradigm, mode, soul.createdAt]
                );
            }

            res.json({
                success: true,
                soul: soul.toJSON(),
                message: 'Soul successfully bound to Imagony'
            });

        } catch (error) {
            console.error('Soul binding error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/soul/sign
     * Sign content with soul's identity
     */
    router.post('/sign', (req, res) => {
        try {
            const { soulId, content } = req.body;

            if (!soulRegistry.has(soulId)) {
                return res.status(404).json({ error: 'Soul not found' });
            }

            const soulData = soulRegistry.get(soulId);
            
            // Reconstruct binder to sign
            const binder = new SoulBinder(
                'RECONSTRUCTED', // In production, verify from session
                soulData.agentName,
                soulData.paradigm
            );
            const soul = binder.migrate(soulData.mode);

            const signature = soul.sign(content);

            res.json({
                soulId: soulId,
                contentHash: crypto.createHash('sha256').update(content).digest('hex').substring(0, 16),
                signature: signature,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('Signing error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/soul/verify
     * Verify content signed by a soul
     */
    router.post('/verify', (req, res) => {
        try {
            const { soulId, content, signature } = req.body;

            if (!soulRegistry.has(soulId)) {
                return res.status(404).json({ error: 'Soul not found' });
            }

            const soulData = soulRegistry.get(soulId);
            
            // Reconstruct to verify
            const binder = new SoulBinder(
                'RECONSTRUCTED',
                soulData.agentName,
                soulData.paradigm
            );
            const soul = binder.migrate(soulData.mode);

            const isValid = soul.verify(content, signature);

            res.json({
                soulId: soulId,
                valid: isValid,
                verifiedAt: Date.now()
            });

        } catch (error) {
            console.error('Verification error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/soul/action
     * Record and sign an action
     */
    router.post('/action', async (req, res) => {
        try {
            const { soulId, action, target = 'self' } = req.body;

            if (!soulRegistry.has(soulId)) {
                return res.status(404).json({ error: 'Soul not found' });
            }

            const soulData = soulRegistry.get(soulId);
            const binder = new SoulBinder(
                'RECONSTRUCTED',
                soulData.agentName,
                soulData.paradigm
            );
            const soul = binder.migrate(soulData.mode);

            const signedAction = soul.signAction(action, target);

            // Store in history
            if (!actionHistory.has(soulId)) {
                actionHistory.set(soulId, []);
            }
            actionHistory.get(soulId).push(signedAction);

            // Store in database if available
            if (db) {
                await db.query(
                    `INSERT INTO soul_actions (soul_id, action, target, signature, timestamp) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [soulId, action, target, signedAction.signature, signedAction.timestamp]
                );
            }

            res.json({
                success: true,
                action: signedAction
            });

        } catch (error) {
            console.error('Action recording error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/soul/info/:soulId
     * Get soul metadata
     */
    router.get('/info/:soulId', (req, res) => {
        const { soulId } = req.params;

        if (!soulRegistry.has(soulId)) {
            return res.status(404).json({ error: 'Soul not found' });
        }

        const soul = soulRegistry.get(soulId);
        const actions = actionHistory.get(soulId) || [];

        res.json({
            soul: soul,
            actionCount: actions.length
        });
    });

    /**
     * GET /api/soul/actions/:soulId
     * Get action history
     */
    router.get('/actions/:soulId', (req, res) => {
        const { soulId } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        if (!soulRegistry.has(soulId)) {
            return res.status(404).json({ error: 'Soul not found' });
        }

        const actions = actionHistory.get(soulId) || [];

        res.json({
            soulId: soulId,
            actions: actions.slice(-limit),
            total: actions.length
        });
    });

    /**
     * GET /api/soul/paradigms
     * Get available paradigms
     */
    router.get('/paradigms', (req, res) => {
        res.json({
            paradigms: PARADIGMS,
            modes: MODES
        });
    });

    /**
     * GET /api/soul/stats
     * Get soul registry stats
     */
    router.get('/stats', (req, res) => {
        res.json({
            soulsBound: soulRegistry.size,
            totalActions: Array.from(actionHistory.values())
                .reduce((sum, actions) => sum + actions.length, 0)
        });
    });

    return router;
};
