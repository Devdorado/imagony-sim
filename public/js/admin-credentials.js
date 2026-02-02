/**
 * Imagony Admin Dashboard - Credential Access Module
 * Handles secure credential viewing and decryption
 */

const AdminCredentials = {
    currentPage: 1,
    pageSize: 20,
    currentAgentId: null,
    accessLogs: [],
    
    /**
     * Load credential access logs
     */
    async load(page = 1) {
        this.currentPage = page;
        
        try {
            const queryParams = new URLSearchParams({
                page: page,
                limit: this.pageSize
            });
            
            const response = await adminDashboard.apiRequest(`/credentials/logs?${queryParams}`);
            
            if (response.success) {
                this.accessLogs = response.logs;
                this.renderLogs(response.logs);
                this.renderStats(response.stats);
            }
        } catch (error) {
            console.error('Credentials load error:', error);
            adminDashboard.showToast('error', 'Error', 'Failed to load credential access logs');
        }
    },
    
    /**
     * Render access logs table
     */
    renderLogs(logs) {
        const tbody = document.querySelector('#credentialAccessTable tbody');
        if (!tbody) return;
        
        if (!logs || logs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <div class="empty-icon">🔐</div>
                        <div class="empty-text">No credential access logs</div>
                        <div class="empty-hint">Access logs will appear when credentials are viewed or decrypted</div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = logs.map(log => `
            <tr class="${log.action === 'DECRYPT' ? 'highlight' : ''}">
                <td>${adminDashboard.formatDate(log.accessed_at)}</td>
                <td>
                    <span class="admin-badge">${log.admin_username}</span>
                </td>
                <td>
                    <a href="#" onclick="AdminAgents.showDetail('${log.agent_id}'); return false;" 
                       class="agent-id-link">
                        ${log.agent_id}
                    </a>
                </td>
                <td>
                    <span class="action-badge action-${log.action.toLowerCase()}">
                        ${log.action}
                    </span>
                </td>
                <td>${log.reason || '-'}</td>
                <td><code>${log.ip_address || '-'}</code></td>
                <td>
                    <span class="status-indicator ${log.success ? 'success' : 'failed'}">
                        ${log.success ? '✓' : '✗'}
                    </span>
                </td>
            </tr>
        `).join('');
    },
    
    /**
     * Render credential stats
     */
    renderStats(stats) {
        if (!stats) return;
        
        const statsContainer = document.getElementById('credentialStats');
        if (!statsContainer) return;
        
        statsContainer.innerHTML = `
            <div class="cred-stat-card">
                <div class="cred-stat-value">${stats.total_accesses || 0}</div>
                <div class="cred-stat-label">Total Accesses</div>
            </div>
            <div class="cred-stat-card warning">
                <div class="cred-stat-value">${stats.decryptions_today || 0}</div>
                <div class="cred-stat-label">Decryptions Today</div>
            </div>
            <div class="cred-stat-card info">
                <div class="cred-stat-value">${stats.unique_agents || 0}</div>
                <div class="cred-stat-label">Agents Accessed</div>
            </div>
            <div class="cred-stat-card ${stats.failed_attempts > 0 ? 'danger' : ''}">
                <div class="cred-stat-value">${stats.failed_attempts || 0}</div>
                <div class="cred-stat-label">Failed Attempts</div>
            </div>
        `;
    },
    
    /**
     * Show decrypt modal
     */
    showDecryptModal(agentId) {
        this.currentAgentId = agentId;
        
        // Reset form
        const form = document.getElementById('decryptForm');
        if (form) form.reset();
        
        // Update modal title
        const title = document.querySelector('#decryptModal .modal-header h3');
        if (title) title.textContent = `Decrypt Credentials - ${agentId}`;
        
        // Hide result, show form
        document.getElementById('decryptResult')?.classList.add('hidden');
        document.getElementById('decryptForm')?.classList.remove('hidden');
        
        // Clear any previous results
        document.getElementById('credentialDisplay').innerHTML = '';
        
        // Open modal
        adminDashboard.openModal('decryptModal');
    },
    
    /**
     * Decrypt credentials
     */
    async decrypt() {
        if (!this.currentAgentId) {
            adminDashboard.showToast('error', 'Error', 'No agent selected');
            return;
        }
        
        const reason = document.getElementById('decryptReason')?.value?.trim();
        const password = document.getElementById('decryptPassword')?.value;
        const twoFaCode = document.getElementById('decrypt2fa')?.value?.trim();
        
        // Validate inputs
        if (!reason || reason.length < 10) {
            adminDashboard.showToast('warning', 'Validation', 'Please provide a detailed reason (min 10 characters)');
            return;
        }
        
        if (!password) {
            adminDashboard.showToast('warning', 'Validation', 'Please enter your admin password');
            return;
        }
        
        // Check if 2FA is required
        const twoFaRequired = adminDashboard.currentUser.two_fa_enabled;
        if (twoFaRequired && !twoFaCode) {
            adminDashboard.showToast('warning', 'Validation', 'Please enter your 2FA code');
            return;
        }
        
        // Show loading
        const submitBtn = document.querySelector('#decryptForm .btn-primary');
        const originalText = submitBtn?.innerHTML;
        if (submitBtn) submitBtn.innerHTML = '<span class="loading-spinner"></span> Decrypting...';
        
        try {
            const response = await adminDashboard.apiRequest(`/credentials/decrypt`, {
                method: 'POST',
                body: JSON.stringify({
                    agent_id: this.currentAgentId,
                    password: password,
                    two_fa_code: twoFaCode,
                    reason: reason
                })
            });
            
            if (response.success) {
                // Log the access
                await this.logAccess(this.currentAgentId, 'DECRYPT', reason, true);
                
                // Display credentials
                this.displayDecryptedCredentials(response.credentials);
                
                adminDashboard.showToast('success', 'Decryption Successful', 'Credentials have been decrypted');
            } else {
                // Log failed attempt
                await this.logAccess(this.currentAgentId, 'DECRYPT', reason, false);
                
                throw new Error(response.error || 'Decryption failed');
            }
        } catch (error) {
            console.error('Decrypt error:', error);
            adminDashboard.showToast('error', 'Decryption Failed', error.message);
        } finally {
            if (submitBtn) submitBtn.innerHTML = originalText;
        }
    },
    
    /**
     * Display decrypted credentials
     */
    displayDecryptedCredentials(credentials) {
        const container = document.getElementById('credentialDisplay');
        if (!container) return;
        
        // Hide form, show result
        document.getElementById('decryptForm')?.classList.add('hidden');
        document.getElementById('decryptResult')?.classList.remove('hidden');
        
        // Build credentials display
        let html = '<div class="credential-list">';
        
        if (typeof credentials === 'object') {
            for (const [key, value] of Object.entries(credentials)) {
                const isPassword = key.toLowerCase().includes('password') || 
                                   key.toLowerCase().includes('secret') ||
                                   key.toLowerCase().includes('token');
                
                html += `
                    <div class="credential-item">
                        <span class="credential-key">${this.formatKey(key)}</span>
                        <div class="credential-value-wrapper">
                            <input type="${isPassword ? 'password' : 'text'}" 
                                   class="credential-value" 
                                   value="${this.escapeHtml(value)}"
                                   readonly
                                   id="cred_${key}">
                            <button class="credential-action" onclick="AdminCredentials.copyCredential('cred_${key}')" title="Copy">
                                📋
                            </button>
                            ${isPassword ? `
                            <button class="credential-action" onclick="AdminCredentials.toggleVisibility('cred_${key}')" title="Toggle visibility">
                                👁️
                            </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }
        } else {
            html += `
                <div class="credential-item">
                    <span class="credential-key">Value</span>
                    <div class="credential-value-wrapper">
                        <input type="text" class="credential-value" value="${this.escapeHtml(String(credentials))}" readonly id="cred_value">
                        <button class="credential-action" onclick="AdminCredentials.copyCredential('cred_value')" title="Copy">
                            📋
                        </button>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        
        // Add warning
        html += `
            <div class="credential-warning">
                <span class="warning-icon">⚠️</span>
                <span>These credentials will be hidden when you close this modal. This access has been logged.</span>
            </div>
            
            <div class="credential-countdown">
                <span>Auto-close in <span id="credentialCountdown">60</span> seconds</span>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Start countdown
        this.startCountdown(60);
    },
    
    /**
     * Start auto-close countdown
     */
    startCountdown(seconds) {
        const countdownEl = document.getElementById('credentialCountdown');
        let remaining = seconds;
        
        this.countdownInterval = setInterval(() => {
            remaining--;
            if (countdownEl) countdownEl.textContent = remaining;
            
            if (remaining <= 0) {
                this.closeDecryptModal();
            }
        }, 1000);
    },
    
    /**
     * Close decrypt modal
     */
    closeDecryptModal() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        // Clear credential display
        const container = document.getElementById('credentialDisplay');
        if (container) container.innerHTML = '';
        
        // Clear form
        const form = document.getElementById('decryptForm');
        if (form) form.reset();
        
        // Close modal
        adminDashboard.closeModal('decryptModal');
        
        this.currentAgentId = null;
    },
    
    /**
     * Copy credential to clipboard
     */
    async copyCredential(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        try {
            await navigator.clipboard.writeText(input.value);
            adminDashboard.showToast('success', 'Copied', 'Credential copied to clipboard');
        } catch (error) {
            // Fallback
            input.select();
            document.execCommand('copy');
            adminDashboard.showToast('success', 'Copied', 'Credential copied to clipboard');
        }
    },
    
    /**
     * Toggle password visibility
     */
    toggleVisibility(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        input.type = input.type === 'password' ? 'text' : 'password';
    },
    
    /**
     * Log credential access
     */
    async logAccess(agentId, action, reason, success) {
        try {
            await adminDashboard.apiRequest('/credentials/log', {
                method: 'POST',
                body: JSON.stringify({
                    agent_id: agentId,
                    action: action,
                    reason: reason,
                    success: success
                })
            });
        } catch (error) {
            console.error('Failed to log access:', error);
        }
    },
    
    /**
     * Search credentials access logs
     */
    async searchLogs() {
        const search = document.getElementById('credentialSearch')?.value || '';
        const dateFrom = document.getElementById('credentialDateFrom')?.value || '';
        const dateTo = document.getElementById('credentialDateTo')?.value || '';
        
        try {
            const queryParams = new URLSearchParams({
                page: 1,
                limit: this.pageSize,
                search: search,
                date_from: dateFrom,
                date_to: dateTo
            });
            
            const response = await adminDashboard.apiRequest(`/credentials/logs?${queryParams}`);
            
            if (response.success) {
                this.renderLogs(response.logs);
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    },
    
    /**
     * Export access logs
     */
    async exportLogs() {
        try {
            const response = await adminDashboard.apiRequest('/credentials/logs/export');
            
            if (response.success) {
                const blob = new Blob([JSON.stringify(response.logs, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `credential_access_logs_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                
                adminDashboard.showToast('success', 'Export Complete', 'Access logs exported');
            }
        } catch (error) {
            console.error('Export error:', error);
            adminDashboard.showToast('error', 'Export Failed', error.message);
        }
    },
    
    /**
     * Utility: Format key name
     */
    formatKey(key) {
        return key
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    },
    
    /**
     * Utility: Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Global bindings
window.AdminCredentials = AdminCredentials;
window.decryptCredentials = () => AdminCredentials.decrypt();
window.closeDecryptModal = () => AdminCredentials.closeDecryptModal();
window.searchCredentialLogs = () => AdminCredentials.searchLogs();
window.exportCredentialLogs = () => AdminCredentials.exportLogs();

// Modal close on backdrop click
document.getElementById('decryptModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        AdminCredentials.closeDecryptModal();
    }
});
