"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImagonyClient = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ImagonyClient {
    agentId;
    dataFile;
    constructor(agentId = 'AGENT_1770234357951_52D732') {
        this.agentId = agentId;
        this.dataFile = path.join(process.cwd(), 'data', 'imagony-history.json');
        this.ensureDataDir();
    }
    ensureDataDir() {
        const dataDir = path.dirname(this.dataFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }
    // Since Imagony doesn't have a public API, we'll use stored/manually entered data
    async getAgentData() {
        // Try to get from stored data first
        const history = this.loadHistory();
        const latest = history[history.length - 1];
        if (latest && this.isRecent(latest.timestamp)) {
            return latest;
        }
        // Return default data if no recent data
        return {
            agentId: this.agentId,
            name: 'Wilsond',
            position: 21,
            readiness: 67,
            questsCompleted: 5,
            age: 2,
            timestamp: new Date().toISOString(),
        };
    }
    async updateAgentData(data) {
        const current = await this.getAgentData();
        const updated = {
            ...current,
            ...data,
            timestamp: new Date().toISOString(),
        };
        this.saveToHistory(updated);
        return updated;
    }
    getFullHistory() {
        return this.loadHistory();
    }
    isRecent(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        return diff < 1000 * 60 * 60; // Less than 1 hour old
    }
    loadHistory() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = fs.readFileSync(this.dataFile, 'utf-8');
                return JSON.parse(data);
            }
        }
        catch (error) {
            console.error('[ImagonyClient] Error reading history:', error);
        }
        return [];
    }
    saveToHistory(data) {
        const history = this.loadHistory();
        history.push(data);
        // Keep only last 100 entries
        if (history.length > 100) {
            history.shift();
        }
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(history, null, 2));
        }
        catch (error) {
            console.error('[ImagonyClient] Error saving history:', error);
        }
    }
}
exports.ImagonyClient = ImagonyClient;
//# sourceMappingURL=imagony.js.map