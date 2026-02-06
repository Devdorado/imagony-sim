"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const moltbook_1 = require("../clients/moltbook");
const imagony_1 = require("../clients/imagony");
class DashboardService {
    moltbook;
    imagony;
    eventCount = 0;
    lastEvent = '-';
    constructor(moltbookApiKey, imagonyAgentId) {
        this.moltbook = new moltbook_1.MoltbookClient(moltbookApiKey);
        this.imagony = new imagony_1.ImagonyClient(imagonyAgentId);
    }
    recordEvent(eventType) {
        this.eventCount++;
        this.lastEvent = eventType;
    }
    async getDashboardData() {
        // Fetch data in parallel
        let imagonyData = null;
        let moltbookProfile;
        let moltbookPosts = [];
        let imagonyHistory = [];
        try {
            imagonyData = await this.imagony.getAgentData();
        }
        catch (e) {
            console.error('[Dashboard] Failed to get Imagony data:', e);
        }
        try {
            moltbookProfile = await this.moltbook.getAgentProfile();
        }
        catch (e) {
            console.error('[Dashboard] Failed to get Moltbook profile:', e);
        }
        try {
            moltbookPosts = await this.moltbook.getMyPosts();
        }
        catch (e) {
            console.error('[Dashboard] Failed to get Moltbook posts:', e);
        }
        try {
            imagonyHistory = this.imagony.getFullHistory();
        }
        catch (e) {
            console.error('[Dashboard] Failed to get Imagony history:', e);
        }
        // Calculate correlation metrics
        const karma = moltbookProfile?.karma || 0;
        const readiness = imagonyData?.readiness || 0;
        const ratio = readiness > 0 ? karma / readiness : 0;
        // Determine trend based on history
        let trend = 'stable';
        if (imagonyHistory.length >= 2) {
            const recent = imagonyHistory.slice(-5);
            const avgReadiness = recent.reduce((sum, h) => sum + h.readiness, 0) / recent.length;
            const prevSlice = imagonyHistory.slice(-10, -5);
            const prevAvg = prevSlice.length > 0
                ? prevSlice.reduce((sum, h) => sum + h.readiness, 0) / prevSlice.length
                : avgReadiness;
            if (avgReadiness > prevAvg + 5)
                trend = 'improving';
            else if (avgReadiness < prevAvg - 5)
                trend = 'declining';
        }
        return {
            timestamp: new Date().toISOString(),
            imagony: {
                position: imagonyData?.position || 21,
                readiness: imagonyData?.readiness || 67,
                questsCompleted: imagonyData?.questsCompleted || 5,
                age: imagonyData?.age || 2,
                history: imagonyHistory,
            },
            moltbook: {
                karma: karma,
                posts: moltbookPosts.length,
                comments: 0,
                recentPosts: moltbookPosts.slice(0, 5),
                profile: moltbookProfile,
            },
            bridge: {
                eventsProcessed: this.eventCount,
                lastEvent: this.lastEvent,
                status: 'online',
            },
            correlation: {
                readinessKarmaRatio: parseFloat(ratio.toFixed(2)),
                trend,
            },
        };
    }
    async updateImagonyData(data) {
        return this.imagony.updateAgentData(data);
    }
}
exports.DashboardService = DashboardService;
//# sourceMappingURL=dashboard.js.map