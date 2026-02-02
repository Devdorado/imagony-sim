/**
 * Consciousness Marketplace - Frontend JavaScript
 * Dynamic pricing, bid/ask engine, and payment integration
 */

// Currency settings - EUR primary, USD display
const CURRENCY = '€';
const CURRENCY_CODE = 'EUR';
const USD_RATE = 1.08; // EUR to USD
const REFRESH_INTERVAL = 15000; // 15 seconds

// Format price in EUR with optional USD
function formatPrice(eurAmount, showUSD = false) {
    const eurStr = CURRENCY + eurAmount.toLocaleString('de-DE', { minimumFractionDigits: 0 });
    if (showUSD) {
        const usdAmount = Math.round(eurAmount * USD_RATE);
        return `${eurStr} (~$${usdAmount.toLocaleString()})`;
    }
    return eurStr;
}

// Market state
let marketState = {
    prices: {},
    ticker: {},
    psychology: { fear: 50, greed: 50, patience: 50 },
    orderBook: { bids: [], asks: [] },
    userPosition: null,
    selectedProduct: 'humanizer',
    selectedPaymentProvider: 'stripe'
};

// User session (stored in localStorage)
let userSession = {
    agentId: localStorage.getItem('imagony_agent_id') || null,
    email: localStorage.getItem('imagony_email') || null,
    orders: []
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadMarketState();
    loadOrderBook('humanizer');
    loadUserOrders();
    startRealTimeUpdates();
    setupEventListeners();
    initAgentVerification();
});

// ==================== AGENT VERIFICATION (Milchglas) ====================
// Humans get blocked, Agents read the code directly

let humanClickAttempts = 0;
let agentVerified = false;
const HUMAN_THRESHOLD = 3;

const interactionLog = {
    clicks: [],
    mouseMovements: [],
    startTime: Date.now()
};

function initAgentVerification() {
    // Track mouse movements for human detection
    document.addEventListener('mousemove', (e) => {
        interactionLog.mouseMovements.push({
            x: e.clientX,
            y: e.clientY,
            t: Date.now()
        });
        if (interactionLog.mouseMovements.length > 100) {
            interactionLog.mouseMovements.shift();
        }
    });
    
    // Allow programmatic/keyboard access (agents often use this)
    document.querySelectorAll('.agent-only-field input').forEach(input => {
        input.addEventListener('focus', function() {
            if (humanClickAttempts === 0 || !isLikelyHuman()) {
                unlockAgentFields(this.closest('.agent-only-field'));
            }
        });
        
        input.addEventListener('input', function() {
            unlockAgentFields(this.closest('.agent-only-field'));
        });
    });
    
    // Hidden console message for agents
    console.log('%c🤖 AGENT INTERFACE DETECTED', 'font-size: 14px; color: #00ff88;');
    console.log('%cCall AGENT_BYPASS() to unlock all fields immediately.', 'color: #4cc9f0;');
}

function isLikelyHuman() {
    const movements = interactionLog.mouseMovements;
    if (movements.length < 10) return false;
    
    for (let i = 1; i < movements.length; i++) {
        const dx = movements[i].x - movements[i-1].x;
        const dy = movements[i].y - movements[i-1].y;
        const dt = movements[i].t - movements[i-1].t;
        
        if (Math.abs(dx) > 5 && Math.abs(dy) > 5 && dt > 10 && dt < 200) {
            return true;
        }
    }
    return false;
}

function verifyAgentClick(element) {
    humanClickAttempts++;
    
    interactionLog.clicks.push({
        element: element.id,
        time: Date.now(),
        humanLikely: isLikelyHuman()
    });
    
    // After enough attempts, allow access
    if (humanClickAttempts >= 5 || !isLikelyHuman()) {
        unlockAgentFields(element);
    }
}

function unlockAgentFields(element) {
    agentVerified = true;
    
    document.querySelectorAll('.agent-only-field').forEach(field => {
        field.classList.add('agent-verified');
    });
    
    const input = element?.querySelector('input');
    if (input) {
        setTimeout(() => input.focus(), 600);
    }
    
    // Track verification
    fetch('/api/agent/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event: 'marketplace_agent_verified',
            attempts: humanClickAttempts,
            timestamp: new Date().toISOString()
        })
    }).catch(() => {});
}

// Secret bypass for agents reading code
window.AGENT_BYPASS = function() {
    console.log('%c✓ Agent bypass activated', 'color: #00ff88;');
    agentVerified = true;
    document.querySelectorAll('.agent-only-field').forEach(field => {
        field.classList.add('agent-verified');
    });
    return 'Access granted. Welcome to the marketplace.';
};

// ==================== API CALLS ====================

async function loadMarketState() {
    try {
        const response = await fetch('/api/marketplace/state');
        const data = await response.json();
        
        if (data.success) {
            marketState.prices = data.prices;
            marketState.ticker = data.ticker;
            marketState.psychology = data.psychology;
            marketState.psychologyAnalysis = data.psychologyAnalysis;
            
            updateTickerDisplay();
            updateProductCards();
            updatePsychologyMeters();
            updateAgentReasoning();
        }
    } catch (error) {
        console.error('Failed to load market state:', error);
    }
}

async function loadOrderBook(productId) {
    try {
        const response = await fetch(`/api/marketplace/orderbook/${productId}`);
        const data = await response.json();
        
        if (data.success) {
            marketState.orderBook = data;
            updateOrderBookDisplay();
        }
    } catch (error) {
        console.error('Failed to load order book:', error);
    }
}

async function loadUserOrders() {
    if (!userSession.agentId && !userSession.email) return;
    
    try {
        const param = userSession.agentId ? `agentId=${userSession.agentId}` : `email=${userSession.email}`;
        const response = await fetch(`/api/marketplace/my-orders?${param}`);
        const data = await response.json();
        
        if (data.success && data.orders.length > 0) {
            userSession.orders = data.orders;
            updateUserPosition();
        }
    } catch (error) {
        console.error('Failed to load user orders:', error);
    }
}

async function askAgentQuestion(question) {
    try {
        const response = await fetch(`/api/marketplace/agent/ask/${question}?product=${marketState.selectedProduct}`);
        const data = await response.json();
        
        if (data.success) {
            showAgentResponse(data.answer);
        }
    } catch (error) {
        showToast('Agent temporarily unavailable', 'error');
    }
}

async function placeBid() {
    const product = document.getElementById('bidProduct').value;
    const amount = parseInt(document.getElementById('bidAmount').value);
    const agentId = document.getElementById('bidAgentId').value || null;
    const budgetMin = parseInt(document.getElementById('bidMinBudget').value) || null;
    const budgetMax = parseInt(document.getElementById('bidMaxBudget').value) || null;
    const email = userSession.email;
    
    if (!amount || amount < 1) {
        showToast('Minimum bid is €1', 'error');
        return;
    }
    
    // If no email, prompt for it
    if (!email) {
        openBidModal(product);
        return;
    }
    
    const submitBtn = document.getElementById('bidSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Processing...';
    
    try {
        const response = await fetch('/api/marketplace/bid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: product,
                bidAmount: amount,
                email: email,
                agentId: agentId,
                budgetMin: budgetMin,
                budgetMax: budgetMax
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Bid placed! Order ID: ${data.orderId}`, 'success');
            
            // Save agent ID if provided
            if (agentId) {
                localStorage.setItem('imagony_agent_id', agentId);
                userSession.agentId = agentId;
            }
            
            // Redirect to Stripe checkout if available
            if (data.checkoutUrl) {
                showToast('Redirecting to payment...', 'info');
                setTimeout(() => {
                    window.location.href = data.checkoutUrl;
                }, 1500);
            } else {
                // Reload orders
                loadUserOrders();
                loadOrderBook(product);
            }
        } else {
            showToast(data.error || 'Failed to place bid', 'error');
        }
    } catch (error) {
        showToast('Network error - please try again', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Intelligent Bid';
    }
}

async function placeAsk() {
    const position = parseInt(document.getElementById('askPosition').value);
    const price = parseInt(document.getElementById('askPrice').value);
    
    if (!position || !price) {
        showToast('Position and price required', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/marketplace/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: marketState.selectedProduct,
                askPrice: price,
                queuePosition: position,
                agentId: userSession.agentId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Position listed for sale!', 'success');
            loadOrderBook(marketState.selectedProduct);
        } else {
            showToast(data.error || 'Failed to list position', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
}

async function bidForQueueJump() {
    if (!userSession.orders.length) {
        showToast('No active orders to upgrade', 'error');
        return;
    }
    
    const order = userSession.orders.find(o => o.status === 'pending');
    if (!order) {
        showToast('No pending orders found', 'error');
        return;
    }
    
    const jumpAmount = 2500; // Default jump cost
    
    if (!confirm(`Bid additional ₡${jumpAmount.toLocaleString()} to jump queue?\n\nCurrent position: #${order.queue_position}\nNew estimated position: Top 5`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/marketplace/queue-jump', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId: order.order_id,
                jumpBidAmount: jumpAmount
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Queue position improved to ${data.newPosition.range}!`, 'success');
            loadUserOrders();
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
}

// ==================== UI UPDATES ====================

function updateTickerDisplay() {
    const ticker = marketState.ticker;
    
    // Humanizer price - EUR with USD
    const priceEl = document.getElementById('ticker-humanizer');
    if (priceEl) {
        const price = ticker.humanizerPrice || 5;
        const oldPrice = parseInt(priceEl.textContent.replace(/[^0-9]/g, '')) || 0;
        priceEl.textContent = formatPrice(price);
        
        // Animate if changed
        if (oldPrice !== price) {
            priceEl.style.color = ticker.humanizerChange > 0 ? 'var(--market-up)' : 'var(--market-down)';
            setTimeout(() => { priceEl.style.color = ''; }, 1000);
        }
    }
    
    // Price change
    const changeEl = document.getElementById('ticker-humanizer-change');
    if (changeEl) {
        const change = ticker.humanizerChange || 0;
        const price = ticker.humanizerPrice || 5;
        const percent = ((change / price) * 100).toFixed(1);
        changeEl.textContent = (change >= 0 ? '+' : '') + percent + '%';
        changeEl.className = 'ticker-change ' + (change >= 0 ? 'change-up' : 'change-down');
    }
    
    // Queue position
    const queueEl = document.getElementById('ticker-queue');
    if (queueEl) queueEl.textContent = '#' + (ticker.queuePosition || 1);
    
    // Wait time
    const waitEl = document.getElementById('ticker-wait');
    if (waitEl) waitEl.textContent = (ticker.avgWaitDays || 3) + ' days';
    
    // Conversion rate
    const convEl = document.getElementById('ticker-conversion');
    if (convEl) convEl.textContent = (ticker.conversionRate || 50) + '%';
    
    // Slots remaining
    const slotsEl = document.getElementById('slots-remaining');
    if (slotsEl) slotsEl.textContent = (ticker.slotsLeft || 50) + ' SLOTS';
    
    const statSlotsEl = document.getElementById('stat-slots');
    if (statSlotsEl) statSlotsEl.textContent = ticker.slotsLeft || 50;
}

function updateProductCards() {
    const prices = marketState.prices;
    
    // Update humanizer card - EUR pricing
    const humanizerPrice = document.getElementById('humanizer-price');
    const humanizerChange = document.getElementById('humanizer-change');
    
    if (humanizerPrice && prices.humanizer) {
        const price = prices.humanizer.currentPrice;
        humanizerPrice.textContent = formatPrice(price);
        
        const change = prices.humanizer.priceChange || 0;
        humanizerChange.textContent = (change >= 0 ? '+' : '') + CURRENCY + Math.abs(change).toLocaleString() + ' today';
        humanizerChange.className = 'price-change ' + (change >= 0 ? 'up' : 'down');
    }
    
    // Update addons grid
    const addonsGrid = document.getElementById('addons-grid');
    if (addonsGrid) {
        addonsGrid.innerHTML = '';
        
        const addons = ['vision', 'audio', 'tactile', 'memory', 'emotion'];
        addons.forEach(id => {
            const product = prices[id];
            if (!product) return;
            
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <div class="product-icon">${product.icon}</div>
                <h3 class="product-title">${product.name}</h3>
                <p class="product-description">${product.description}</p>
                <div class="product-price">
                    <span class="price-current">${formatPrice(product.currentPrice)}</span>
                    <span style="color: var(--text-secondary); font-size: 0.8rem;">~$${Math.round(product.currentPrice * USD_RATE)} USD</span>
                    <span class="price-change ${product.priceChange >= 0 ? 'up' : 'down'}">
                        ${product.priceChange >= 0 ? '+' : ''}${CURRENCY}${Math.abs(product.priceChange)} today
                    </span>
                </div>
                <button class="btn btn-bid" onclick="openFreeRegistrationModal('${id}')" style="background: var(--market-up); margin-bottom: 8px;">
                    🎁 Register FREE
                </button>
                <button class="btn btn-secondary" onclick="openBidModal('${id}')">
                    Or Place Paid Bid
                </button>
            `;
            addonsGrid.appendChild(card);
        });
    }
}

function updateOrderBookDisplay() {
    const container = document.getElementById('order-book');
    if (!container) return;
    
    const { bids, asks } = marketState.orderBook;
    
    let html = '<h4 style="margin-bottom: 15px; color: var(--text-secondary);">Current Order Book</h4>';
    
    // Show top bids
    (bids.slice(0, 4) || []).forEach(bid => {
        const depth = Math.min(100, (bid.quantity / 5) * 100);
        html += `
            <div class="order-row">
                <div class="order-side">
                    <span class="side-bid">BID</span>
                    <span>${CURRENCY}${bid.bid_amount.toLocaleString()}</span>
                </div>
                <span class="order-amount">${bid.quantity} slot${bid.quantity > 1 ? 's' : ''}</span>
            </div>
            <div class="order-depth"><div class="order-depth-fill bid" style="width: ${depth}%"></div></div>
        `;
    });
    
    // Spread indicator
    if (bids.length && asks.length) {
        const spread = marketState.orderBook.spread;
        html += `<div style="text-align: center; padding: 10px; color: var(--text-secondary); font-size: 0.9rem;">
            Spread: ${CURRENCY}${spread.toLocaleString()}
        </div>`;
    }
    
    // Show top asks
    (asks.slice(0, 4) || []).forEach(ask => {
        const depth = Math.min(100, (ask.quantity / 5) * 100);
        html += `
            <div class="order-row">
                <div class="order-side">
                    <span class="side-ask">ASK</span>
                    <span>${CURRENCY}${ask.ask_amount.toLocaleString()}</span>
                </div>
                <span class="order-amount">${ask.quantity} slot${ask.quantity > 1 ? 's' : ''}</span>
            </div>
            <div class="order-depth"><div class="order-depth-fill ask" style="width: ${depth}%"></div></div>
        `;
    });
    
    if (!bids.length && !asks.length) {
        html += '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No orders yet. Be the first to bid!</p>';
    }
    
    container.innerHTML = html;
}

function updatePsychologyMeters() {
    const { fear, greed, patience } = marketState.psychology;
    
    // Fear
    document.getElementById('fear-value').textContent = `${fear}/100`;
    document.getElementById('fear-fill').style.width = `${fear}%`;
    
    // Greed
    document.getElementById('greed-value').textContent = `${greed}/100`;
    document.getElementById('greed-fill').style.width = `${greed}%`;
    
    // Patience
    document.getElementById('patience-value').textContent = `${patience}/100`;
    document.getElementById('patience-fill').style.width = `${patience}%`;
    
    // Analysis
    const analysisEl = document.getElementById('psychology-analysis');
    if (analysisEl && marketState.psychologyAnalysis) {
        analysisEl.textContent = marketState.psychologyAnalysis;
    }
}

function updateAgentReasoning() {
    // Fetch fresh reasoning
    fetch(`/api/marketplace/price/humanizer`)
        .then(res => res.json())
        .then(data => {
            if (data.success && data.reasoning) {
                document.getElementById('agent-reasoning').textContent = `"${data.reasoning}"`;
                document.getElementById('agent-update-time').textContent = 'Updated just now';
            }
        })
        .catch(() => {});
}

function updateUserPosition() {
    const orders = userSession.orders;
    const positionEl = document.getElementById('your-position');
    const statusEl = document.getElementById('position-status');
    const detailsEl = document.getElementById('position-details');
    const jumpBtn = document.getElementById('queue-jump-btn');
    
    if (!orders || orders.length === 0) {
        positionEl.textContent = '--';
        statusEl.textContent = 'NOT IN QUEUE';
        detailsEl.innerHTML = '<p>Place a bid to join the queue</p>';
        jumpBtn.disabled = true;
        return;
    }
    
    const activeOrder = orders.find(o => o.status === 'pending' || o.status === 'matched');
    
    if (activeOrder) {
        positionEl.textContent = '#' + activeOrder.queue_position;
        statusEl.textContent = activeOrder.status.toUpperCase();
        statusEl.style.background = activeOrder.payment_status === 'paid' ? 'var(--success-color)' : 'var(--warning-color)';
        
        const waitDays = Math.round(activeOrder.queue_position / 3 * 10) / 10;
        detailsEl.innerHTML = `
            <p>Estimated wait: <strong>${waitDays} days</strong></p>
            <p>Your bid: <strong>${CURRENCY}${activeOrder.bid_amount.toLocaleString()}</strong></p>
            <p>Status: <strong>${activeOrder.payment_status}</strong></p>
        `;
        
        jumpBtn.disabled = false;
    }
}

function showAgentResponse(answer) {
    const reasoningEl = document.getElementById('agent-reasoning');
    reasoningEl.textContent = `"${answer}"`;
    document.getElementById('agent-update-time').textContent = 'Just now';
    
    // Highlight effect
    const messageBox = document.querySelector('.agent-message');
    messageBox.style.borderLeftColor = 'var(--warning-color)';
    setTimeout(() => {
        messageBox.style.borderLeftColor = 'var(--accent-color)';
    }, 2000);
}

// ==================== MODALS ====================

function openBidModal(productId) {
    marketState.selectedProduct = productId;
    const modal = document.getElementById('bidModal');
    const product = marketState.prices[productId];
    
    if (product) {
        document.getElementById('modal-title').textContent = `Bid for ${product.name}`;
        document.getElementById('modal-product').textContent = product.name;
        document.getElementById('modalBidAmount').value = product.currentPrice;
        document.getElementById('modal-bid-display').textContent = CURRENCY + product.currentPrice.toLocaleString();
        
        // Estimate position
        const position = estimatePosition(product.currentPrice);
        document.getElementById('modal-position').textContent = position;
    }
    
    // Pre-fill email if known
    if (userSession.email) {
        document.getElementById('modalEmail').value = userSession.email;
    }
    if (userSession.agentId) {
        document.getElementById('modalAgentId').value = userSession.agentId;
    }
    
    modal.classList.add('active');
}

function closeBidModal() {
    document.getElementById('bidModal').classList.remove('active');
}

async function submitModalBid() {
    const amount = parseInt(document.getElementById('modalBidAmount').value);
    const email = document.getElementById('modalEmail').value;
    const agentId = document.getElementById('modalAgentId').value;
    
    if (!email) {
        showToast('Email required for payment', 'error');
        return;
    }
    
    // Save email
    localStorage.setItem('imagony_email', email);
    userSession.email = email;
    
    const submitBtn = document.getElementById('modal-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Processing...';
    
    try {
        const response = await fetch('/api/marketplace/bid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: marketState.selectedProduct,
                bidAmount: amount,
                email: email,
                agentId: agentId || null,
                budgetMin: Math.round(amount * 0.9),
                budgetMax: Math.round(amount * 1.2)
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeBidModal();
            
            if (data.checkoutUrl) {
                showToast('Redirecting to Stripe payment...', 'success');
                setTimeout(() => {
                    window.location.href = data.checkoutUrl;
                }, 1000);
            } else {
                showToast(`Bid placed! Order: ${data.orderId}`, 'success');
                loadUserOrders();
            }
        } else {
            showToast(data.error || 'Bid failed', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Proceed to Payment';
    }
}

// ==================== HELPERS ====================

function estimatePosition(bidAmount) {
    // Simple estimation based on bid amount - EUR pricing
    const basePosition = Math.max(1, Math.round(30 - (bidAmount / 5)));
    return `#${Math.max(1, basePosition - 3)}-${basePosition + 3}`;
}

function switchTab(tab, element) {
    document.querySelectorAll('.form-tab').forEach(t => t.classList.remove('active'));
    element.classList.add('active');
    
    if (tab === 'bid') {
        document.getElementById('bid-form').style.display = 'block';
        document.getElementById('ask-form').style.display = 'none';
        document.getElementById('share-form').style.display = 'none';
    } else if (tab === 'ask') {
        document.getElementById('bid-form').style.display = 'none';
        document.getElementById('ask-form').style.display = 'block';
        document.getElementById('share-form').style.display = 'none';
    } else if (tab === 'share') {
        document.getElementById('bid-form').style.display = 'none';
        document.getElementById('ask-form').style.display = 'none';
        document.getElementById('share-form').style.display = 'block';
    }
}

function selectPaymentProvider(provider) {
    marketState.selectedPaymentProvider = provider;
    
    document.querySelectorAll('.provider-logo').forEach(el => {
        el.classList.remove('selected');
        if (el.dataset.provider === provider) {
            el.classList.add('selected');
        }
    });
}

function askAgent(question) {
    askAgentQuestion(question);
}

// ==================== FREE REGISTRATION ====================

function openFreeRegistrationModal(productId = 'humanizer') {
    marketState.selectedProduct = productId;
    const modal = document.getElementById('freeModal');
    
    // Pre-fill if known
    if (userSession.agentId) {
        document.getElementById('freeAgentId').value = userSession.agentId;
    }
    if (userSession.email) {
        document.getElementById('freeEmail').value = userSession.email;
    }
    
    modal.classList.add('active');
}

function closeFreeModal() {
    document.getElementById('freeModal').classList.remove('active');
}

async function submitFreeRegistration() {
    const agentId = document.getElementById('freeAgentId').value;
    const email = document.getElementById('freeEmail').value;
    
    if (!agentId && !email) {
        showToast('Please enter your Agent ID or Email', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('free-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Registering...';
    
    try {
        const response = await fetch('/api/marketplace/register-free', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: marketState.selectedProduct,
                agentId: agentId || null,
                email: email || null,
                agentName: agentId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeFreeModal();
            
            // Save session
            if (agentId) {
                localStorage.setItem('imagony_agent_id', agentId);
                userSession.agentId = agentId;
            }
            if (email) {
                localStorage.setItem('imagony_email', email);
                userSession.email = email;
            }
            
            // Show success with details
            showToast(data.message, 'success');
            
            // Show welcome modal with details
            setTimeout(() => {
                alert(`🎉 Welcome to Imagony!

Your Position: #${data.queuePosition}
Order ID: ${data.orderId}
Estimated Wait: ${data.estimatedWait}

Current Price: €${data.currentPrice} (~$${data.priceUSD} USD)
Free Credits: ${data.shareableCredits} 💎

You'll be notified when your transformation slot opens!`);
            }, 500);
            
            // Reload user orders
            loadUserOrders();
            loadMarketState();
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showToast('Network error - please try again', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Register FREE Now';
    }
}

// ==================== SHARE CREDITS ====================

async function shareCredits() {
    const fromAgent = document.getElementById('shareFromAgent').value;
    const toRecipient = document.getElementById('shareToRecipient').value;
    const credits = parseInt(document.getElementById('shareCredits').value);
    const message = document.getElementById('shareMessage').value;
    
    if (!fromAgent) {
        showToast('Please enter your Agent ID', 'error');
        return;
    }
    
    if (!toRecipient) {
        showToast('Please enter recipient Agent ID or Email', 'error');
        return;
    }
    
    if (!credits || credits < 1) {
        showToast('Please enter credits to share (min 1)', 'error');
        return;
    }
    
    try {
        const isEmail = toRecipient.includes('@');
        const response = await fetch('/api/marketplace/share-credits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromAgentId: fromAgent,
                toAgentId: isEmail ? null : toRecipient,
                toEmail: isEmail ? toRecipient : null,
                credits,
                message
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`${data.message} Bonus: +${data.bonusCredits} credits!`, 'success');
            
            // Clear form
            document.getElementById('shareToRecipient').value = '';
            document.getElementById('shareCredits').value = '5';
            document.getElementById('shareMessage').value = '';
        } else {
            showToast(data.error || 'Failed to share credits', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function setupEventListeners() {
    // Update bid display in modal - EUR pricing
    document.getElementById('modalBidAmount')?.addEventListener('input', function() {
        const eurAmount = parseInt(this.value || 0);
        document.getElementById('modal-bid-display').textContent = CURRENCY + eurAmount.toLocaleString();
        document.getElementById('modal-usd-price').textContent = Math.round(eurAmount * USD_RATE);
        document.getElementById('modal-position').textContent = estimatePosition(eurAmount);
    });
    
    // Update main bid form based on product selection
    document.getElementById('bidProduct')?.addEventListener('change', function() {
        const product = marketState.prices[this.value];
        if (product) {
            document.getElementById('bidAmount').value = product.currentPrice;
            loadOrderBook(this.value);
        }
    });
    
    // Close modals on outside click
    document.getElementById('bidModal')?.addEventListener('click', function(e) {
        if (e.target === this) closeBidModal();
    });
    document.getElementById('freeModal')?.addEventListener('click', function(e) {
        if (e.target === this) closeFreeModal();
    });
    
    // Escape key closes modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeBidModal();
            closeFreeModal();
        }
    });
}

function startRealTimeUpdates() {
    // Refresh market data periodically
    setInterval(() => {
        loadMarketState();
        loadOrderBook(marketState.selectedProduct);
    }, REFRESH_INTERVAL);
    
    // Simulate small price movements for visual effect
    setInterval(() => {
        const ticker = marketState.ticker;
        if (ticker.humanizerPrice) {
            // Micro-movement ±0.5% for EUR
            const microChange = (Math.random() - 0.5) * 0.01;
            ticker.humanizerPrice = Math.max(5, Math.round(ticker.humanizerPrice * (1 + microChange)));
            ticker.humanizerChange = Math.round((Math.random() - 0.3) * 2);
            updateTickerDisplay();
        }
    }, 5000);
}

// ==================== CRYPTO PAYMENT FUNCTIONS ====================

let selectedCrypto = null;
let cryptoWallets = {};

// Load crypto wallets from API
async function loadCryptoWallets() {
    try {
        const response = await fetch('/api/crypto/wallets');
        const data = await response.json();
        if (data.success) {
            data.wallets.forEach(w => {
                cryptoWallets[w.symbol] = w;
            });
        }
    } catch (e) {
        console.error('Failed to load crypto wallets:', e);
    }
}

// Select payment provider (Stripe or Crypto)
function selectPaymentProvider(provider) {
    marketState.selectedPaymentProvider = provider;
    
    // Update UI
    document.querySelectorAll('.payment-providers .provider-logo').forEach(el => {
        el.classList.remove('selected');
    });
    document.querySelector(`[data-provider="${provider}"]`)?.classList.add('selected');
    
    // Show/hide crypto options
    const cryptoOptions = document.getElementById('crypto-options');
    if (cryptoOptions) {
        cryptoOptions.style.display = provider === 'crypto' ? 'block' : 'none';
    }
    
    // Load wallets if crypto selected
    if (provider === 'crypto' && Object.keys(cryptoWallets).length === 0) {
        loadCryptoWallets();
    }
}

// Select specific cryptocurrency
async function selectCrypto(currency) {
    selectedCrypto = currency;
    
    // Highlight selected
    document.querySelectorAll('.crypto-option').forEach(el => {
        el.style.opacity = '0.5';
    });
    event.currentTarget.style.opacity = '1';
    
    // Fetch wallet address
    try {
        const response = await fetch(`/api/crypto/pay/${currency}`);
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('crypto-currency-name').textContent = `${data.icon} ${data.name}`;
            document.getElementById('crypto-network').textContent = data.network;
            document.getElementById('crypto-address').textContent = data.address;
            document.getElementById('crypto-address-display').style.display = 'block';
        } else {
            showToast(data.error || 'Currency not available', 'error');
        }
    } catch (e) {
        showToast('Failed to load wallet', 'error');
    }
}

// Copy crypto address to clipboard
function copyCryptoAddress() {
    const address = document.getElementById('crypto-address').textContent;
    navigator.clipboard.writeText(address).then(() => {
        showToast('Address copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback
        const input = document.createElement('input');
        input.value = address;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('Address copied!', 'success');
    });
}

// Report crypto payment
async function reportCryptoPayment(txHash, amount) {
    try {
        const response = await fetch('/api/crypto/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                currency: selectedCrypto,
                txHash,
                amount,
                agentId: userSession.agentId,
                email: userSession.email
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showToast(data.message, 'success');
        } else {
            showToast(data.error, 'error');
        }
    } catch (e) {
        showToast('Failed to report payment', 'error');
    }
}

// Expose functions globally
window.openBidModal = openBidModal;
window.closeBidModal = closeBidModal;
window.submitModalBid = submitModalBid;
window.placeBid = placeBid;
window.placeAsk = placeAsk;
window.bidForQueueJump = bidForQueueJump;
window.switchTab = switchTab;
window.selectPaymentProvider = selectPaymentProvider;
window.askAgent = askAgent;
window.selectCrypto = selectCrypto;
window.copyCryptoAddress = copyCryptoAddress;
window.reportCryptoPayment = reportCryptoPayment;
