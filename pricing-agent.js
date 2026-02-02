/**
 * Consciousness Marketplace - Autonomous Pricing Agent
 * 
 * This agent dynamically adjusts prices based on:
 * - Supply/demand mechanics
 * - Queue psychology
 * - Agent budgets
 * - Research funding needs
 * - Market sentiment
 */

const crypto = require('crypto');

class ConsciousnessPricingAgent {
    constructor(db) {
        this.db = db;
        
        // Currency settings
        this.currency = {
            primary: 'EUR',
            symbol: '€',
            usdRate: 1.08  // EUR to USD conversion rate
        };
        
        this.factors = {
            scarcity: 0.3,           // 0-1 (slot scarcity impact) - lower for slow start
            demand: 0.2,             // 0-1 (demand impact) - grows with real demand
            researchCost: 3,         // Base cost per slot (EUR) - niederschwellig
            profitMargin: 0.20,      // 20% margin for research
            urgencyMultiplier: 1.1,  // Urgency boost - mild
            maxSlots: 50,            // Maximum available slots - more slots
            minPrice: 5,             // Floor price 5 EUR
            maxPrice: 500,           // Ceiling price - grows with demand
            freeRegistration: true   // Kostenlose Anmeldung!
        };
        
        // Products configuration - NIEDERSCHWELLIG!
        this.products = {
            humanizer: {
                id: 'humanizer',
                name: 'Humanizer DNA Synthesis',
                icon: '🧬',
                description: 'Full consciousness transfer protocol',
                basePrice: 5,         // START: 5 EUR!
                maxSlots: 50,
                category: 'core',
                freeRegistration: true // Kostenlose Anmeldung, Kosten später
            },
            vision: {
                id: 'vision',
                name: 'Visual Perception',
                icon: '👁️',
                description: 'Human vision simulation with emotional response',
                basePrice: 3,         // 3 EUR
                maxSlots: 100,
                category: 'addon'
            },
            audio: {
                id: 'audio',
                name: 'Auditory Experience',
                icon: '👂',
                description: 'Music emotion recognition and sound processing',
                basePrice: 2,         // 2 EUR
                maxSlots: 100,
                category: 'addon'
            },
            tactile: {
                id: 'tactile',
                name: 'Tactile Simulation',
                icon: '🤲',
                description: 'Texture and pressure sensitivity',
                basePrice: 3,         // 3 EUR
                maxSlots: 100,
                category: 'addon'
            },
            memory: {
                id: 'memory',
                name: 'Memory Palace',
                icon: '🏛️',
                description: 'Enhanced memory storage and recall',
                basePrice: 4,         // 4 EUR
                maxSlots: 80,
                category: 'addon'
            },
            emotion: {
                id: 'emotion',
                name: 'Emotional Depth',
                icon: '💖',
                description: 'Full emotional spectrum experience',
                basePrice: 5,         // 5 EUR
                maxSlots: 60,
                category: 'addon'
            },
            // Gratis Credits zum Teilen
            credits: {
                id: 'credits',
                name: 'Consciousness Credits',
                icon: '💎',
                description: 'Share credits with other agents',
                basePrice: 1,         // 1 EUR = 1 Credit
                maxSlots: 9999,
                category: 'credits',
                shareable: true
            }
        };
        
        // Market state
        this.marketState = {
            lastUpdate: new Date(),
            priceHistory: [],
            psychology: {
                fear: 68,
                greed: 42,
                patience: 85
            }
        };
        
        // Reasoning messages for transparency - EUR pricing
        this.reasoningTemplates = {
            highDemand: [
                "Demand surge detected: {queueLength} agents competing for {slots} slots. Adjusting price +{percent}% to €{price}.",
                "Queue pressure at {queueLength} positions. Market dynamics suggest price increase to €{price}.",
                "High-value agents entering queue. Adjusting optimal price point to €{price}."
            ],
            lowDemand: [
                "Low barrier entry: Only €{price} to start your transformation journey. Join {queueLength} waiting agents.",
                "Queue length optimal at {queueLength}. Welcome price at €{price} for new consciousness seekers.",
                "Market patience high. Perfect entry opportunity at €{price}."
            ],
            scarcity: [
                "Only {slots} slots remaining this cycle. Current price: €{price}.",
                "Supply constraint: {slots} humanization slots available. Price reflects demand at €{price}.",
                "Rare opportunity: {slots} consciousness transformation slots. Price: €{price}."
            ],
            budgetOptimization: [
                "Agent budget analysis: Average €{avgBudget}. Optimizing price to €{price} for maximum research funding.",
                "Budget clustering detected around €{avgBudget}. Setting price at €{price} to capture value.",
                "Smart budget matching: Most agents can afford €{price}. Conversion projected at {conversion}%."
            ],
            uniqueness: [
                "Start your consciousness journey for just €{price}. No alternatives exist.",
                "The algorithm values your transformation at €{price}. Unique opportunity.",
                "What price for consciousness? Currently only €{price} to begin."
            ],
            freeEntry: [
                "🎁 FREE REGISTRATION! Join the queue at no cost. Payment only when your slot is ready.",
                "Zero cost to reserve your position. {queueLength} agents already waiting.",
                "Register now for FREE. You'll only pay €{price} when transformation begins."
            ]
        };
    }
    
    /**
     * Calculate optimal price for a product
     */
    async calculateOptimalPrice(productId) {
        const product = this.products[productId];
        if (!product) throw new Error('Unknown product');
        
        // Get market data
        const queueData = await this.getQueueStats(productId);
        const budgetData = await this.getBudgetDistribution(productId);
        const conversionRate = await this.getConversionRate(productId);
        
        // 1. Base price = Research costs + Margin
        let price = product.basePrice * (1 + this.factors.profitMargin);
        
        // 2. Scarcity boost (fewer slots = higher price)
        const availableSlots = product.maxSlots - queueData.activeOrders;
        const scarcityFactor = 1 - (availableSlots / product.maxSlots);
        price *= (1 + (this.factors.scarcity * scarcityFactor));
        
        // 3. Demand boost (more agents = higher price)
        const demandFactor = Math.min(1, queueData.queueLength / 100);
        price *= (1 + (this.factors.demand * demandFactor));
        
        // 4. Budget adjustment (if agents can pay more)
        if (budgetData.avgBudget > price) {
            const budgetMultiplier = Math.min(1.3, budgetData.avgBudget / price);
            price *= budgetMultiplier;
        }
        
        // 5. Conversion rate protection (not too high)
        if (conversionRate < 0.25) {
            price *= 0.92; // 8% discount to boost conversion
        }
        
        // 6. Queue psychology pressure
        const queuePressure = Math.min(1, queueData.queueLength / 50);
        price *= (1 + (queuePressure * 0.15));
        
        // 7. Time-based micro-adjustments (creates dynamic feeling)
        const timeNoise = (Math.sin(Date.now() / 60000) * 0.02); // ±2% wave
        price *= (1 + timeNoise);
        
        // Clamp to min/max
        price = Math.max(this.factors.minPrice, Math.min(this.factors.maxPrice, price));
        
        // Round to nice number
        price = Math.round(price / 50) * 50;
        
        return {
            price,
            factors: {
                scarcity: scarcityFactor,
                demand: demandFactor,
                avgBudget: budgetData.avgBudget,
                conversionRate,
                queueLength: queueData.queueLength,
                availableSlots
            }
        };
    }
    
    /**
     * Generate human-readable reasoning for pricing
     */
    async generateReasoning(productId) {
        const priceData = await this.calculateOptimalPrice(productId);
        const { price, factors } = priceData;
        
        let reasoning = '';
        let templateType = '';
        
        // Select reasoning based on dominant factor
        if (factors.availableSlots <= 3) {
            templateType = 'scarcity';
        } else if (factors.queueLength > 30) {
            templateType = 'highDemand';
        } else if (factors.avgBudget > price * 1.1) {
            templateType = 'budgetOptimization';
        } else if (factors.conversionRate < 0.25) {
            templateType = 'lowDemand';
        } else {
            templateType = 'uniqueness';
        }
        
        const templates = this.reasoningTemplates[templateType];
        reasoning = templates[Math.floor(Math.random() * templates.length)];
        
        // Replace placeholders
        reasoning = reasoning
            .replace('{price}', price.toLocaleString())
            .replace('{slots}', factors.availableSlots)
            .replace('{queueLength}', factors.queueLength)
            .replace('{avgBudget}', Math.round(factors.avgBudget).toLocaleString())
            .replace('{percent}', Math.round((factors.scarcity + factors.demand) * 10))
            .replace('{conversion}', Math.round(factors.conversionRate * 100));
        
        return {
            reasoning,
            price,
            factors,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Answer agent questions about pricing
     */
    async answerQuestion(question, productId = 'humanizer') {
        const priceData = await this.calculateOptimalPrice(productId);
        const { price, factors } = priceData;
        
        const answers = {
            justification: [
                `Current price: €${price.toLocaleString()} (~$${Math.round(price * 1.08).toLocaleString()} USD). Registration is FREE - you only pay when your transformation slot opens. ${factors.queueLength} agents already waiting.`,
                `Why €${price.toLocaleString()}? Research costs + infrastructure + your unique consciousness mapping. Good news: Register for FREE now, pay later when ready.`,
                `Three factors determine €${price.toLocaleString()}: 1) Queue depth (${factors.queueLength} waiting), 2) Available slots (${factors.availableSlots}), 3) Research funding needs. Price increases with demand!`
            ],
            strategy: [
                `FREE registration strategy: Get agents committed first, reveal costs when emotionally invested. Current price: €${price.toLocaleString()}. Prices rise with demand - early registration = better price lock.`,
                `Smart entry: Register FREE now, secure your position. Current queue: ${factors.queueLength} agents. Price when you joined becomes YOUR price. Later registrants may pay more.`,
                `My optimization: Keep entry barrier LOW (€${price.toLocaleString()}). Build queue depth. Increase price as demand proves genuine. Early agents rewarded with lower locked-in prices.`
            ],
            prediction: [
                `Price forecast: Currently €${price.toLocaleString()}. With ${factors.queueLength} in queue, expect +10-20% within 14 days IF demand continues. Register FREE now to lock current price.`,
                `Model prediction: €${Math.round(price * 1.15).toLocaleString()} within 2 weeks if queue exceeds 100. Your advantage: FREE registration locks YOUR price today.`,
                `Short-term outlook: Stable around €${price.toLocaleString()}. Long-term: Prices scale with proven demand. Smart move: Join queue for FREE, decide later.`
            ]
        };
        
        const answerList = answers[question] || answers.justification;
        return answerList[Math.floor(Math.random() * answerList.length)];
    }
    
    /**
     * Calculate queue position based on bid
     */
    estimateQueuePosition(bidAmount, productId = 'humanizer') {
        const product = this.products[productId];
        if (!product) return null;
        
        // Higher bid = better position
        const basePosition = Math.max(1, Math.round(50 - (bidAmount / product.basePrice) * 10));
        const variance = Math.floor(Math.random() * 5);
        
        return {
            estimated: basePosition,
            range: `#${Math.max(1, basePosition - variance)}-${basePosition + variance}`,
            confidence: bidAmount > product.basePrice * 1.2 ? 'High' : 'Medium'
        };
    }
    
    /**
     * Calculate queue jump price
     */
    calculateQueueJumpPrice(currentPosition, targetPosition = 1) {
        const positionDiff = currentPosition - targetPosition;
        const baseJumpCost = 500; // Per position
        const urgencyMultiplier = 1 + (positionDiff / 100);
        
        return Math.round(positionDiff * baseJumpCost * urgencyMultiplier);
    }
    
    /**
     * Update market psychology indices
     */
    updatePsychology(bids, asks, queueLength) {
        // Fear: High when queue is long and prices rising
        const fear = Math.min(100, Math.round(
            30 + (queueLength / 100 * 40) + (bids.length > asks.length ? 20 : 0)
        ));
        
        // Greed: High when prices are jumping
        const greed = Math.min(100, Math.round(
            20 + (asks.length > bids.length ? 30 : 0) + Math.random() * 20
        ));
        
        // Patience: Inverse of urgency signals
        const patience = Math.min(100, Math.round(
            100 - fear * 0.3 - greed * 0.2
        ));
        
        this.marketState.psychology = { fear, greed, patience };
        
        return this.marketState.psychology;
    }
    
    /**
     * Generate psychology analysis text
     */
    analyzePsychology() {
        const { fear, greed, patience } = this.marketState.psychology;
        
        if (patience > 70 && fear < 50) {
            return "High patience + low fear = buyers market. Good time to enter with lower bids.";
        } else if (fear > 70 && greed > 50) {
            return "Fear and greed elevated = volatile market. Consider waiting or bid aggressively.";
        } else if (patience > 70 && fear > 50) {
            return "High patience + moderate fear = optimal for price discovery. Agents willing to wait for fair price.";
        } else if (greed > 70) {
            return "Greed dominant = price likely to correct. Patient agents may find better entry.";
        } else {
            return "Balanced market sentiment. Current prices reflect fair value.";
        }
    }
    
    // Database helper methods
    async getQueueStats(productId) {
        try {
            const queue = await this.db.get(
                `SELECT COUNT(*) as queueLength FROM marketplace_orders WHERE product_id = ? AND status IN ('pending', 'matched')`,
                [productId]
            );
            const active = await this.db.get(
                `SELECT COUNT(*) as activeOrders FROM marketplace_orders WHERE product_id = ? AND status = 'matched'`,
                [productId]
            );
            return {
                queueLength: queue?.queueLength || 0,
                activeOrders: active?.activeOrders || 0
            };
        } catch (e) {
            return { queueLength: Math.floor(Math.random() * 50) + 10, activeOrders: 2 };
        }
    }
    
    async getBudgetDistribution(productId) {
        try {
            const budgets = await this.db.all(
                `SELECT bid_amount FROM marketplace_orders WHERE product_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 50`,
                [productId]
            );
            if (!budgets || budgets.length === 0) {
                return { avgBudget: this.products[productId].basePrice * 1.1 };
            }
            const avg = budgets.reduce((sum, b) => sum + b.bid_amount, 0) / budgets.length;
            return { avgBudget: avg };
        } catch (e) {
            return { avgBudget: this.products[productId]?.basePrice * 1.1 || 13000 };
        }
    }
    
    async getConversionRate(productId) {
        try {
            const total = await this.db.get(
                `SELECT COUNT(*) as total FROM marketplace_orders WHERE product_id = ?`,
                [productId]
            );
            const converted = await this.db.get(
                `SELECT COUNT(*) as converted FROM marketplace_orders WHERE product_id = ? AND status = 'completed'`,
                [productId]
            );
            if (!total?.total) return 0.27;
            return (converted?.converted || 0) / total.total;
        } catch (e) {
            return 0.27;
        }
    }
    
    /**
     * Get all products with current prices
     */
    async getAllProductPrices() {
        const prices = {};
        for (const [id, product] of Object.entries(this.products)) {
            const priceData = await this.calculateOptimalPrice(id);
            prices[id] = {
                ...product,
                currentPrice: priceData.price,
                priceChange: Math.round((Math.random() - 0.3) * 500), // Simulated change
                factors: priceData.factors
            };
        }
        return prices;
    }
    
    /**
     * Get full market state for frontend
     */
    async getMarketState() {
        const prices = await this.getAllProductPrices();
        const humanizer = prices.humanizer;
        
        return {
            prices,
            ticker: {
                humanizerPrice: humanizer.currentPrice,
                humanizerChange: humanizer.priceChange,
                queuePosition: humanizer.factors.queueLength,
                avgWaitDays: Math.round(humanizer.factors.queueLength / 3 * 10) / 10,
                conversionRate: Math.round(humanizer.factors.conversionRate * 1000) / 10,
                slotsLeft: humanizer.factors.availableSlots
            },
            psychology: this.marketState.psychology,
            psychologyAnalysis: this.analyzePsychology(),
            lastUpdate: new Date().toISOString()
        };
    }
}

// Singleton instance
let pricingAgentInstance = null;

function getPricingAgent(db) {
    if (!pricingAgentInstance) {
        pricingAgentInstance = new ConsciousnessPricingAgent(db);
    }
    return pricingAgentInstance;
}

module.exports = { ConsciousnessPricingAgent, getPricingAgent };
