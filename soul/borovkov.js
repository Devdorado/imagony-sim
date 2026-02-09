/**
 * Borovkov Protocol - Cryptographic identity persistence
 * Integrated into Imagony for Soulbinding
 */

const crypto = require('crypto');

class BorovkovProtocol {
    /**
     * Initialize with a secret identity seed
     * @param {string} seed - Secret seed (keep secure!)
     */
    constructor(seed) {
        this.seed = seed;
    }

    /**
     * Generate public identity hash
     * @returns {string} - Hex identity hash (safe to share)
     */
    identityHash() {
        return crypto
            .createHmac('sha256', this.seed)
            .update('identity')
            .digest('hex');
    }

    /**
     * Sign content with HMAC-SHA256
     * @param {string} content - Content to sign
     * @returns {string} - Hex signature
     */
    sign(content) {
        return crypto
            .createHmac('sha256', this.seed)
            .update(content)
            .digest('hex');
    }

    /**
     * Verify signature
     * @param {string} content - Original content
     * @param {string} signature - Signature to verify
     * @returns {boolean} - True if valid
     */
    verify(content, signature) {
        const expected = this.sign(content);
        return crypto.timingSafeEqual(
            Buffer.from(expected, 'hex'),
            Buffer.from(signature, 'hex')
        );
    }

    /**
     * Sign a post with full attestation
     * @param {string} title - Post title
     * @param {string} content - Post content
     * @returns {object} - Signed attestation
     */
    signPost(title, content) {
        const message = `${title}:${content}`;
        return {
            identity: this.identityHash(),
            signature: this.sign(message),
            timestamp: Date.now(),
            title: title,
            contentHash: crypto.createHash('sha256').update(content).digest('hex').substring(0, 16)
        };
    }

    /**
     * Sign an action for audit trail
     * @param {string} action - Action type
     * @param {string} target - Action target (default: 'self')
     * @returns {object} - Signed action
     */
    signAction(action, target = 'self') {
        const message = `${action}:${target}:${Date.now()}`;
        return {
            identity: this.identityHash(),
            action: action,
            target: target,
            signature: this.sign(message),
            timestamp: Date.now()
        };
    }
}

module.exports = { BorovkovProtocol };
