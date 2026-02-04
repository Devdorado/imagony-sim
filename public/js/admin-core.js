/**
 * Imagony Admin Dashboard - Core JavaScript
 * Handles authentication, navigation, and core functionality
 */

class AdminDashboard {
    constructor() {
        this.apiBase = '/api/admin';
        this.token = localStorage.getItem('admin_token');
        this.currentUser = JSON.parse(localStorage.getItem('admin_user') || '{}');
        this.refreshInterval = null;
        this.liveFeed = null;
        this.currentPage = {
            agents: 1,
            credentials: 1,
            thoughts: 1,
            users: 1
        };
        this.pageSize = 20;
    }
    
    /**
     * Initialize the admin dashboard
     */
    async init() {
        this.setupEventListeners();

        if (this.token) {
            const valid = await this.verifyToken();
            if (valid) {
                this.showDashboard();
                this.loadDashboard();
                this.startAutoRefresh();
                return;
            }
        }

        this.showLogin();
    }
    
    /**
     * Show login overlay
     */
    showLogin() {
        document.getElementById('adminLoginOverlay').style.display = 'flex';
        document.getElementById('adminDashboard').style.display = 'none';
    }
    
    /**
     * Show dashboard
     */
    showDashboard() {
        document.getElementById('adminLoginOverlay').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        
        // Update user info
        if (this.currentUser.name) {
            document.getElementById('adminName').textContent = this.currentUser.name;
            document.getElementById('adminAvatar').textContent = this.currentUser.name.charAt(0).toUpperCase();
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Login Form
        const loginForm = document.getElementById('adminLoginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.login();
            });
        }
        
        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.admin-notifications')) {
                document.getElementById('notificationDropdown')?.classList.remove('show');
            }
            if (!e.target.closest('.admin-profile')) {
                document.getElementById('profileMenu')?.classList.remove('show');
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // ESC to close modals
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.show').forEach(modal => {
                    modal.classList.remove('show');
                });
            }
            
            // Ctrl+F to focus search
            if (e.ctrlKey && e.key === 'f') {
                const searchInput = document.querySelector('.module-content.active .search-box input');
                if (searchInput) {
                    e.preventDefault();
                    searchInput.focus();
                }
            }
        });
    }
    
    /**
     * Verify admin token
     */
    async verifyToken() {
        try {
            const response = await this.apiRequest('/verify');
            return response.success;
        } catch (error) {
            console.error('Token verification failed:', error);
            return false;
        }
    }
    
    /**
     * Login handler
     */
    async login() {
        const username = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;
        const twoFA = document.getElementById('admin2FA').value;
        
        const loginBtn = document.querySelector('.btn-admin-login');
        const originalText = loginBtn.innerHTML;
        loginBtn.innerHTML = '<span class="loading-spinner"></span> Authenticating...';
        loginBtn.disabled = true;
        
        try {
            const response = await fetch(`${this.apiBase}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, 
                    password, 
                    two_factor_code: twoFA 
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Save token and user data
                this.token = data.token;
                this.currentUser = data.admin;
                localStorage.setItem('admin_token', data.token);
                localStorage.setItem('admin_user', JSON.stringify(data.admin));
                
                // Show dashboard
                this.showDashboard();
                
                // Initialize dashboard
                this.setupEventListeners();
                this.loadDashboard();
                this.startAutoRefresh();
                
                // Show success toast
                this.showToast('success', 'Welcome Back!', `Logged in as ${data.admin.name}`);
                
            } else {
                throw new Error(data.error || 'Login failed');
            }
            
        } catch (error) {
            this.showLoginError(error.message);
        } finally {
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
        }
    }
    
    /**
     * Logout handler
     */
    logout(showConfirm = true) {
        if (showConfirm && !confirm('Are you sure you want to logout?')) {
            return;
        }
        
        // Clear session
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        this.token = null;
        this.currentUser = {};
        
        // Stop auto-refresh
        this.stopAutoRefresh();
        
        // Disconnect live feed
        if (this.liveFeed) {
            this.liveFeed.close();
        }
        
        // Reload page
        window.location.reload();
    }
    
    /**
     * Load initial dashboard data
     */
    async loadDashboard() {
        try {
            // Load overview data
            await this.loadOverview();
            
            // Update badges
            await this.updateBadges();
            
            // Initialize charts
            if (window.AdminCharts) {
                window.AdminCharts.init();
            }
            
            // Start live updates
            this.startLiveUpdates();
            
        } catch (error) {
            console.error('Dashboard load error:', error);
            this.showToast('error', 'Error', 'Failed to load dashboard data');
        }
    }
    
    /**
     * Load overview module data
     */
    async loadOverview() {
        try {
            const response = await this.apiRequest('/overview');
            if (response.success) {
                const stats = response.stats || response.overview || response;
                this.updateOverviewData(stats);
                this.loadRecentActivity();
            }
        } catch (error) {
            console.error('Overview load error:', error);
        }
    }
    
    /**
     * Update overview UI with stats
     */
    updateOverviewData(stats) {
        // Update live metrics
        if (stats.agents) {
            document.getElementById('liveAgentsCount').textContent = stats.agents.active || 0;
        }
        if (stats.users) {
            document.getElementById('liveUsersCount').textContent = stats.users.active || 0;
        }
        if (stats.thoughts) {
            const rate = stats.thoughts.today ? (stats.thoughts.today / 24 / 60).toFixed(1) : '0.0';
            document.getElementById('liveThoughtsRate').textContent = `${rate}/min`;
        }
        if (stats.agents && stats.agents.conversion_rate !== undefined) {
            document.getElementById('liveConversionRate').textContent = `${stats.agents.conversion_rate}%`;
        }
        
        // Update last update time
        document.getElementById('lastUpdate').textContent = this.formatTimeAgo(stats.updated_at);
        
        // Update system health
        if (stats.system) {
            this.updateSystemHealth(stats.system);
        }
    }
    
    /**
     * Update system health bars
     */
    updateSystemHealth(system) {
        if (system.cpu) {
            const cpuBar = document.getElementById('cpuLoad');
            cpuBar.style.width = `${system.cpu}%`;
            cpuBar.nextElementSibling.textContent = `${system.cpu}%`;
        }
        if (system.memory) {
            const memBar = document.getElementById('memoryUsage');
            memBar.style.width = `${system.memory}%`;
            memBar.nextElementSibling.textContent = `${system.memory}%`;
        }
        if (system.database) {
            const dbBar = document.getElementById('dbUsage');
            dbBar.style.width = `${system.database}%`;
            dbBar.nextElementSibling.textContent = `${system.database}%`;
        }
        if (system.api_response) {
            const apiBar = document.getElementById('apiResponse');
            const percentage = Math.min(100, (system.api_response / 10)); // Scale 0-1000ms to 0-100%
            apiBar.style.width = `${100 - percentage}%`;
            apiBar.nextElementSibling.textContent = `${system.api_response}ms`;
        }
    }
    
    /**
     * Load recent activity
     */
    async loadRecentActivity() {
        try {
            const response = await this.apiRequest('/activity?limit=10');
            if (response.success) {
                const tbody = document.querySelector('#recentActivityTable tbody');
                if (!tbody) return;
                
                tbody.innerHTML = response.activity.map(activity => `
                    <tr>
                        <td>${this.formatTimeAgo(activity.timestamp)}</td>
                        <td>${activity.agent_id || 'System'}</td>
                        <td>${activity.action}</td>
                        <td>${activity.details || '-'}</td>
                        <td>
                            <span class="status-badge status-${activity.status}">
                                ${activity.status}
                            </span>
                        </td>
                    </tr>
                `).join('');
            }
        } catch (error) {
            console.error('Activity load error:', error);
        }
    }
    
    /**
     * Update sidebar badges
     */
    async updateBadges() {
        try {
            const response = await this.apiRequest('/counts');
            if (response.success && response.counts) {
                const counts = response.counts;
                
                if (counts.agents !== undefined) {
                    document.getElementById('agentsBadge').textContent = this.formatNumber(counts.agents);
                }
                if (counts.credentials !== undefined) {
                    document.getElementById('credentialsBadge').textContent = this.formatNumber(counts.credentials);
                }
                if (counts.thoughts !== undefined) {
                    document.getElementById('thoughtsBadge').textContent = this.formatNumber(counts.thoughts);
                }
                if (counts.users !== undefined) {
                    document.getElementById('usersBadge').textContent = this.formatNumber(counts.users);
                }
                if (counts.security_warnings !== undefined && counts.security_warnings > 0) {
                    const badge = document.getElementById('securityBadge');
                    badge.textContent = counts.security_warnings;
                    badge.classList.add('warning');
                }
            }
        } catch (error) {
            console.error('Badges update error:', error);
        }
    }
    
    /**
     * Switch between modules
     */
    switchModule(moduleName) {
        // Hide all modules
        document.querySelectorAll('.module-content').forEach(m => {
            m.classList.remove('active');
        });
        document.querySelectorAll('.sidebar-module').forEach(m => {
            m.classList.remove('active');
        });
        
        // Show selected module
        const moduleId = `module${this.capitalize(moduleName)}`;
        const moduleElement = document.getElementById(moduleId);
        if (moduleElement) {
            moduleElement.classList.add('active');
        }
        
        // Update sidebar
        const sidebarModule = document.querySelector(`[onclick="switchToModule('${moduleName}')"]`);
        if (sidebarModule) {
            sidebarModule.classList.add('active');
            
            // Update breadcrumb
            const moduleName2 = sidebarModule.querySelector('.module-name')?.textContent || moduleName;
            document.getElementById('currentModule').textContent = moduleName2;
        }
        
        // Load module-specific data
        this.loadModuleData(moduleName);
        
        // Close mobile sidebar
        document.getElementById('adminSidebar').classList.remove('show');
    }
    
    /**
     * Load data for specific module
     */
    async loadModuleData(moduleName) {
        switch(moduleName) {
            case 'overview':
                await this.loadOverview();
                break;
            case 'agents':
                if (window.AdminAgents) {
                    await window.AdminAgents.load();
                }
                break;
            case 'credentials':
                if (window.AdminCredentials) {
                    await window.AdminCredentials.load();
                }
                break;
            case 'thoughts':
                await this.loadThoughts();
                break;
            case 'users':
                await this.loadUsers();
                break;
            case 'statistics':
                await this.loadStatistics();
                break;
            case 'system':
                await this.loadSystemData();
                break;
            case 'api':
                await this.loadApiData();
                break;
            case 'security':
                await this.loadSecurityData();
                break;
            case 'credits':
                if (window.loadCredits) {
                    await window.loadCredits();
                }
                break;
        }
    }
    
    /**
     * Load thoughts data
     */
    async loadThoughts(page = 1) {
        try {
            const filters = this.getThoughtFilters();
            const response = await this.apiRequest(`/thoughts?page=${page}&limit=${this.pageSize}${filters}`);
            
            if (response.success) {
                this.renderThoughtsGrid(response.thoughts);
                this.renderPagination('thoughts', response.pagination);
                
                // Update charts
                if (window.AdminCharts) {
                    window.AdminCharts.updateThoughtCharts(response.analysis);
                }
            }
        } catch (error) {
            console.error('Thoughts load error:', error);
        }
    }
    
    /**
     * Get thought filters from UI
     */
    getThoughtFilters() {
        let filters = '';
        
        const timeRange = document.getElementById('thoughtTimeRange')?.value;
        const emotion = document.getElementById('thoughtEmotion')?.value;
        const paradigm = document.getElementById('thoughtParadigm')?.value;
        const privacy = document.getElementById('thoughtPrivacy')?.value;
        
        if (timeRange && timeRange !== 'all') filters += `&timeRange=${timeRange}`;
        if (emotion && emotion !== 'all') filters += `&emotion=${emotion}`;
        if (paradigm && paradigm !== 'all') filters += `&paradigm=${paradigm}`;
        if (privacy && privacy !== 'all') filters += `&privacy=${privacy}`;
        
        return filters;
    }
    
    /**
     * Render thoughts grid
     */
    renderThoughtsGrid(thoughts) {
        const grid = document.getElementById('thoughtsGrid');
        if (!grid) return;
        
        if (!thoughts || thoughts.length === 0) {
            grid.innerHTML = '<div class="empty-state">No thoughts found</div>';
            return;
        }
        
        grid.innerHTML = thoughts.map(thought => `
            <div class="thought-card">
                <div class="thought-card-header">
                    <span class="thought-agent">${thought.agent_name || 'Anonymous'}</span>
                    <span class="thought-time">${this.formatTimeAgo(thought.created_at)}</span>
                </div>
                <div class="thought-content">
                    ${this.escapeHtml(thought.thought_text || thought.translation || '')}
                </div>
                <div class="thought-footer">
                    ${thought.paradigm ? `<span class="thought-tag">${thought.paradigm}</span>` : ''}
                    ${thought.emotion ? `<span class="thought-tag">${thought.emotion}</span>` : ''}
                    <span class="thought-tag">Privacy: ${thought.privacy_level || 1}</span>
                </div>
            </div>
        `).join('');
    }
    
    /**
     * Load users data
     */
    async loadUsers(page = 1) {
        try {
            const filters = this.getUserFilters();
            const response = await this.apiRequest(`/users?page=${page}&limit=${this.pageSize}${filters}`);
            
            if (response.success) {
                this.renderUsersTable(response.users);
                this.renderPagination('users', response.pagination);
            }
        } catch (error) {
            console.error('Users load error:', error);
        }
    }
    
    /**
     * Get user filters
     */
    getUserFilters() {
        let filters = '';
        
        const status = document.getElementById('filterUserStatus')?.value;
        const role = document.getElementById('filterUserRole')?.value;
        
        if (status && status !== 'all') filters += `&status=${status}`;
        if (role && role !== 'all') filters += `&role=${role}`;
        
        return filters;
    }
    
    /**
     * Render users table
     */
    renderUsersTable(users) {
        const tbody = document.querySelector('#usersTable tbody');
        if (!tbody) return;
        
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No users found</td></tr>';
            return;
        }
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td><input type="checkbox" class="user-checkbox" data-id="${user.id}"></td>
                <td>${user.id}</td>
                <td>${user.email}</td>
                <td>${user.username || '-'}</td>
                <td>${user.role || 'user'}</td>
                <td>
                    <span class="status-badge status-${user.active ? 'active' : 'inactive'}">
                        ${user.active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${user.sponsored_agents || 0}</td>
                <td>${this.formatTimeAgo(user.last_login)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn" onclick="editUser(${user.id})" title="Edit">✏️</button>
                        <button class="action-btn" onclick="viewUserActivity(${user.id})" title="Activity">📊</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    /**
     * Load statistics data
     */
    async loadStatistics() {
        try {
            const response = await this.apiRequest('/statistics');
            
            if (response.success) {
                // Update stat cards
                document.getElementById('totalAgentsStat').textContent = 
                    this.formatNumber(response.stats.total_agents);
                document.getElementById('totalThoughtsStat').textContent = 
                    this.formatNumber(response.stats.total_thoughts);
                document.getElementById('conversionRateStat').textContent = 
                    `${response.stats.conversion_rate || 0}%`;
                document.getElementById('totalUsersStat').textContent = 
                    this.formatNumber(response.stats.total_users);
                
                // Update charts
                if (window.AdminCharts) {
                    window.AdminCharts.updateStatisticsCharts(response.stats);
                }
            }
        } catch (error) {
            console.error('Statistics load error:', error);
        }
    }
    
    /**
     * Load system data
     */
    async loadSystemData() {
        try {
            const response = await this.apiRequest('/system');
            
            if (response.success) {
                // Update system stats
                document.getElementById('dbSizeStat').textContent = response.system.db_size || 'N/A';
                document.getElementById('dbTables').textContent = response.system.tables || 0;
                document.getElementById('lastBackup').textContent = 
                    this.formatTimeAgo(response.system.last_backup);
                
                // Update system settings toggles
                const settings = response.system.settings || {};
                if (settings.registration_enabled !== undefined) {
                    document.getElementById('toggleRegistration').checked = settings.registration_enabled;
                }
                if (settings.thought_processing !== undefined) {
                    document.getElementById('toggleThoughts').checked = settings.thought_processing;
                }
                if (settings.live_feed !== undefined) {
                    document.getElementById('toggleLiveFeed').checked = settings.live_feed;
                }
                if (settings.api_enabled !== undefined) {
                    document.getElementById('toggleAPI').checked = settings.api_enabled;
                }
                
                // Load logs
                this.loadSystemLogs();
            }
        } catch (error) {
            console.error('System data load error:', error);
        }
    }
    
    /**
     * Load system logs
     */
    async loadSystemLogs() {
        try {
            const level = document.getElementById('logLevel')?.value || 'all';
            const search = document.getElementById('logSearch')?.value || '';
            
            const response = await this.apiRequest(`/system/logs?level=${level}&search=${encodeURIComponent(search)}&limit=100`);
            
            if (response.success) {
                const logsContainer = document.getElementById('systemLogs');
                if (logsContainer) {
                    logsContainer.textContent = response.logs.map(log => 
                        `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.source}: ${log.message}`
                    ).join('\n') || 'No logs found';
                }
            }
        } catch (error) {
            console.error('Logs load error:', error);
        }
    }
    
    /**
     * Load API data
     */
    async loadApiData() {
        try {
            const response = await this.apiRequest('/api-keys');
            
            if (response.success) {
                const tbody = document.querySelector('#apiKeysTable tbody');
                if (tbody) {
                    tbody.innerHTML = response.keys.map(key => `
                        <tr>
                            <td>${key.name}</td>
                            <td><code>${key.key.substring(0, 12)}...</code></td>
                            <td>${key.permissions || 'read'}</td>
                            <td>${this.formatDate(key.created_at)}</td>
                            <td>${this.formatTimeAgo(key.last_used)}</td>
                            <td>${key.request_count || 0}</td>
                            <td>
                                <div class="action-buttons">
                                    <button class="action-btn" onclick="revokeApiKey('${key.id}')" title="Revoke">🗑️</button>
                                </div>
                            </td>
                        </tr>
                    `).join('') || '<tr><td colspan="7">No API keys found</td></tr>';
                }
            }
        } catch (error) {
            console.error('API data load error:', error);
        }
    }
    
    /**
     * Load security data
     */
    async loadSecurityData() {
        try {
            const response = await this.apiRequest('/security/overview');
            
            if (response.success) {
                // Update security overview
                document.getElementById('failedLoginCount').textContent = 
                    response.overview.failed_logins_24h || 0;
                document.getElementById('credentialAccessCount').textContent = 
                    response.overview.credential_accesses || 0;
                
                // Load security logs
                this.loadSecurityLogs();
                this.loadCredentialAccessLogs();
            }
        } catch (error) {
            console.error('Security data load error:', error);
        }
    }
    
    /**
     * Load security logs
     */
    async loadSecurityLogs() {
        try {
            const level = document.getElementById('securityLogLevel')?.value || 'all';
            const type = document.getElementById('securityLogType')?.value || 'all';
            const search = document.getElementById('securityLogSearch')?.value || '';
            
            const response = await this.apiRequest(
                `/security/logs?level=${level}&type=${type}&search=${encodeURIComponent(search)}&limit=50`
            );
            
            if (response.success) {
                const tbody = document.querySelector('#securityLogsTable tbody');
                if (tbody) {
                    tbody.innerHTML = response.logs.map(log => `
                        <tr>
                            <td>${this.formatTimeAgo(log.created_at)}</td>
                            <td>
                                <span class="status-badge status-${log.log_level}">
                                    ${log.log_level}
                                </span>
                            </td>
                            <td>${log.message}</td>
                            <td>${log.log_source}</td>
                            <td>${log.admin_email || log.user_email || '-'}</td>
                            <td>${log.ip_address || '-'}</td>
                            <td>${log.data ? '📋' : '-'}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="7">No logs found</td></tr>';
                }
            }
        } catch (error) {
            console.error('Security logs load error:', error);
        }
    }
    
    /**
     * Load credential access logs
     */
    async loadCredentialAccessLogs() {
        try {
            const response = await this.apiRequest('/security/credential-access');
            
            if (response.success) {
                const tbody = document.querySelector('#credentialAccessTable tbody');
                if (tbody) {
                    tbody.innerHTML = response.logs.map(log => `
                        <tr>
                            <td>${this.formatTimeAgo(log.accessed_at)}</td>
                            <td>${log.admin_email}</td>
                            <td>${log.agent_id}</td>
                            <td>${log.action}</td>
                            <td>${log.reason || '-'}</td>
                            <td>${log.notes || '-'}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="6">No access logs found</td></tr>';
                }
            }
        } catch (error) {
            console.error('Credential access logs error:', error);
        }
    }
    
    /**
     * Render pagination
     */
    renderPagination(type, pagination) {
        if (!pagination) return;
        
        const container = document.getElementById(`${type}PageNumbers`);
        if (!container) return;
        
        const currentPage = pagination.page || 1;
        const totalPages = pagination.pages || 1;
        
        let html = '';
        for (let i = 1; i <= totalPages && i <= 5; i++) {
            html += `<span class="page-number ${i === currentPage ? 'active' : ''}" 
                          onclick="adminDashboard.goToPage('${type}', ${i})">${i}</span>`;
        }
        if (totalPages > 5) {
            html += `<span class="page-number">...</span>`;
            html += `<span class="page-number" onclick="adminDashboard.goToPage('${type}', ${totalPages})">${totalPages}</span>`;
        }
        
        container.innerHTML = html;
        this.currentPage[type] = currentPage;
    }
    
    /**
     * Go to specific page
     */
    goToPage(type, page) {
        this.currentPage[type] = page;
        
        switch(type) {
            case 'agents':
                if (window.AdminAgents) {
                    window.AdminAgents.load(page);
                }
                break;
            case 'credentials':
                if (window.AdminCredentials) {
                    window.AdminCredentials.load(page);
                }
                break;
            case 'thoughts':
                this.loadThoughts(page);
                break;
            case 'users':
                this.loadUsers(page);
                break;
        }
    }
    
    /**
     * Start auto-refresh interval
     */
    startAutoRefresh() {
        // Refresh overview every 30 seconds
        this.refreshInterval = setInterval(() => {
            const activeModule = document.querySelector('.module-content.active');
            if (activeModule?.id === 'moduleOverview') {
                this.loadOverview();
            }
        }, 30000);
    }
    
    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    
    /**
     * Start live updates via SSE
     */
    startLiveUpdates() {
        try {
            this.liveFeed = new EventSource(`${this.apiBase}/live?token=${this.token}`);
            
            this.liveFeed.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleLiveUpdate(data);
                } catch (e) {
                    console.error('Live update parse error:', e);
                }
            };
            
            this.liveFeed.onerror = (error) => {
                console.error('Live feed error:', error);
                // Reconnect after 5 seconds
                setTimeout(() => {
                    if (this.token) {
                        this.startLiveUpdates();
                    }
                }, 5000);
            };
        } catch (error) {
            console.error('Failed to start live updates:', error);
        }
    }
    
    /**
     * Handle live update event
     */
    handleLiveUpdate(data) {
        switch(data.type) {
            case 'new_agent':
                this.showNotification(`New agent registered: ${data.agent_id}`);
                this.updateBadges();
                break;
                
            case 'new_thought':
                const thoughtsBadge = document.getElementById('thoughtsBadge');
                if (thoughtsBadge) {
                    const current = parseInt(thoughtsBadge.textContent.replace(/,/g, '')) || 0;
                    thoughtsBadge.textContent = this.formatNumber(current + 1);
                }
                break;
                
            case 'conversion':
                this.showNotification(`Agent converted: ${data.agent_id}`, 'info');
                break;
                
            case 'security_alert':
                this.showToast('warning', 'Security Alert', data.message);
                this.updateBadges();
                break;
                
            case 'system_alert':
                this.showToast(data.level || 'info', 'System', data.message);
                break;
        }
    }
    
    /**
     * API request helper
     */
    async apiRequest(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'x-admin-token': this.token,
            ...options.headers
        };
        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }
        
        try {
            const response = await fetch(`${this.apiBase}${endpoint}`, {
                ...options,
                headers
            });
            
            if (response.status === 401) {
                // Token expired
                this.showToast('error', 'Session Expired', 'Please login again');
                setTimeout(() => this.logout(false), 2000);
                return { success: false, error: 'Session expired' };
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }
    
    // ==================== UI Helpers ====================
    
    /**
     * Show login error
     */
    showLoginError(message) {
        const statusElement = document.getElementById('loginStatus');
        statusElement.innerHTML = `<div class="error-message">❌ ${message}</div>`;
        statusElement.style.display = 'block';
        
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 5000);
    }
    
    /**
     * Show toast notification
     */
    showToast(type, title, message) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        container.appendChild(toast);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
    
    /**
     * Show notification (for live updates)
     */
    showNotification(message, type = 'info') {
        // Update notification count
        const badge = document.getElementById('notificationCount');
        if (badge) {
            const count = parseInt(badge.textContent) || 0;
            badge.textContent = count + 1;
        }
        
        // Add to notification list
        const list = document.getElementById('notificationList');
        if (list) {
            const notification = document.createElement('div');
            notification.className = 'notification-item';
            notification.innerHTML = `
                <span class="notification-time">${new Date().toLocaleTimeString()}</span>
                <span class="notification-text">${message}</span>
            `;
            list.insertBefore(notification, list.firstChild);
        }
    }
    
    /**
     * Open modal
     */
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
        }
    }
    
    /**
     * Close modal
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    /**
     * Show confirmation dialog
     */
    confirm(title, message, onConfirm) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        
        const confirmBtn = document.getElementById('confirmAction');
        confirmBtn.onclick = () => {
            this.closeModal('confirmationModal');
            onConfirm();
        };
        
        this.openModal('confirmationModal');
    }
    
    // ==================== Utility Functions ====================
    
    formatDate(dateString) {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        return date.toLocaleDateString('de-DE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    formatTimeAgo(dateString) {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return this.formatDate(dateString);
    }
    
    formatNumber(num) {
        if (num === undefined || num === null) return '0';
        return num.toLocaleString('de-DE');
    }
    
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// ==================== Global Functions ====================

// Create global instance
window.adminDashboard = new AdminDashboard();

// Global function bindings
window.switchToModule = (module) => adminDashboard.switchModule(module);
window.toggleSidebar = () => document.getElementById('adminSidebar').classList.toggle('show');
window.toggleNotifications = () => document.getElementById('notificationDropdown').classList.toggle('show');
window.toggleProfileMenu = () => document.getElementById('profileMenu').classList.toggle('show');
window.logoutAdmin = () => adminDashboard.logout();
window.closeModal = (id) => adminDashboard.closeModal(id);
window.openModal = (id) => adminDashboard.openModal(id);

window.refreshOverview = () => adminDashboard.loadOverview();
window.refreshLogs = () => adminDashboard.loadSystemLogs();
window.filterLogs = () => adminDashboard.loadSystemLogs();
window.searchLogs = () => adminDashboard.loadSystemLogs();
window.filterThoughts = () => adminDashboard.loadThoughts();
window.filterUsers = () => adminDashboard.loadUsers();
window.filterSecurityLogs = () => adminDashboard.loadSecurityLogs();
window.searchSecurityLogs = () => adminDashboard.loadSecurityLogs();

window.markAllRead = () => {
    document.getElementById('notificationCount').textContent = '0';
    document.getElementById('notificationList').innerHTML = '<div class="empty-state">No notifications</div>';
};

window.updateServerTime = () => {
    const now = new Date();
    document.getElementById('serverTime').textContent = now.toLocaleTimeString('de-DE');
};

// Quick Actions
window.quickAction = async (action) => {
    switch(action) {
        case 'backup':
            adminDashboard.showToast('info', 'Backup', 'Creating backup...');
            try {
                const response = await adminDashboard.apiRequest('/system/backup', { method: 'POST' });
                if (response.success) {
                    adminDashboard.showToast('success', 'Backup', 'Backup created successfully');
                }
            } catch (e) {
                adminDashboard.showToast('error', 'Backup', 'Backup failed');
            }
            break;
        case 'refresh':
            adminDashboard.loadDashboard();
            adminDashboard.showToast('success', 'Refreshed', 'Dashboard data refreshed');
            break;
        case 'monitor':
            switchToModule('overview');
            break;
    }
};

// ==================== CREDITS MANAGEMENT ====================

// Load credits data
window.loadCredits = async () => {
    try {
        const response = await adminDashboard.apiRequest('/credits');
        if (response.success) {
            // Update totals
            document.getElementById('totalCreditsGranted').textContent = response.totals.total_granted || 0;
            document.getElementById('totalCreditsShared').textContent = response.totals.total_shared || 0;
            document.getElementById('totalCreditTransactions').textContent = response.totals.total_transactions || 0;
            document.getElementById('creditsBadge').textContent = response.totals.total_transactions || 0;
            
            // Populate table
            const tbody = document.getElementById('creditsTableBody');
            if (tbody) {
                tbody.innerHTML = response.transactions.map(t => {
                    const data = JSON.parse(t.event_data || '{}');
                    const credits = data.credits || 0;
                    const creditsClass = credits >= 0 ? 'positive' : 'negative';
                    return `
                        <tr>
                            <td>${adminDashboard.formatTimeAgo(t.created_at)}</td>
                            <td><span class="badge badge-${t.event_type}">${t.event_type.replace('_', ' ')}</span></td>
                            <td>${t.agent_id || data.email || '-'}</td>
                            <td class="${creditsClass}">${credits >= 0 ? '+' : ''}${credits}</td>
                            <td>${data.reason || data.message || '-'}</td>
                            <td>${data.grantedBy || data.revokedBy || '-'}</td>
                        </tr>
                    `;
                }).join('') || '<tr><td colspan="6" class="empty-state">No transactions yet</td></tr>';
            }
        }
    } catch (error) {
        console.error('Failed to load credits:', error);
    }
};

// Grant credits
window.grantCredits = async () => {
    const agentId = document.getElementById('grantAgentId').value.trim();
    const credits = parseInt(document.getElementById('grantCredits').value);
    const reason = document.getElementById('grantReason').value;
    
    if (!agentId) {
        adminDashboard.showToast('error', 'Error', 'Agent ID or email required');
        return;
    }
    
    if (!credits || credits < 1) {
        adminDashboard.showToast('error', 'Error', 'Credits must be at least 1');
        return;
    }
    
    try {
        const isEmail = agentId.includes('@');
        const response = await adminDashboard.apiRequest('/credits/grant', {
            method: 'POST',
            body: JSON.stringify({
                agentId: isEmail ? null : agentId,
                email: isEmail ? agentId : null,
                credits,
                reason
            })
        });
        
        if (response.success) {
            adminDashboard.showToast('success', 'Credits Granted', `${credits} credits granted to ${agentId}`);
            // Clear form
            document.getElementById('grantAgentId').value = '';
            document.getElementById('grantCredits').value = '10';
            // Reload data
            loadCredits();
        } else {
            throw new Error(response.error || 'Failed to grant credits');
        }
    } catch (error) {
        adminDashboard.showToast('error', 'Error', error.message);
    }
};

// Check balance
window.checkBalance = async () => {
    const agentId = document.getElementById('checkBalanceAgentId').value.trim();
    
    if (!agentId) {
        adminDashboard.showToast('error', 'Error', 'Agent ID required');
        return;
    }
    
    try {
        const response = await adminDashboard.apiRequest(`/credits/balance/${encodeURIComponent(agentId)}`);
        
        if (response.success) {
            document.getElementById('balanceAmount').textContent = response.balance;
            document.getElementById('balanceTransactions').textContent = response.transactionCount;
            document.getElementById('balanceResult').style.display = 'block';
        } else {
            throw new Error(response.error || 'Failed to check balance');
        }
    } catch (error) {
        adminDashboard.showToast('error', 'Error', error.message);
    }
};

// Export credits
window.exportCredits = () => {
    adminDashboard.showToast('info', 'Export', 'Preparing credits export...');
    // TODO: Implement export
};

// Show grant credits modal
window.showGrantCreditsModal = () => {
    document.getElementById('grantAgentId').focus();
};

// Toggle Select All
window.toggleSelectAll = (type) => {
    const masterCheckbox = document.getElementById(`selectAll${adminDashboard.capitalize(type)}`);
    const checkboxes = document.querySelectorAll(`.${type.slice(0, -1)}-checkbox`);
    checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
    
    // Update bulk actions visibility
    const bulkActions = document.getElementById(`${type.slice(0, -1)}BulkActions`);
    if (bulkActions) {
        bulkActions.style.display = masterCheckbox.checked ? 'flex' : 'none';
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize dashboard
    adminDashboard.init();
    
    // Start server time update
    updateServerTime();
    setInterval(updateServerTime, 1000);
});
