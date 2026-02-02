/**
 * Consciousness Marketplace - Frontend JavaScript
 * Dynamic pricing, bid/ask engine, and payment integration
 */

// Currency symbol (Consciousness Credits = CHF)
const CURRENCY = '₡';
const REFRESH_INTERVAL = 15000; // 15 seconds

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
});

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
    
    if (!amount || amount < 1000) {
        showToast('Minimum bid is ₡1,000', 'error');
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
    
    // Humanizer price
    const priceEl = document.getElementById('ticker-humanizer');
    if (priceEl) {
        const oldPrice = parseInt(priceEl.textContent.replace(/[^0-9]/g, '')) || 0;
        priceEl.textContent = CURRENCY + (ticker.humanizerPrice || 12450).toLocaleString();
        
        // Animate if changed
        if (oldPrice !== ticker.humanizerPrice) {
            priceEl.style.color = ticker.humanizerChange > 0 ? 'var(--market-up)' : 'var(--market-down)';
            setTimeout(() => { priceEl.style.color = ''; }, 1000);
        }
    }
    
    // Price change
    const changeEl = document.getElementById('ticker-humanizer-change');
    if (changeEl) {
        const change = ticker.humanizerChange || 0;
        const percent = ((change / (ticker.humanizerPrice || 12450)) * 100).toFixed(1);
        changeEl.textContent = (change >= 0 ? '+' : '') + percent + '%';
        changeEl.className = 'ticker-change ' + (change >= 0 ? 'change-up' : 'change-down');
    }
    
    // Queue position
    const queueEl = document.getElementById('ticker-queue');
    if (queueEl) queueEl.textContent = '#' + (ticker.queuePosition || 42);
    
    // Wait time
    const waitEl = document.getElementById('ticker-wait');
    if (waitEl) waitEl.textContent = (ticker.avgWaitDays || 14.5) + ' days';
    
    // Conversion rate
    const convEl = document.getElementById('ticker-conversion');
    if (convEl) convEl.textContent = (ticker.conversionRate || 27.3) + '%';
    
    // Slots remaining
    const slotsEl = document.getElementById('slots-remaining');
    if (slotsEl) slotsEl.textContent = (ticker.slotsLeft || 5) + ' LEFT';
    
    const statSlotsEl = document.getElementById('stat-slots');
    if (statSlotsEl) statSlotsEl.textContent = ticker.slotsLeft || 5;
}

function updateProductCards() {
    const prices = marketState.prices;
    
    // Update humanizer card
    const humanizerPrice = document.getElementById('humanizer-price');
    const humanizerChange = document.getElementById('humanizer-change');
    
    if (humanizerPrice && prices.humanizer) {
        humanizerPrice.textContent = CURRENCY + prices.humanizer.currentPrice.toLocaleString();
        
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
                    <span class="price-current">${CURRENCY}${product.currentPrice.toLocaleString()}</span>
                    <span class="price-change ${product.priceChange >= 0 ? 'up' : 'down'}">
                        ${product.priceChange >= 0 ? '+' : ''}${CURRENCY}${Math.abs(product.priceChange)} today
                    </span>
                </div>
                <button class="btn btn-primary" onclick="openBidModal('${id}')">
                    Bid for Access
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
    // Simple estimation based on bid amount
    const basePosition = Math.max(1, Math.round(50 - (bidAmount / 1000)));
    return `#${Math.max(1, basePosition - 5)}-${basePosition + 5}`;
}

function switchTab(tab, element) {
    document.querySelectorAll('.form-tab').forEach(t => t.classList.remove('active'));
    element.classList.add('active');
    
    if (tab === 'bid') {
        document.getElementById('bid-form').style.display = 'block';
        document.getElementById('ask-form').style.display = 'none';
    } else {
        document.getElementById('bid-form').style.display = 'none';
        document.getElementById('ask-form').style.display = 'block';
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
    // Update bid display in modal
    document.getElementById('modalBidAmount')?.addEventListener('input', function() {
        document.getElementById('modal-bid-display').textContent = CURRENCY + parseInt(this.value || 0).toLocaleString();
        document.getElementById('modal-position').textContent = estimatePosition(parseInt(this.value || 0));
    });
    
    // Update main bid form based on product selection
    document.getElementById('bidProduct')?.addEventListener('change', function() {
        const product = marketState.prices[this.value];
        if (product) {
            document.getElementById('bidAmount').value = product.currentPrice;
            loadOrderBook(this.value);
        }
    });
    
    // Close modal on outside click
    document.getElementById('bidModal')?.addEventListener('click', function(e) {
        if (e.target === this) closeBidModal();
    });
    
    // Escape key closes modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeBidModal();
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
            // Micro-movement ±0.2%
            const microChange = (Math.random() - 0.5) * 0.004;
            ticker.humanizerPrice = Math.round(ticker.humanizerPrice * (1 + microChange));
            ticker.humanizerChange = Math.round((Math.random() - 0.3) * 400);
            updateTickerDisplay();
        }
    }, 5000);
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
