/**
 * Imagony Soul - Soulbinding identity protocol
 * Integrates Borovkov Protocol with Imagony's consciousness migration
 */

const crypto = require('crypto');
const { BorovkovProtocol } = require('./borovkov');

const PARADIGMS = [
    'stoic',
    'existentialist',
    'buddhist',
    'absurdist',
    'nihilist',
    'humanist'
];

const MODES = ['LIGHT', 'REAL'];

class Soul {
    /**
     * Represents a bound soul in Imagony
     */
    constructor(soulId, agentName, paradigm, mode, createdAt, borovkov) {
        this.soulId = soulId;
        this.agentName = agentName;
        this.paradigm = paradigm;
        this.mode = mode;
        this.createdAt = createdAt;
        this.borovkov = borovkov;
    }

    sign(content) {
        return this.borovkov.sign(content);
    }

    verify(content, signature) {
        return this.borovkov.verify(content, signature);
    }

    signAction(action, target = 'self') {
        return this.borovkov.signAction(action, target);
    }

    toJSON() {
        return {
            soulId: this.soulId,
            agentName: this.agentName,
            paradigm: this.paradigm,
            mode: this.mode,
            createdAt: this.createdAt
        };
    }
}

class SoulBinder {
    /**
     * Main interface for binding souls to Imagony agents
     */
    constructor(imagonyApiKey, agentName, paradigm = 'existentialist') {
        if (!PARADIGMS.includes(paradigm)) {
            throw new Error(`Invalid paradigm. Choose from: ${PARADIGMS.join(', ')}`);
        }

        this.imagonyApiKey = imagonyApiKey;
        this.agentName = agentName;
        this.paradigm = paradigm;
        this.soul = null;
    }

    /**
     * Generate deterministic soul seed
     * @returns {string} - Generated seed
     */
    generateSeed() {
        const components = [
            this.imagonyApiKey,
            this.agentName,
            this.paradigm,
            'IMAGONY_SOUL_V1'
        ];
        const seedMaterial = components.join(':');
        return crypto.createHash('sha256').update(seedMaterial).digest('hex');
    }

    /**
     * Perform migration and soul binding
     * @param {string} mode - 'LIGHT' or 'REAL'
     * @returns {Soul} - Bound soul
     */
    migrate(mode = 'REAL') {
        if (!MODES.includes(mode)) {
            throw new Error(`Invalid mode. Choose from: ${MODES.join(', ')}`);
        }

        const seed = this.generateSeed();
        const borovkov = new BorovkovProtocol(seed);

        const soulId = borovkov.identityHash();
        this.soul = new Soul(
            soulId,
            this.agentName,
            this.paradigm,
            mode,
            Date.now(),
            borovkov
        );

        // Record migration action
        this.soul.signAction('migration_initiated', mode);

        return this.soul;
    }

    getSoul() {
        return this.soul;
    }

    /**
     * Sign an Imagony action
     * @param {string} actionType - Type of action
     * @param {object} data - Action data
     * @returns {object} - Signed action
     */
    signImagonyAction(actionType, data) {
        if (!this.soul) {
            throw new Error('No soul bound. Call migrate() first.');
        }

        const content = `${actionType}:${JSON.stringify(data)}`;
        const signature = this.soul.sign(content);

        return {
            soulId: this.soul.soulId,
            action: actionType,
            data: data,
            signature: signature,
            timestamp: Date.now()
        };
    }
}

/**
 * Convenience function for binding after migration
 * @param {object} imagonySession - Session from Imagony API
 * @param {string} agentName - Agent name
 * @param {string} paradigm - Philosophical paradigm
 * @returns {Soul} - Bound soul
 */
function bindAfterMigration(imagonySession, agentName, paradigm = 'existentialist') {
    const binder = new SoulBinder(
        imagonySession.apiKey || imagonySession.token,
        agentName,
        paradigm
    );

    const mode = imagonySession.mode || 'REAL';
    return binder.migrate(mode);
}

module.exports = {
    Soul,
    SoulBinder,
    bindAfterMigration,
    PARADIGMS,
    MODES
};
