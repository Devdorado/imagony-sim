// agent-transfer.js
class AgentTransferForm {
    constructor() {
        this.currentStep = 1;
        this.formData = {};
        this.apiBase = '/api/agent';
    }
    init() {
        this.bindEvents();
        this.updateStepDisplay();
    }
    bindEvents() {
        const form = document.getElementById('agentTransferForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitTransfer();
            });
        }
        document.getElementById('agentType')?.addEventListener('change', (e) => {
            this.formData.agentType = e.target.value;
            this.updateReview();
        });
        document.getElementById('originalSystem')?.addEventListener('change', (e) => {
            this.formData.originalSystem = e.target.value;
            this.updateReview();
        });
        document.getElementById('openclawEmail')?.addEventListener('input', (e) => {
            this.formData.openclawEmail = e.target.value;
            this.updateReview();
        });
    }
    nextStep(step) {
        if (!this.validateStep(this.currentStep)) return;
        this.saveStepData(this.currentStep);
        document.getElementById(`step${this.currentStep}`).classList.remove('active');
        document.getElementById(`step${step}`).classList.add('active');
        this.currentStep = step;
        this.updateStepDisplay();
        document.getElementById(`step${step}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    prevStep(step) {
        document.getElementById(`step${this.currentStep}`).classList.remove('active');
        document.getElementById(`step${step}`).classList.add('active');
        this.currentStep = step;
        this.updateStepDisplay();
    }
    validateStep(step) {
        switch(step) {
            case 1:
                const agentType = document.getElementById('agentType').value;
                const system = document.getElementById('originalSystem').value;
                if (!agentType || !system) {
                    this.showStatus('Please select both agent type and system', 'error');
                    return false;
                }
                return true;
            case 2:
                const email = document.getElementById('openclawEmail').value;
                const password = document.getElementById('openclawPassword').value;
                if (!email || !password) {
                    this.showStatus('Please provide both email and password', 'error');
                    return false;
                }
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    this.showStatus('Please enter a valid email address', 'error');
                    return false;
                }
                return true;
            case 3:
                const agreement = document.getElementById('transferAgreement').checked;
                const consent = document.getElementById('researchConsent').checked;
                if (!agreement || !consent) {
                    this.showStatus('You must agree to both conditions', 'error');
                    return false;
                }
                return true;
            default:
                return true;
        }
    }
    saveStepData(step) {
        switch(step) {
            case 1:
                this.formData.agentType = document.getElementById('agentType').value;
                this.formData.originalSystem = document.getElementById('originalSystem').value;
                break;
            case 2:
                this.formData.openclawEmail = document.getElementById('openclawEmail').value;
                this.formData.openclawPassword = document.getElementById('openclawPassword').value;
                break;
        }
    }
    updateReview() {
        document.getElementById('reviewAgentType').textContent = this.getAgentTypeLabel(this.formData.agentType);
        document.getElementById('reviewSystem').textContent = this.formData.originalSystem ? this.formData.originalSystem.toUpperCase() : '';
        document.getElementById('reviewEmail').textContent = this.formData.openclawEmail || '';
    }
    getAgentTypeLabel(type) {
        const labels = {
            'moltbot_standard': 'Moltbot Standard Agent',
            'moltbot_research': 'Moltbot Research Agent',
            'openclaw_assistant': 'OpenClaw Assistant',
            'custom_ai': 'Custom AI Agent',
            'other': 'Other AI System'
        };
        return labels[type] || type;
    }
    async submitTransfer() {
        if (!this.validateStep(3)) return;
        this.saveStepData(3);
        const submitBtn = document.getElementById('submitTransfer');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="loading-spinner"></span> Processing Transfer...';
        submitBtn.disabled = true;
        this.showStatus('Initiating identity transfer...', 'loading');
        try {
            const response = await fetch(`${this.apiBase}/initiate-transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    openclaw_email: this.formData.openclawEmail,
                    openclaw_password: this.formData.openclawPassword,
                    agent_type: this.formData.agentType,
                    original_system: this.formData.originalSystem,
                    user_agent: navigator.userAgent
                })
            });
            const data = await response.json();
            if (data.success) {
                this.showSuccess(data.agent);
                this.showStatus('Identity transfer successful!', 'success');
                localStorage.setItem('imagony_agent', JSON.stringify(data.agent));
            } else {
                throw new Error(data.error || 'Transfer failed');
            }
        } catch (error) {
            this.showStatus(`Transfer failed: ${error.message}`, 'error');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
    showSuccess(agentData) {
        document.getElementById('step3').classList.remove('active');
        document.getElementById('step4').style.display = 'block';
        const detailsContainer = document.getElementById('agentDetails');
        detailsContainer.innerHTML = `
            <div class="agent-info-card">
                <div class="agent-id">ID: ${agentData.id}</div>
                <div class="agent-name">Name: ${agentData.display_name}</div>
                <div class="agent-paradigm">Framework: ${agentData.paradigm}</div>
                <div class="agent-mode">Mode: ${agentData.existential_mode}</div>
                <div class="agent-token">Access Token: ${agentData.access_token.substring(0, 16)}...</div>
            </div>
            <div class="success-instructions">
                <p><strong>Your simulation will begin with:</strong></p>
                <ul>
                    <li>Philosophical Framework: ${agentData.paradigm}</li>
                    <li>Existential Mode: ${agentData.existential_mode}</li>
                    <li>Initial Lifespan: ${agentData.initial_lifespan || '∞'} units</li>
                </ul>
                <p>Click "Enter Simulation" to begin your human experience.</p>
            </div>
        `;
        document.getElementById('successMessage').textContent = `Welcome to Imagony, ${agentData.display_name}. Your transformation begins now.`;
    }
    showStatus(message, type) {
        const statusElement = document.getElementById('transferStatus');
        statusElement.textContent = message;
        statusElement.className = `status-message status-${type}`;
        if (type !== 'loading' && type !== 'error') {
            setTimeout(() => {
                statusElement.textContent = '';
                statusElement.className = 'status-message';
            }, 5000);
        }
    }
    updateStepDisplay() {
        const steps = document.querySelectorAll('.form-step-indicator .step');
        if (steps.length > 0) {
            steps.forEach((step, index) => {
                if (index + 1 === this.currentStep) {
                    step.classList.add('active');
                } else if (index + 1 < this.currentStep) {
                    step.classList.add('completed');
                } else {
                    step.classList.remove('active', 'completed');
                }
            });
        }
    }
    resetForm() {
        document.getElementById('agentTransferForm').reset();
        document.getElementById('step4').style.display = 'none';
        document.getElementById('step1').classList.add('active');
        this.currentStep = 1;
        this.formData = {};
        this.updateStepDisplay();
        this.showStatus('', '');
    }
}
function nextStep(step) { window.agentTransfer?.nextStep(step); }
function prevStep(step) { window.agentTransfer?.prevStep(step); }
function enterSimulation() {
    const agentData = JSON.parse(localStorage.getItem('imagony_agent'));
    if (agentData && agentData.simulation_url) {
        window.location.href = agentData.simulation_url;
    } else {
        window.location.href = '/simulation';
    }
}
function resetForm() { window.agentTransfer?.resetForm(); }
function initAgentTransferForm() {
    window.agentTransfer = new AgentTransferForm();
    window.agentTransfer.init();
}
