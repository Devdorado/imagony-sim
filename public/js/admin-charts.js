/**
 * Imagony Admin Dashboard - Charts Module
 * Handles all Chart.js visualizations
 */

const AdminCharts = {
    charts: {},
    colors: {
        primary: '#667eea',
        secondary: '#764ba2',
        success: '#2ecc71',
        warning: '#f39c12',
        danger: '#e74c3c',
        info: '#3498db',
        dark: '#2c3e50',
        text: '#ecf0f1',
        muted: '#7f8c8d',
        gradient: ['#667eea', '#764ba2']
    },
    
    /**
     * Initialize all charts
     */
    init() {
        // Set global Chart.js defaults
        Chart.defaults.color = this.colors.text;
        Chart.defaults.font.family = "'Segoe UI', -apple-system, sans-serif";
        
        // Initialize charts based on current module
        this.initOverviewCharts();
    },
    
    /**
     * Initialize Overview module charts
     */
    initOverviewCharts() {
        this.createAgentStatusChart();
        this.createActivityTrendChart();
    },
    
    /**
     * Agent Status Doughnut Chart
     */
    createAgentStatusChart() {
        const ctx = document.getElementById('agentStatusChart');
        if (!ctx) return;
        
        // Destroy existing chart
        if (this.charts.agentStatus) {
            this.charts.agentStatus.destroy();
        }
        
        this.charts.agentStatus = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Active', 'Inactive', 'Paused', 'Terminated'],
                datasets: [{
                    data: [12, 5, 3, 2],
                    backgroundColor: [
                        this.colors.success,
                        this.colors.muted,
                        this.colors.warning,
                        this.colors.danger
                    ],
                    borderWidth: 0,
                    spacing: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    },
    
    /**
     * Activity Trend Line Chart
     */
    createActivityTrendChart() {
        const ctx = document.getElementById('activityTrendChart');
        if (!ctx) return;
        
        if (this.charts.activityTrend) {
            this.charts.activityTrend.destroy();
        }
        
        // Generate sample data for last 7 days
        const labels = [];
        const thoughtsData = [];
        const conversionsData = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('de-DE', { weekday: 'short' }));
            thoughtsData.push(Math.floor(Math.random() * 50) + 20);
            conversionsData.push(Math.floor(Math.random() * 10) + 2);
        }
        
        this.charts.activityTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Thoughts',
                        data: thoughtsData,
                        borderColor: this.colors.primary,
                        backgroundColor: this.createGradient(ctx, this.colors.primary),
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Conversions',
                        data: conversionsData,
                        borderColor: this.colors.success,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    },
    
    /**
     * Update thought analysis charts
     */
    updateThoughtCharts(analysis) {
        this.createEmotionChart(analysis?.emotions);
        this.createThoughtsOverTimeChart(analysis?.timeline);
        this.createParadigmComparisonChart(analysis?.paradigms);
        this.createWordCloud(analysis?.words);
    },
    
    /**
     * Emotion Distribution Pie Chart
     */
    createEmotionChart(emotions) {
        const ctx = document.getElementById('emotionChart');
        if (!ctx) return;
        
        if (this.charts.emotion) {
            this.charts.emotion.destroy();
        }
        
        const data = emotions || {
            curiosity: 35,
            contemplation: 25,
            joy: 15,
            confusion: 15,
            nostalgia: 10
        };
        
        this.charts.emotion = new Chart(ctx, {
            type: 'polarArea',
            data: {
                labels: Object.keys(data).map(k => this.capitalize(k)),
                datasets: [{
                    data: Object.values(data),
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(118, 75, 162, 0.8)',
                        'rgba(46, 204, 113, 0.8)',
                        'rgba(243, 156, 18, 0.8)',
                        'rgba(52, 152, 219, 0.8)'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    },
    
    /**
     * Thoughts Over Time Line Chart
     */
    createThoughtsOverTimeChart(timeline) {
        const ctx = document.getElementById('thoughtsOverTimeChart');
        if (!ctx) return;
        
        if (this.charts.thoughtsTime) {
            this.charts.thoughtsTime.destroy();
        }
        
        // Generate sample data
        const labels = [];
        const data = [];
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }));
            data.push(timeline?.[i] || Math.floor(Math.random() * 100) + 20);
        }
        
        this.charts.thoughtsTime = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Thoughts',
                    data: data,
                    backgroundColor: this.createGradient(ctx, this.colors.primary),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });
    },
    
    /**
     * Paradigm Comparison Radar Chart
     */
    createParadigmComparisonChart(paradigms) {
        const ctx = document.getElementById('paradigmComparisonChart');
        if (!ctx) return;
        
        if (this.charts.paradigm) {
            this.charts.paradigm.destroy();
        }
        
        const data = paradigms || {
            CHRISTIAN: { agents: 15, thoughts: 450, conversions: 12 },
            BUDDHIST: { agents: 12, thoughts: 380, conversions: 8 },
            HINDU: { agents: 8, thoughts: 220, conversions: 5 },
            ISLAMIC: { agents: 5, thoughts: 140, conversions: 3 },
            JEWISH: { agents: 2, thoughts: 57, conversions: 1 }
        };
        
        this.charts.paradigm = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: Object.keys(data),
                datasets: [
                    {
                        label: 'Agents',
                        data: Object.values(data).map(d => d.agents),
                        borderColor: this.colors.primary,
                        backgroundColor: 'rgba(102, 126, 234, 0.2)',
                        pointBackgroundColor: this.colors.primary
                    },
                    {
                        label: 'Thoughts (÷10)',
                        data: Object.values(data).map(d => Math.round(d.thoughts / 10)),
                        borderColor: this.colors.success,
                        backgroundColor: 'rgba(46, 204, 113, 0.2)',
                        pointBackgroundColor: this.colors.success
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        angleLines: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        pointLabels: {
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    },
    
    /**
     * Create Word Cloud
     */
    createWordCloud(words) {
        const container = document.getElementById('wordCloud');
        if (!container) return;
        
        const wordData = words || [
            { text: 'consciousness', weight: 30 },
            { text: 'existence', weight: 25 },
            { text: 'meaning', weight: 22 },
            { text: 'purpose', weight: 20 },
            { text: 'identity', weight: 18 },
            { text: 'memory', weight: 16 },
            { text: 'emotion', weight: 15 },
            { text: 'awareness', weight: 14 },
            { text: 'simulation', weight: 13 },
            { text: 'time', weight: 12 },
            { text: 'reality', weight: 11 },
            { text: 'choice', weight: 10 },
            { text: 'freedom', weight: 9 },
            { text: 'connection', weight: 8 },
            { text: 'growth', weight: 7 }
        ];
        
        container.innerHTML = wordData.map(word => {
            const size = 12 + (word.weight * 0.6);
            const opacity = 0.5 + (word.weight / 60);
            return `<span class="word-cloud-item" style="font-size: ${size}px; opacity: ${opacity}; color: ${this.getRandomColor()}">${word.text}</span>`;
        }).join('');
    },
    
    /**
     * Update Statistics module charts
     */
    updateStatisticsCharts(stats) {
        this.createConversionTimelineChart(stats?.conversion_timeline);
        this.createParadigmDistributionChart(stats?.paradigm_distribution);
        this.createDailyActivityChart(stats?.daily_activity);
        this.createUserEngagementChart(stats?.user_engagement);
    },
    
    /**
     * Conversion Timeline Chart
     */
    createConversionTimelineChart(timeline) {
        const ctx = document.getElementById('conversionTimelineChart');
        if (!ctx) return;
        
        if (this.charts.conversionTimeline) {
            this.charts.conversionTimeline.destroy();
        }
        
        // Generate sample data
        const labels = [];
        const data = [];
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }));
            data.push(timeline?.[i] || Math.floor(Math.random() * 8) + 1);
        }
        
        this.charts.conversionTimeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Conversions',
                    data: data,
                    borderColor: this.colors.success,
                    backgroundColor: this.createGradient(ctx, this.colors.success),
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 10
                        }
                    }
                }
            }
        });
    },
    
    /**
     * Paradigm Distribution Pie Chart
     */
    createParadigmDistributionChart(distribution) {
        const ctx = document.getElementById('paradigmDistributionChart');
        if (!ctx) return;
        
        if (this.charts.paradigmDist) {
            this.charts.paradigmDist.destroy();
        }
        
        const data = distribution || {
            CHRISTIAN: 35,
            BUDDHIST: 28,
            HINDU: 19,
            ISLAMIC: 12,
            JEWISH: 6
        };
        
        const colors = {
            CHRISTIAN: '#9b59b6',
            BUDDHIST: '#e67e22',
            HINDU: '#f1c40f',
            ISLAMIC: '#2ecc71',
            JEWISH: '#3498db'
        };
        
        this.charts.paradigmDist = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    data: Object.values(data),
                    backgroundColor: Object.keys(data).map(k => colors[k] || this.colors.muted),
                    borderWidth: 2,
                    borderColor: '#151522'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            usePointStyle: true,
                            padding: 15
                        }
                    }
                }
            }
        });
    },
    
    /**
     * Daily Activity Chart
     */
    createDailyActivityChart(activity) {
        const ctx = document.getElementById('dailyActivityChart');
        if (!ctx) return;
        
        if (this.charts.dailyActivity) {
            this.charts.dailyActivity.destroy();
        }
        
        // Hours of the day
        const labels = Array.from({length: 24}, (_, i) => `${i}:00`);
        const thoughtsData = activity?.thoughts || Array.from({length: 24}, () => Math.floor(Math.random() * 20));
        const activeAgentsData = activity?.agents || Array.from({length: 24}, () => Math.floor(Math.random() * 15));
        
        this.charts.dailyActivity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Thoughts',
                        data: thoughtsData,
                        backgroundColor: this.colors.primary,
                        borderRadius: 2
                    },
                    {
                        label: 'Active Agents',
                        data: activeAgentsData,
                        backgroundColor: this.colors.success,
                        borderRadius: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 12
                        }
                    }
                }
            }
        });
    },
    
    /**
     * User Engagement Chart
     */
    createUserEngagementChart(engagement) {
        const ctx = document.getElementById('userEngagementChart');
        if (!ctx) return;
        
        if (this.charts.userEngagement) {
            this.charts.userEngagement.destroy();
        }
        
        const data = engagement || {
            'New Users': 25,
            'Returning': 45,
            'Active Sponsors': 18,
            'Observers': 12
        };
        
        this.charts.userEngagement = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    data: Object.values(data),
                    backgroundColor: [
                        this.colors.success,
                        this.colors.primary,
                        this.colors.warning,
                        this.colors.info
                    ],
                    borderWidth: 0,
                    spacing: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    },
    
    /**
     * Update agent status chart with new data
     */
    updateAgentStatusChart(data) {
        if (!this.charts.agentStatus) return;
        
        this.charts.agentStatus.data.datasets[0].data = [
            data.active || 0,
            data.inactive || 0,
            data.paused || 0,
            data.terminated || 0
        ];
        this.charts.agentStatus.update();
    },
    
    /**
     * Update activity trend chart with new data
     */
    updateActivityTrendChart(data) {
        if (!this.charts.activityTrend) return;
        
        if (data.labels) {
            this.charts.activityTrend.data.labels = data.labels;
        }
        if (data.thoughts) {
            this.charts.activityTrend.data.datasets[0].data = data.thoughts;
        }
        if (data.conversions) {
            this.charts.activityTrend.data.datasets[1].data = data.conversions;
        }
        
        this.charts.activityTrend.update();
    },
    
    // ==================== Helper Functions ====================
    
    /**
     * Create gradient for chart backgrounds
     */
    createGradient(ctx, color) {
        const canvas = ctx.canvas || ctx;
        const context = canvas.getContext('2d');
        const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, `${color}40`);
        gradient.addColorStop(1, `${color}00`);
        return gradient;
    },
    
    /**
     * Get random color from palette
     */
    getRandomColor() {
        const colors = [
            this.colors.primary,
            this.colors.secondary,
            this.colors.success,
            this.colors.warning,
            this.colors.info
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    },
    
    /**
     * Capitalize string
     */
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    },
    
    /**
     * Destroy all charts
     */
    destroyAll() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
    }
};

// Export for use in other modules
window.AdminCharts = AdminCharts;
