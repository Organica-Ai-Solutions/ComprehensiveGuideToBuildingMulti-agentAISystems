// Dashboard Theme Management
const DashboardTheme = {
    init() {
        this.themeToggle = document.getElementById('theme-toggle');
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
            this.loadTheme();
        }
    },

    loadTheme() {
        const theme = localStorage.getItem('theme') || 'light';
        document.body.setAttribute('data-bs-theme', theme);
        this.updateToggleButton(theme);
    },

    toggleTheme() {
        const currentTheme = document.body.getAttribute('data-bs-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-bs-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateToggleButton(newTheme);
    },

    updateToggleButton(theme) {
        if (!this.themeToggle) return;
        
        const icon = this.themeToggle.querySelector('i');
        const text = this.themeToggle.querySelector('#theme-label');
        if (theme === 'dark') {
            icon?.classList.replace('bi-moon-stars-fill', 'bi-sun-fill');
            if (text) text.textContent = 'Light';
        } else {
            icon?.classList.replace('bi-sun-fill', 'bi-moon-stars-fill');
            if (text) text.textContent = 'Dark';
        }
    }
};

// Charts Management
const ChartsManager = {
    charts: {},

    init() {
        // Only initialize if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.warn('Charts Manager: Chart.js not loaded');
            return;
        }
        
        this.initTokenChart();
        this.initRateLimitChart();
        this.updateCharts();
        this.updateSecurityMetrics();

        // Set up periodic updates
        setInterval(() => {
            this.updateCharts();
            this.updateSecurityMetrics();
        }, 30000);
    },

    initTokenChart() {
        const canvas = document.getElementById('token-history-chart');
        if (!canvas) return;

        // Destroy existing chart if it exists
        if (this.charts.tokenHistory) {
            this.charts.tokenHistory.destroy();
        }

        const ctx = canvas.getContext('2d');
        this.charts.tokenHistory = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Token Usage',
                    data: [],
                    borderColor: '#0d6efd',
                    tension: 0.4
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
                        beginAtZero: true
                    }
                }
            }
        });
    },

    initRateLimitChart() {
        const canvas = document.getElementById('rate-limit-chart');
        if (!canvas) return;

        // Destroy existing chart if it exists
        if (this.charts.rateLimit) {
            this.charts.rateLimit.destroy();
        }

        const ctx = canvas.getContext('2d');
        this.charts.rateLimit = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['API Calls', 'Rate Limit'],
                datasets: [{
                    data: [0, 100],
                    backgroundColor: ['#0d6efd', '#6c757d']
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
                        max: 100
                    }
                }
            }
        });
    },

    async updateCharts() {
        if (!window.API_CONFIG) {
            console.error('Charts Manager: API_CONFIG not found');
            return;
        }

        try {
            const response = await fetch(`${window.API_CONFIG.BASE_URL}${window.API_CONFIG.ENDPOINTS.METRICS}`);
            const metrics = await response.json();
            
            // Update token history chart
            const tokenChart = this.charts.tokenHistory;
            if (tokenChart) {
                tokenChart.data.labels.push(new Date().toLocaleTimeString());
                tokenChart.data.datasets[0].data.push(metrics.token_usage || 0);
                
                // Keep last 10 data points
                if (tokenChart.data.labels.length > 10) {
                    tokenChart.data.labels.shift();
                    tokenChart.data.datasets[0].data.shift();
                }
                
                tokenChart.update();
            }
            
            // Update rate limit chart
            const rateLimitChart = this.charts.rateLimit;
            if (rateLimitChart) {
                rateLimitChart.data.datasets[0].data = [
                    metrics.api_calls || 0,
                    metrics.rate_limit || 100
                ];
                rateLimitChart.update();
            }
            
            // Update token usage metrics
            this.updateMetricsDisplay(metrics);
            
        } catch (error) {
            console.error('Error updating charts:', error);
        }
    },

    async updateSecurityMetrics() {
        if (!window.API_CONFIG) {
            console.error('Charts Manager: API_CONFIG not found');
            return;
        }

        try {
            const response = await fetch(`${window.API_CONFIG.BASE_URL}${window.API_CONFIG.ENDPOINTS.SECURITY}/events`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            this.updateSecurityDisplay(data);
        } catch (error) {
            console.error('Error updating security metrics:', error);
        }
    },

    updateMetricsDisplay(metrics) {
        const elements = {
            totalTokens: document.getElementById('total-tokens-count'),
            sessionTokens: document.getElementById('session-tokens-count'),
            avgTokens: document.getElementById('avg-tokens-count'),
            usageBar: document.getElementById('token-usage-bar'),
            usagePercent: document.getElementById('token-usage-percent')
        };

        if (elements.totalTokens) {
            elements.totalTokens.textContent = metrics.total_tokens || 0;
        }
        if (elements.sessionTokens) {
            elements.sessionTokens.textContent = metrics.session_tokens || 0;
        }
        if (elements.avgTokens) {
            elements.avgTokens.textContent = metrics.avg_tokens || 0;
        }
        
        const usagePercent = (metrics.token_usage || 0) / (metrics.token_limit || 100) * 100;
        if (elements.usageBar) {
            elements.usageBar.style.width = `${usagePercent}%`;
        }
        if (elements.usagePercent) {
            elements.usagePercent.textContent = `${Math.round(usagePercent)}%`;
        }
    },

    updateSecurityDisplay(data) {
        const threatFeed = document.getElementById('threat-feed');
        if (threatFeed && data.threats) {
            threatFeed.innerHTML = data.threats.map(threat => `
                <div class="alert alert-${threat.severity} mb-2">
                    <small class="d-block"><strong>${threat.type}</strong></small>
                    ${threat.message}
                </div>
            `).join('');
        }

        const requestMap = document.getElementById('request-map');
        if (requestMap && data.requests) {
            requestMap.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Path</th>
                                <th>Count</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.requests.map(req => `
                                <tr>
                                    <td>${req.path}</td>
                                    <td>${req.count}</td>
                                    <td>
                                        <span class="badge bg-${req.status < 400 ? 'success' : 'danger'}">
                                            ${req.status}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    }
};

// System Metrics Management
const MetricsManager = {
    init() {
        this.updateMetrics();
        setInterval(() => this.updateMetrics(), 30000);
    },

    async updateMetrics() {
        try {
            const response = await fetch(`${window.API_CONFIG.BASE_URL}${window.API_CONFIG.ENDPOINTS.METRICS}`);
            const metrics = await response.json();
            
            // Update system metrics
            document.getElementById('activeAgents').textContent = metrics.active_agents || 0;
            document.getElementById('activeTasks').textContent = metrics.active_tasks || 0;
            document.getElementById('systemLoad').textContent = `${metrics.system_load || 0}%`;
            document.getElementById('responseTime').textContent = `${metrics.response_time || 0}ms`;
            document.getElementById('successRate').textContent = `${metrics.success_rate || 0}%`;
            document.getElementById('tasksCompleted').textContent = metrics.tasks_completed || 0;
            document.getElementById('activeSessions').textContent = metrics.active_sessions || 0;
            
        } catch (error) {
            console.error('Error updating metrics:', error);
        }
    }
};

// Initialize all components when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if required dependencies are available
    if (!window.API_CONFIG) {
        console.error('Dashboard: Required API_CONFIG not found');
        return;
    }

    // Initialize components
    DashboardTheme.init();
    ChartsManager.init();
    MetricsManager.init();
});

// Dashboard initialization
document.addEventListener('DOMContentLoaded', () => {
    DashboardManager.init();
});

// Dashboard Manager
const DashboardManager = {
    charts: {},
    
    init() {
        this.initializeCharts();
        this.initializeStats();
        this.setupRefreshInterval();
    },

    initializeCharts() {
        // Task Distribution Chart
        this.charts.taskDist = new Chart(document.getElementById('taskDistChart'), {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'In Progress', 'Failed'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#0d6efd', '#ffc107', '#dc3545']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });

        // Performance Metrics Chart
        this.charts.performance = new Chart(document.getElementById('performanceChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Response Time (ms)',
                    data: [],
                    borderColor: '#0d6efd',
                    tension: 0.4
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
                        beginAtZero: true
                    }
                }
            }
        });

        // Resource Usage Chart
        this.charts.resource = new Chart(document.getElementById('resourceChart'), {
            type: 'bar',
            data: {
                labels: ['CPU', 'Memory', 'Network'],
                datasets: [{
                    label: 'Usage %',
                    data: [0, 0, 0],
                    backgroundColor: '#0d6efd'
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
                        max: 100
                    }
                }
            }
        });

        // Rate Limits Chart
        this.charts.rateLimit = new Chart(document.getElementById('rateLimitChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'API Calls/min',
                    data: [],
                    borderColor: '#0d6efd',
                    tension: 0.4
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
                        beginAtZero: true
                    }
                }
            }
        });
    },

    async initializeStats() {
        // Set up click handlers for chart download buttons
        document.querySelectorAll('.chart-actions button').forEach(button => {
            button.addEventListener('click', (e) => {
                const chartCard = e.target.closest('.chart-card');
                const canvas = chartCard.querySelector('canvas');
                if (canvas) {
                    const link = document.createElement('a');
                    link.download = 'chart.png';
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                }
            });
        });

        await this.updateStats();
    },

    setupRefreshInterval() {
        // Update every 30 seconds
        setInterval(() => {
            this.updateStats();
        }, 30000);
    },

    async updateStats() {
        try {
            const response = await fetch(`${window.API_CONFIG.BASE_URL}/metrics`);
            const data = await response.json();

            // Update stat cards
            document.getElementById('activeAgents').textContent = data.activeAgents || 0;
            document.getElementById('tasksCompleted').textContent = data.tasksCompleted || 0;
            document.getElementById('successRate').textContent = `${data.successRate || 0}%`;
            document.getElementById('avgResponseTime').textContent = `${data.avgResponseTime || 0}ms`;

            // Update task distribution chart
            this.charts.taskDist.data.datasets[0].data = [
                data.taskStats?.completed || 0,
                data.taskStats?.inProgress || 0,
                data.taskStats?.failed || 0
            ];
            this.charts.taskDist.update();

            // Update performance chart
            const time = new Date().toLocaleTimeString();
            this.charts.performance.data.labels.push(time);
            this.charts.performance.data.datasets[0].data.push(data.avgResponseTime || 0);
            if (this.charts.performance.data.labels.length > 10) {
                this.charts.performance.data.labels.shift();
                this.charts.performance.data.datasets[0].data.shift();
            }
            this.charts.performance.update();

            // Update resource usage chart
            this.charts.resource.data.datasets[0].data = [
                data.resourceUsage?.cpu || 0,
                data.resourceUsage?.memory || 0,
                data.resourceUsage?.network || 0
            ];
            this.charts.resource.update();

            // Update rate limits chart
            this.charts.rateLimit.data.labels.push(time);
            this.charts.rateLimit.data.datasets[0].data.push(data.apiCalls || 0);
            if (this.charts.rateLimit.data.labels.length > 10) {
                this.charts.rateLimit.data.labels.shift();
                this.charts.rateLimit.data.datasets[0].data.shift();
            }
            this.charts.rateLimit.update();

            // Update recent tasks table
            this.updateRecentTasks(data.recentTasks || []);

        } catch (error) {
            console.error('Error updating dashboard:', error);
        }
    },

    updateRecentTasks(tasks) {
        const tbody = document.getElementById('recentTasks');
        if (!tbody) return;

        tbody.innerHTML = tasks.map(task => `
            <tr>
                <td>${task.id}</td>
                <td>${task.type}</td>
                <td>${task.agent}</td>
                <td><span class="badge badge-${this.getStatusClass(task.status)}">${task.status}</span></td>
                <td>${task.duration}ms</td>
                <td>${new Date(task.completed).toLocaleString()}</td>
            </tr>
        `).join('');
    },

    getStatusClass(status) {
        switch (status?.toLowerCase()) {
            case 'completed':
                return 'success';
            case 'in progress':
                return 'warning';
            case 'failed':
                return 'danger';
            default:
                return 'secondary';
        }
    }
}; 