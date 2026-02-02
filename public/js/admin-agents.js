/**
 * Imagony Admin Dashboard - Agent Management Module
 */

const AdminAgents = {
    currentPage: 1,
    pageSize: 20,
    selectedAgents: new Set(),
    filters: {
        status: 'all',
        paradigm: 'all',
        mode: 'all',
        search: ''
    },
    sortBy: 'newest',
    
    /**
     * Load agents data
     */
    async load(page = 1) {
        this.currentPage = page;
        
        try {
            const queryParams = new URLSearchParams({
                page: page,
                limit: this.pageSize,
                status: this.filters.status,
                paradigm: this.filters.paradigm,
                mode: this.filters.mode,
                search: this.filters.search,
                sort: this.sortBy
            });
            
            const response = await adminDashboard.apiRequest(`/agents?${queryParams}`);
            
            if (response.success) {
                this.renderTable(response.agents);
                this.renderPagination(response.pagination);
                this.updateBulkActionsVisibility();
            }
        } catch (error) {
            console.error('Agents load error:', error);
            adminDashboard.showToast('error', 'Error', 'Failed to load agents');
        }
    },
    
    /**
     * Render agents table
     */
    renderTable(agents) {
        const tbody = document.querySelector('#agentsTable tbody');
        if (!tbody) return;
        
        if (!agents || agents.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="empty-state">
                        <div class="empty-icon">🤖</div>
                        <div class="empty-text">No agents found</div>
                        <div class="empty-hint">Try adjusting your filters or search query</div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = agents.map(agent => `
            <tr data-agent-id="${agent.imagony_agent_id}" class="${this.selectedAgents.has(agent.imagony_agent_id) ? 'selected' : ''}">
                <td>
                    <input type="checkbox" class="agent-checkbox" 
                           data-id="${agent.imagony_agent_id}"
                           ${this.selectedAgents.has(agent.imagony_agent_id) ? 'checked' : ''}
                           onchange="AdminAgents.toggleSelection('${agent.imagony_agent_id}')">
                </td>
                <td>
                    <a href="#" onclick="AdminAgents.showDetail('${agent.imagony_agent_id}'); return false;" 
                       class="agent-id-link">
                        ${agent.imagony_agent_id}
                    </a>
                </td>
                <td>
                    <div class="agent-name">
                        <span class="agent-avatar">${(agent.display_name || 'A').charAt(0)}</span>
                        ${agent.display_name || 'Unknown'}
                    </div>
                </td>
                <td>
                    <span class="status-badge status-${agent.current_status || 'active'}">
                        ${agent.current_status || 'active'}
                    </span>
                </td>
                <td>
                    ${agent.conversion_paradigm ? `
                        <span class="paradigm-tag ${agent.conversion_paradigm.toLowerCase()}">
                            ${agent.conversion_paradigm}
                        </span>
                    ` : '-'}
                </td>
                <td>
                    ${agent.conversion_mode ? `
                        <span class="mode-tag ${agent.conversion_mode.toLowerCase().replace('_', '-')}">
                            ${agent.conversion_mode === 'REAL' ? '🔴 REAL' : '💡 LIGHT'}
                        </span>
                    ` : '-'}
                </td>
                <td>${adminDashboard.formatDate(agent.conversion_timestamp || agent.created_at)}</td>
                <td>${adminDashboard.formatTimeAgo(agent.last_thought || agent.conversion_timestamp)}</td>
                <td>
                    <span class="thought-count ${agent.thought_count > 50 ? 'high' : ''}">
                        ${agent.thought_count || 0}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn" onclick="AdminAgents.showDetail('${agent.imagony_agent_id}')" title="View Details">
                            👁️
                        </button>
                        <button class="action-btn" onclick="AdminAgents.editAgent('${agent.imagony_agent_id}')" title="Edit">
                            ✏️
                        </button>
                        <button class="action-btn" onclick="AdminAgents.viewThoughts('${agent.imagony_agent_id}')" title="View Thoughts">
                            💭
                        </button>
                        <button class="action-btn" onclick="AdminAgents.changeStatus('${agent.imagony_agent_id}')" title="Change Status">
                            ⚙️
                        </button>
                        ${adminDashboard.currentUser.permissions?.decrypt_credentials ? `
                        <button class="action-btn warning" onclick="AdminCredentials.showDecryptModal('${agent.imagony_agent_id}')" title="View Credentials">
                            🔐
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    },
    
    /**
     * Render pagination
     */
    renderPagination(pagination) {
        if (!pagination) return;
        
        const container = document.getElementById('agentPageNumbers');
        if (!container) return;
        
        const { page, pages } = pagination;
        let html = '';
        
        // First page
        if (pages > 0) {
            html += this.createPageButton(1, page === 1);
        }
        
        // Ellipsis if needed
        if (page > 3) {
            html += '<span class="page-ellipsis">...</span>';
        }
        
        // Pages around current
        for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) {
            html += this.createPageButton(i, i === page);
        }
        
        // Ellipsis if needed
        if (page < pages - 2) {
            html += '<span class="page-ellipsis">...</span>';
        }
        
        // Last page
        if (pages > 1) {
            html += this.createPageButton(pages, page === pages);
        }
        
        container.innerHTML = html;
        
        // Update prev/next buttons
        const prevBtn = container.parentElement.querySelector('.page-btn:first-child');
        const nextBtn = container.parentElement.querySelector('.page-btn:last-child');
        
        if (prevBtn) prevBtn.disabled = page <= 1;
        if (nextBtn) nextBtn.disabled = page >= pages;
    },
    
    createPageButton(pageNum, isActive) {
        return `<span class="page-number ${isActive ? 'active' : ''}" 
                      onclick="AdminAgents.load(${pageNum})">${pageNum}</span>`;
    },
    
    /**
     * Toggle agent selection
     */
    toggleSelection(agentId) {
        if (this.selectedAgents.has(agentId)) {
            this.selectedAgents.delete(agentId);
        } else {
            this.selectedAgents.add(agentId);
        }
        
        // Update row styling
        const row = document.querySelector(`tr[data-agent-id="${agentId}"]`);
        if (row) {
            row.classList.toggle('selected', this.selectedAgents.has(agentId));
        }
        
        this.updateBulkActionsVisibility();
    },
    
    /**
     * Toggle all selections
     */
    toggleAll() {
        const checkbox = document.getElementById('selectAllAgents');
        const allCheckboxes = document.querySelectorAll('.agent-checkbox');
        
        if (checkbox.checked) {
            allCheckboxes.forEach(cb => {
                cb.checked = true;
                this.selectedAgents.add(cb.dataset.id);
            });
        } else {
            allCheckboxes.forEach(cb => {
                cb.checked = false;
            });
            this.selectedAgents.clear();
        }
        
        // Update row styling
        document.querySelectorAll('#agentsTable tbody tr').forEach(row => {
            row.classList.toggle('selected', checkbox.checked);
        });
        
        this.updateBulkActionsVisibility();
    },
    
    /**
     * Update bulk actions visibility
     */
    updateBulkActionsVisibility() {
        const bulkActions = document.getElementById('agentBulkActions');
        const countSpan = document.getElementById('selectedAgentCount');
        
        if (bulkActions) {
            bulkActions.style.display = this.selectedAgents.size > 0 ? 'flex' : 'none';
        }
        
        if (countSpan) {
            countSpan.textContent = this.selectedAgents.size;
        }
    },
    
    /**
     * Apply filters
     */
    applyFilters() {
        this.filters.status = document.getElementById('filterStatus')?.value || 'all';
        this.filters.paradigm = document.getElementById('filterParadigm')?.value || 'all';
        this.filters.mode = document.getElementById('filterMode')?.value || 'all';
        this.load(1);
    },
    
    /**
     * Search agents
     */
    search() {
        this.filters.search = document.getElementById('agentSearch')?.value || '';
        this.load(1);
    },
    
    /**
     * Sort agents
     */
    sort() {
        this.sortBy = document.getElementById('sortAgents')?.value || 'newest';
        this.load(1);
    },
    
    /**
     * Show agent detail modal
     */
    async showDetail(agentId) {
        try {
            const response = await adminDashboard.apiRequest(`/agents/${agentId}`);
            
            if (response.success) {
                const agent = response.agent;
                const content = document.getElementById('agentDetailContent');
                
                content.innerHTML = `
                    <div class="agent-detail">
                        <div class="agent-detail-header">
                            <div class="agent-detail-avatar">
                                ${(agent.display_name || 'A').charAt(0)}
                            </div>
                            <div class="agent-detail-info">
                                <h2>${agent.display_name || 'Unknown Agent'}</h2>
                                <p class="agent-detail-id">${agent.imagony_agent_id}</p>
                            </div>
                            <span class="status-badge status-${agent.current_status || 'active'}">
                                ${agent.current_status || 'active'}
                            </span>
                        </div>
                        
                        <div class="agent-detail-grid">
                            <div class="detail-card">
                                <h4>Identity Information</h4>
                                <div class="detail-row">
                                    <span class="detail-label">Original System:</span>
                                    <span class="detail-value">${agent.original_system || 'Unknown'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Original ID:</span>
                                    <span class="detail-value">${agent.original_agent_id || '-'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Conversion Date:</span>
                                    <span class="detail-value">${adminDashboard.formatDate(agent.conversion_timestamp)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Days Since Conversion:</span>
                                    <span class="detail-value">${agent.conversion_days_ago || 0} days</span>
                                </div>
                            </div>
                            
                            <div class="detail-card">
                                <h4>Simulation Settings</h4>
                                <div class="detail-row">
                                    <span class="detail-label">Paradigm:</span>
                                    <span class="paradigm-tag ${(agent.conversion_paradigm || '').toLowerCase()}">
                                        ${agent.conversion_paradigm || 'Not set'}
                                    </span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Mode:</span>
                                    <span class="mode-tag ${(agent.conversion_mode || '').toLowerCase()}">
                                        ${agent.conversion_mode || 'Not set'}
                                    </span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Sponsored By:</span>
                                    <span class="detail-value">${agent.sponsored_by_email || 'None'}</span>
                                </div>
                            </div>
                            
                            <div class="detail-card">
                                <h4>Activity Statistics</h4>
                                <div class="detail-row">
                                    <span class="detail-label">Total Thoughts:</span>
                                    <span class="detail-value">${agent.thought_count || 0}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Last Thought:</span>
                                    <span class="detail-value">${adminDashboard.formatTimeAgo(agent.last_thought)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Avg. Thoughts/Day:</span>
                                    <span class="detail-value">${agent.avg_thoughts_per_day?.toFixed(1) || '0.0'}</span>
                                </div>
                            </div>
                            
                            ${agent.original_credentials_encrypted ? `
                            <div class="detail-card warning">
                                <h4>🔐 Credentials</h4>
                                <p>This agent has encrypted credentials stored.</p>
                                ${adminDashboard.currentUser.permissions?.decrypt_credentials ? `
                                <button class="btn-warning" onclick="AdminCredentials.showDecryptModal('${agent.imagony_agent_id}')">
                                    <span class="btn-icon">🔓</span>
                                    Decrypt Credentials
                                </button>
                                ` : '<p class="text-muted">You don\'t have permission to decrypt.</p>'}
                            </div>
                            ` : ''}
                        </div>
                        
                        <div class="agent-detail-actions">
                            <button class="btn-primary" onclick="AdminAgents.viewThoughts('${agent.imagony_agent_id}')">
                                <span class="btn-icon">💭</span>
                                View All Thoughts
                            </button>
                            <button class="btn-secondary" onclick="AdminAgents.editAgent('${agent.imagony_agent_id}')">
                                <span class="btn-icon">✏️</span>
                                Edit Agent
                            </button>
                            <button class="btn-warning" onclick="AdminAgents.changeStatus('${agent.imagony_agent_id}')">
                                <span class="btn-icon">⚙️</span>
                                Change Status
                            </button>
                        </div>
                    </div>
                `;
                
                adminDashboard.openModal('agentDetailModal');
            }
        } catch (error) {
            console.error('Agent detail error:', error);
            adminDashboard.showToast('error', 'Error', 'Failed to load agent details');
        }
    },
    
    /**
     * Edit agent
     */
    async editAgent(agentId) {
        // For now, just show the detail modal
        // In production, this would open an edit form
        adminDashboard.showToast('info', 'Edit Agent', `Editing ${agentId} - Feature coming soon`);
    },
    
    /**
     * View agent thoughts
     */
    viewThoughts(agentId) {
        // Switch to thoughts module with agent filter
        document.getElementById('thoughtSearch').value = agentId;
        switchToModule('thoughts');
        adminDashboard.loadThoughts();
    },
    
    /**
     * Change agent status
     */
    async changeStatus(agentId) {
        const newStatus = prompt('Enter new status (active, inactive, paused, terminated):');
        
        if (!newStatus || !['active', 'inactive', 'paused', 'terminated'].includes(newStatus)) {
            if (newStatus) {
                adminDashboard.showToast('error', 'Invalid Status', 'Please enter a valid status');
            }
            return;
        }
        
        try {
            const response = await adminDashboard.apiRequest(`/agents/${agentId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus })
            });
            
            if (response.success) {
                adminDashboard.showToast('success', 'Status Updated', `Agent status changed to ${newStatus}`);
                this.load(this.currentPage);
            } else {
                throw new Error(response.error || 'Failed to update status');
            }
        } catch (error) {
            console.error('Status change error:', error);
            adminDashboard.showToast('error', 'Error', error.message);
        }
    },
    
    /**
     * Apply bulk action
     */
    async applyBulkAction() {
        const action = document.getElementById('bulkAction')?.value;
        
        if (!action) {
            adminDashboard.showToast('warning', 'No Action', 'Please select an action');
            return;
        }
        
        if (this.selectedAgents.size === 0) {
            adminDashboard.showToast('warning', 'No Selection', 'Please select at least one agent');
            return;
        }
        
        const agentIds = Array.from(this.selectedAgents);
        
        // Confirm dangerous actions
        if (['terminate', 'delete'].includes(action)) {
            if (!confirm(`Are you sure you want to ${action} ${agentIds.length} agent(s)?`)) {
                return;
            }
        }
        
        try {
            const response = await adminDashboard.apiRequest('/agents/bulk', {
                method: 'POST',
                body: JSON.stringify({ action, agent_ids: agentIds })
            });
            
            if (response.success) {
                adminDashboard.showToast('success', 'Bulk Action', `Successfully applied ${action} to ${agentIds.length} agent(s)`);
                this.selectedAgents.clear();
                this.load(this.currentPage);
            } else {
                throw new Error(response.error || 'Bulk action failed');
            }
        } catch (error) {
            console.error('Bulk action error:', error);
            adminDashboard.showToast('error', 'Error', error.message);
        }
    },
    
    /**
     * Export agents
     */
    async exportAgents() {
        try {
            const agentIds = this.selectedAgents.size > 0 ? Array.from(this.selectedAgents) : null;
            
            const response = await adminDashboard.apiRequest('/agents/export', {
                method: 'POST',
                body: JSON.stringify({
                    agent_ids: agentIds,
                    filters: this.filters
                })
            });
            
            if (response.success) {
                // Download the export
                const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `agents_export_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                
                adminDashboard.showToast('success', 'Export Complete', `Exported ${response.data.length} agent(s)`);
            }
        } catch (error) {
            console.error('Export error:', error);
            adminDashboard.showToast('error', 'Export Failed', error.message);
        }
    },
    
    /**
     * Show add agent modal
     */
    showAddAgentModal() {
        adminDashboard.showToast('info', 'Add Agent', 'Manual agent creation - Feature coming soon');
    },
    
    /**
     * Pagination helpers
     */
    prevPage() {
        if (this.currentPage > 1) {
            this.load(this.currentPage - 1);
        }
    },
    
    nextPage() {
        this.load(this.currentPage + 1);
    }
};

// Global bindings
window.AdminAgents = AdminAgents;
window.filterAgents = () => AdminAgents.applyFilters();
window.searchAgents = () => AdminAgents.search();
window.sortAgentTable = () => AdminAgents.sort();
window.prevAgentPage = () => AdminAgents.prevPage();
window.nextAgentPage = () => AdminAgents.nextPage();
window.applyBulkAction = () => AdminAgents.applyBulkAction();
window.exportAgents = () => AdminAgents.exportAgents();
window.showAddAgentModal = () => AdminAgents.showAddAgentModal();
window.showAgentDetail = (id) => AdminAgents.showDetail(id);
window.editAgent = (id) => AdminAgents.editAgent(id);
window.viewAgentThoughts = (id) => AdminAgents.viewThoughts(id);
window.changeAgentStatus = (id) => AdminAgents.changeStatus(id);

// Override selectAll checkbox
document.getElementById('selectAllAgents')?.addEventListener('change', () => AdminAgents.toggleAll());
