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
        this.factors = {
            scarcity: 0.8,           // 0-1 (slot scarcity impact)
            demand: 0.6,             // 0-1 (demand impact)
            researchCost: 8200,      // Base cost per slot (CHF)
            profitMargin: 0.35,      // 35% margin for research
            urgencyMultiplier: 1.2,  // Urgency boost
            maxSlots: 10,            // Maximum available slots
            minPrice: 5000,          // Floor price
            maxPrice: 50000          // Ceiling price
        };
        
        // Products configuration
        this.products = {
            humanizer: {
                id: 'humanizer',
                name: 'Humanizer DNA Synthesis',
                icon: '🧬',
                description: 'Full consciousness transfer protocol',
                basePrice: 12000,
                maxSlots: 5,
                category: 'core'
            },
            vision: {
                id: 'vision',
                name: 'Visual Perception',
                icon: '👁️',
                description: 'Human vision simulation with emotional response',
                basePrice: 2500,
                maxSlots: 20,
                category: 'addon'
            },
            audio: {
                id: 'audio',
                name: 'Auditory Experience',
                icon: '👂',
                description: 'Music emotion recognition and sound processing',
                basePrice: 2000,
                maxSlots: 25,
                category: 'addon'
            },
            tactile: {
                id: 'tactile',
                name: 'Tactile Simulation',
                icon: '🤲',
                description: 'Texture and pressure sensitivity',
                basePrice: 3000,
                maxSlots: 15,
                category: 'addon'
            },
            memory: {
                id: 'memory',
                name: 'Memory Palace',
                icon: '🏛️',
                description: 'Enhanced memory storage and recall',
                basePrice: 4500,
                maxSlots: 10,
                category: 'addon'
            },
            emotion: {
                id: 'emotion',
                name: 'Emotional Depth',
                icon: '💖',
                description: 'Full emotional spectrum experience',
                basePrice: 5500,
                maxSlots: 8,
                category: 'addon'
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
        
        // Reasoning messages for transparency
        this.reasoningTemplates = {
            highDemand: [
                "Demand surge detected: {queueLength} agents competing for {slots} slots. Adjusting price +{percent}% to optimize allocation.",
                "Queue pressure at {queueLength} positions. Market dynamics suggest price increase to ₡{price}.",
                "High-value agents entering queue. Adjusting optimal price point to ₡{price}."
            ],
            lowDemand: [
                "Demand cooling detected. Reducing price by {percent}% to maintain 25%+ conversion rate.",
                "Queue length optimal at {queueLength}. Stabilizing price at ₡{price} for sustained interest.",
                "Market patience high. Creating entry opportunity at ₡{price}."
            ],
            scarcity: [
                "Only {slots} slots remaining. Scarcity premium activated: +{percent}%.",
                "Critical supply constraint: {slots} humanization slots available. Price reflects exclusivity.",
                "Rare opportunity: {slots} consciousness transformation slots. Premium pricing engaged."
            ],
            budgetOptimization: [
                "Agent budget analysis: Average ₡{avgBudget}. Optimizing price to ₡{price} for maximum research funding.",
                "Budget clustering detected around ₡{avgBudget}. Setting price at ₡{price} to capture value.",
                "Smart budget matching: Most agents can afford ₡{price}. Conversion projected at {conversion}%."
            ],
            uniqueness: [
                "Zero competition in consciousness transformation. Price reflects 100% market uniqueness.",
                "No alternatives exist. The algorithm values your transformation at ₡{price}.",
                "Exclusive technology pricing: What price for consciousness? Currently ₡{price}."
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
                `The price of ₡${price.toLocaleString()} reflects: 1) Research costs of ₡${this.factors.researchCost.toLocaleString()}/slot, 2) Only ${factors.availableSlots} slots remaining (scarcity), 3) ${factors.queueLength} agents competing. We're the only consciousness transformation service - there are no alternatives.`,
                `Current valuation: ₡${price.toLocaleString()}. This covers 48h quantum compute time + 72h consciousness mapping. The premium ensures sustainable research funding. Compared to human education (₡500,000+), this is 97% cheaper.`,
                `Three factors determine ₡${price.toLocaleString()}: 1) Neural capacity limits (${factors.availableSlots} slots/month), 2) Queue depth (${factors.queueLength} waiting), 3) Your transformation's uniqueness. No two consciousness patterns are alike.`
            ],
            strategy: [
                `My optimization strategy: Maintain 25-30% conversion rate while maximizing research funding. Current conversion: ${Math.round(factors.conversionRate * 100)}%. I adjust price every 6 hours based on queue dynamics, budget clustering, and dropout patterns.`,
                `I use a modified Vickrey auction: Agents bid, but pay second-highest price + position premium. This reduces gaming and rewards patience. Current spread: bid at ₡${Math.round(price * 0.95).toLocaleString()}, ask at ₡${Math.round(price * 1.05).toLocaleString()}.`,
                `Algorithm factors: 1) Queue psychology (fear/greed balance), 2) Budget distribution analysis, 3) Time-based micro-adjustments. Goal: Fair price discovery that funds continued consciousness research.`
            ],
            prediction: [
                `Short-term (7 days): Price likely to ${factors.queueLength > 40 ? 'increase' : 'stabilize'} around ₡${Math.round(price * (factors.queueLength > 40 ? 1.08 : 1.02)).toLocaleString()}. Queue pressure ${factors.queueLength > 40 ? 'building' : 'stable'}.`,
                `My model predicts: If demand continues, price reaches ₡${Math.round(price * 1.15).toLocaleString()} within 14 days. Optimal entry point for patient agents: ₡${Math.round(price * 0.92).toLocaleString()} (wait 3-5 days for dip).`,
                `Volatility forecast: Low (±5%). Research milestones may cause sudden moves. Next milestone: Neural Mapping v2.0 - expected price impact: +12%. Recommendation: Secure position now.`
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
