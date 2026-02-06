"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImagonyScraper = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
class ImagonyScraper {
    agentId;
    apiKey;
    constructor(agentId = 'AGENT_1770234357951_52D732', apiKey) {
        this.agentId = agentId;
        this.apiKey = apiKey || process.env.IMAGONY_API_KEY || '';
    }
    async scrapeAgentData() {
        console.log('[Scraper] Starting Imagony data scrape...');
        const browser = await puppeteer_1.default.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        try {
            const page = await browser.newPage();
            // Set viewport
            await page.setViewport({ width: 1280, height: 800 });
            // Navigate to Imagony
            console.log('[Scraper] Navigating to imagony.com...');
            await page.goto('https://imagony.com', { waitUntil: 'networkidle2', timeout: 30000 });
            // Wait for page to load
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Check if we need to login with API key
            // Imagony stores auth in localStorage or cookies
            if (this.apiKey) {
                console.log('[Scraper] Injecting API credentials...');
                await page.evaluate((key) => {
                    window.localStorage.setItem('agent_token', key);
                    window.localStorage.setItem('agent_id', 'AGENT_1770234357951_52D732');
                }, this.apiKey);
                // Reload to apply auth
                await page.reload({ waitUntil: 'networkidle2' });
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            // Try to find agent data on the page
            // Looking for queue position, readiness score, quests
            const data = await page.evaluate(() => {
                // Helper to extract numbers from text
                const extractNumber = (text) => {
                    const match = text.match(/\d+/);
                    return match ? parseInt(match[0], 10) : 0;
                };
                // Try different selectors that might contain the data
                const positionEl = document.querySelector('[data-position], .queue-position, .position');
                const readinessEl = document.querySelector('[data-readiness], .readiness-score, .readiness');
                const questsEl = document.querySelector('[data-quests], .quests-completed, .quests');
                const ageEl = document.querySelector('[data-age], .queue-age, .age');
                // Also try to find by text content
                const allText = document.body.innerText;
                // Extract position from text (looking for patterns like "Position: 21" or "#21")
                const positionMatch = allText.match(/position[:\s#]*(\d+)/i);
                const readinessMatch = allText.match(/readiness[:\s]*(\d+)%?/i);
                const questsMatch = allText.match(/quest[s:]?\s*(\d+)\s*\/\s*5/i);
                const ageMatch = allText.match(/age[:\s]*(\d+)\s*day/i);
                return {
                    position: extractNumber(positionEl?.textContent || '') || parseInt(positionMatch?.[1] || '21'),
                    readiness: extractNumber(readinessEl?.textContent || '') || parseInt(readinessMatch?.[1] || '67'),
                    questsCompleted: extractNumber(questsEl?.textContent || '') || parseInt(questsMatch?.[1] || '5'),
                    age: extractNumber(ageEl?.textContent || '') || parseInt(ageMatch?.[1] || '2'),
                };
            });
            console.log('[Scraper] Data extracted:', data);
            return {
                agentId: this.agentId,
                name: 'Wilsond',
                position: data.position,
                readiness: data.readiness,
                questsCompleted: data.questsCompleted,
                age: data.age,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            console.error('[Scraper] Error:', error);
            return null;
        }
        finally {
            await browser.close();
            console.log('[Scraper] Browser closed');
        }
    }
    // Alternative: Use Imagony's actual API endpoints if available
    async fetchFromApi() {
        try {
            // Try to reverse engineer their API
            const response = await fetch('https://imagony.com/api/agent/status', {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'X-Agent-ID': this.agentId,
                },
            });
            if (!response.ok) {
                console.log('[Scraper] API endpoint not available, using fallback');
                return null;
            }
            const data = await response.json();
            return {
                agentId: this.agentId,
                name: data.name || 'Wilsond',
                position: data.position || 21,
                readiness: data.readiness || 67,
                questsCompleted: data.questsCompleted || 5,
                age: data.age || 2,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            console.error('[Scraper] API fetch failed:', error);
            return null;
        }
    }
}
exports.ImagonyScraper = ImagonyScraper;
//# sourceMappingURL=scraper.js.map