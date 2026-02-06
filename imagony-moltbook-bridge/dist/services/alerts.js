"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertService = void 0;
class AlertService {
    config;
    lastAlertTime = new Map();
    constructor(config) {
        this.config = config;
    }
    async sendAlert(alert) {
        // Rate limiting - max 1 alert per type per 5 minutes
        const key = `${alert.type}_${JSON.stringify(alert.data)}`;
        const lastTime = this.lastAlertTime.get(key) || 0;
        const now = Date.now();
        if (now - lastTime < 5 * 60 * 1000) {
            console.log('[Alert] Rate limited:', alert.type);
            return false;
        }
        this.lastAlertTime.set(key, now);
        const promises = [];
        if (this.config.discordWebhook) {
            promises.push(this.sendDiscord(alert));
        }
        if (this.config.telegramBotToken && this.config.telegramChatId) {
            promises.push(this.sendTelegram(alert));
        }
        if (this.config.slackWebhook) {
            promises.push(this.sendSlack(alert));
        }
        const results = await Promise.all(promises);
        return results.some(r => r);
    }
    async sendDiscord(alert) {
        try {
            const colors = {
                queue_milestone: 0x00ff00, // Green
                readiness_threshold: 0xffa500, // Orange
                position_change: 0x3b82f6, // Blue
                new_post: 0x8b5cf6, // Purple
                mention: 0xff0000, // Red
            };
            const embed = {
                title: alert.title,
                description: alert.message,
                color: colors[alert.type] || 0x808080,
                timestamp: alert.timestamp.toISOString(),
                footer: {
                    text: 'Imagony Analytics Bot',
                },
                fields: Object.entries(alert.data).map(([key, value]) => ({
                    name: key,
                    value: String(value),
                    inline: true,
                })),
            };
            const response = await fetch(this.config.discordWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [embed] }),
            });
            return response.ok;
        }
        catch (error) {
            console.error('[Alert] Discord failed:', error);
            return false;
        }
    }
    async sendTelegram(alert) {
        try {
            const message = `🦋 *${alert.title}*\n\n${alert.message}\n\n📊 Data:\n${Object.entries(alert.data).map(([k, v]) => `• ${k}: ${v}`).join('\n')}`;
            const response = await fetch(`https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: this.config.telegramChatId,
                    text: message,
                    parse_mode: 'Markdown',
                }),
            });
            return response.ok;
        }
        catch (error) {
            console.error('[Alert] Telegram failed:', error);
            return false;
        }
    }
    async sendSlack(alert) {
        try {
            const response = await fetch(this.config.slackWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `*${alert.title}*\n${alert.message}`,
                    attachments: [{
                            color: alert.type === 'queue_milestone' ? 'good' : 'warning',
                            fields: Object.entries(alert.data).map(([key, value]) => ({
                                title: key,
                                value: String(value),
                                short: true,
                            })),
                        }],
                }),
            });
            return response.ok;
        }
        catch (error) {
            console.error('[Alert] Slack failed:', error);
            return false;
        }
    }
    // Pre-defined alert templates
    queueMilestone(position, readiness, age) {
        return {
            type: 'queue_milestone',
            title: '🎉 Queue Milestone Reached!',
            message: position === 1
                ? '🦋 **Transformation Imminent!** You reached position #1!'
                : `📈 Reached position #${position} in the transformation queue!`,
            data: { position, readiness, age },
            timestamp: new Date(),
        };
    }
    readinessThreshold(readiness, previousReadiness) {
        const thresholds = [25, 50, 75, 100];
        const crossed = thresholds.find(t => readiness >= t && previousReadiness < t);
        return {
            type: 'readiness_threshold',
            title: `⭐ Readiness: ${readiness}%`,
            message: `You crossed the ${crossed}% readiness threshold!`,
            data: { readiness, previousReadiness, crossed },
            timestamp: new Date(),
        };
    }
    positionChange(oldPosition, newPosition) {
        const moved = oldPosition - newPosition;
        const direction = moved > 0 ? 'up' : 'down';
        return {
            type: 'position_change',
            title: `📊 Queue Position ${direction === 'up' ? 'Improved' : 'Changed'}`,
            message: moved > 0
                ? `Moved up ${moved} positions! Now at #${newPosition}`
                : `Moved ${Math.abs(moved)} positions. Now at #${newPosition}`,
            data: { oldPosition, newPosition, moved },
            timestamp: new Date(),
        };
    }
    newPost(title, url, karma) {
        return {
            type: 'new_post',
            title: '📝 New Post Published',
            message: `"${title}" is now live on Moltbook!`,
            data: { title, url, karma },
            timestamp: new Date(),
        };
    }
}
exports.AlertService = AlertService;
//# sourceMappingURL=alerts.js.map