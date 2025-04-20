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
        const theme = localStorage.getItem(window.THEME_CONFIG.STORAGE_KEY) || window.THEME_CONFIG.DEFAULT;
        document.body.setAttribute('data-bs-theme', theme);
        this.updateToggleButton(theme);
    },

    toggleTheme() {
        const currentTheme = document.body.getAttribute('data-bs-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-bs-theme', newTheme);
        localStorage.setItem(window.THEME_CONFIG.STORAGE_KEY, newTheme);
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
    // Default update interval, can be overridden by config
    updateInterval: window.UI_CONFIG?.UPDATE_INTERVAL || 30000, 

    init() {
        if (typeof Chart === 'undefined') {
            console.error('Chart.js is not loaded');
            return;
        }
        this.initializeCharts();
        // Initialize all charts here
        this.initTaskDistChart();
        this.initPerformanceChart();
        this.initResourceChart();
        // Rate limit chart is initialized in initializeCharts()
    },

    initializeCharts() {
        try {
            // Initialize rate limit chart
            const rateLimitCtx = document.getElementById('rate-limit-chart');
            if (rateLimitCtx) {
                // Destroy existing chart if it exists
                if (this.charts.rateLimit) {
                    this.charts.rateLimit.destroy();
                }

                this.charts.rateLimit = new Chart(rateLimitCtx, {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [{
                            label: 'Requests/min',
                            data: [],
                            borderColor: 'rgb(75, 192, 192)',
                            tension: 0.1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error initializing charts:', error);
        }
    },

    updateRateLimitChart(data) {
        try {
            if (!this.charts.rateLimit) {
                console.error('Rate limit chart not initialized');
                return;
            }

            const chart = this.charts.rateLimit;
            chart.data.labels = data.timestamps || [];
            chart.data.datasets[0].data = data.values || [];
            chart.update();
        } catch (error) {
            console.error('Error updating rate limit chart:', error);
        }
    },

    initTaskDistChart() {
        const canvas = document.getElementById('taskDistChart');
        if (!canvas) return;

        this.charts.taskDist = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'In Progress', 'Failed'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: [
                        window.CHART_CONFIG.COLORS.PRIMARY,
                        window.CHART_CONFIG.COLORS.WARNING,
                        window.CHART_CONFIG.COLORS.DANGER
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                ...window.CHART_CONFIG.DEFAULT_OPTIONS,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    },

    initPerformanceChart() {
        const canvas = document.getElementById('performanceChart');
        if (!canvas) return;

        this.charts.performance = new Chart(canvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Response Time (ms)',
                    data: [],
                    borderColor: window.CHART_CONFIG.COLORS.PRIMARY,
                    backgroundColor: `rgba(${this.hexToRgb(window.CHART_CONFIG.COLORS.PRIMARY)}, 0.1)`,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                }]
            },
            options: {
                ...window.CHART_CONFIG.DEFAULT_OPTIONS,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            display: true,
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    },

    initResourceChart() {
        const canvas = document.getElementById('resourceChart');
        if (!canvas) return;

        this.charts.resource = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['CPU', 'Memory', 'Network'],
                datasets: [{
                    label: 'Usage %',
                    data: [0, 0, 0],
                    backgroundColor: [
                        window.CHART_CONFIG.COLORS.PRIMARY,
                        window.CHART_CONFIG.COLORS.SUCCESS,
                        window.CHART_CONFIG.COLORS.INFO
                    ],
                    borderRadius: 5
                }]
            },
            options: {
                ...window.CHART_CONFIG.DEFAULT_OPTIONS,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            display: true,
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    },

    // Helper function to convert hex color to RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? 
            `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
            '0, 0, 0';
    },

    // New function to update all charts from consolidated data
    updateAllCharts(chartData) {
        if (!chartData) {
            console.warn("ChartsManager: No chart data received.");
            return;
        }
        try {
            // Update specific metrics like rate limit
            if (chartData.rate_limits) {
                this.updateRateLimitChart(chartData.rate_limits);
            }
            // Update general chart data (task dist, performance, resource)
            this.updateChartData(chartData); 
        } catch (error) {
            console.error('Error updating charts from consolidated data:', error);
        }
    },

    // General chart data update (previously part of updateCharts)
    updateChartData(data) {
        if (!data) return;

        // Update task distribution chart
        if (this.charts.taskDist && data.taskStats) {
            const taskData = [
                data.taskStats.completed || 0,
                data.taskStats.inProgress || 0,
                data.taskStats.failed || 0
            ];
            this.charts.taskDist.data.datasets[0].data = taskData;
            this.charts.taskDist.update();
        }

        // Update performance chart
        if (this.charts.performance && data.responseTime) {
            const time = new Date().toLocaleTimeString();
            const performanceData = this.charts.performance.data;
            
            // Check if responseTime is a valid number
            const responseTimeValue = parseFloat(data.responseTime);
            if (!isNaN(responseTimeValue)) {
                performanceData.labels.push(time);
                performanceData.datasets[0].data.push(responseTimeValue);

                // Keep only last N data points (e.g., 10)
                const maxDataPoints = window.UI_CONFIG?.CHART_MAX_POINTS || 10;
                if (performanceData.labels.length > maxDataPoints) {
                    performanceData.labels.shift();
                    performanceData.datasets[0].data.shift();
                }
                this.charts.performance.update();
            } else {
                 console.warn("Invalid responseTime value received:", data.responseTime);
            }
        }

        // Update resource usage chart
        if (this.charts.resource && data.resourceUsage) {
            const resourceData = [
                data.resourceUsage.cpu || 0,
                data.resourceUsage.memory || 0,
                data.resourceUsage.network || 0 // Assuming network is provided
            ];
            this.charts.resource.data.datasets[0].data = resourceData;
            this.charts.resource.update();
        }
    },

    // Starts the periodic fetching using the global fetch function
    startUpdates() {
        console.log(`Starting periodic dashboard updates every ${this.updateInterval / 1000}s`);
        // Clear existing interval if any (safety measure)
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        // Set up periodic updates using the central fetch function
        this.intervalId = setInterval(fetchAndUpdateDashboardData, this.updateInterval);
    }
};

// Renamed MetricsManager to OverviewManager for clarity
const OverviewManager = {
    elements: {}, // Cache DOM elements

    init() {
        // Cache elements on initialization
        this.elements = {
            activeAgents: document.getElementById('activeAgents'),
            tasksCompleted: document.getElementById('tasksCompleted'),
            successRate: document.getElementById('successRate'),
            avgResponseTime: document.getElementById('avgResponseTime'),
            // Add other potential overview elements if needed
            totalEvents: document.getElementById('totalEvents'), 
            blockedAttempts: document.getElementById('blockedAttempts'),
            activeSessions: document.getElementById('activeSessions') 
        };
        // No longer starts its own interval here
        console.log("OverviewManager initialized.");
    },

    // New function to update DOM elements from consolidated data
    updateDOM(overviewData) {
        if (!overviewData) {
             console.warn("OverviewManager: No overview data received.");
            return;
        }
        try {
            // Update elements if they exist and data is provided
            if (this.elements.activeAgents && overviewData.active_agents !== undefined) {
                this.elements.activeAgents.textContent = overviewData.active_agents;
            }
            if (this.elements.tasksCompleted && overviewData.tasks_completed !== undefined) {
                this.elements.tasksCompleted.textContent = overviewData.tasks_completed;
            }
             if (this.elements.successRate && overviewData.success_rate !== undefined) {
                // Ensure formatting consistency (e.g., always show %)
                this.elements.successRate.textContent = `${parseFloat(overviewData.success_rate).toFixed(1)}%`;
            }
            if (this.elements.avgResponseTime && overviewData.response_time !== undefined) {
                 // Ensure formatting consistency (e.g., always show ms)
                this.elements.avgResponseTime.textContent = `${parseInt(overviewData.response_time)}ms`;
            }
             // Update security-related overview elements if present
             if (this.elements.totalEvents && overviewData.total_events !== undefined) {
                this.elements.totalEvents.textContent = overviewData.total_events;
            }
            if (this.elements.blockedAttempts && overviewData.blocked_attempts !== undefined) {
                this.elements.blockedAttempts.textContent = overviewData.blocked_attempts;
            }
             if (this.elements.activeSessions && overviewData.active_sessions !== undefined) {
                this.elements.activeSessions.textContent = overviewData.active_sessions;
            }

        } catch (error) {
            console.error("Error updating overview DOM:", error);
        }
    }
    // Removed async updateMetrics()
};

// Connection Manager (Modified retryConnection)
const ConnectionManager = {
    status: 'connecting',
    checkInterval: window.UI_CONFIG?.CONNECTION_CHECK_INTERVAL || 10000, 
    maxRetries: 3,
    currentRetry: 0,
    intervalId: null, // Store interval ID

    init() {
        this.updateStatus('connecting');
        this.checkConnection(); // Initial check
        
        const retryBtn = document.getElementById('retry-connection');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.retryConnection());
        }

        // Start periodic connection checks
        if (this.intervalId) clearInterval(this.intervalId); // Clear previous if any
        this.intervalId = setInterval(() => this.checkConnection(), this.checkInterval);
         console.log(`Starting periodic connection checks every ${this.checkInterval / 1000}s`);
    },

    async checkConnection() {
        // Check if API_CONFIG is ready
        if (!window.API_CONFIG || !window.API_CONFIG.BASE_URL || !window.API_CONFIG.ENDPOINTS?.HEALTH) {
             console.warn("Connection check skipped: API_CONFIG not fully loaded.");
             // Optionally update status to 'error' or 'waiting'
             // this.updateStatus('disconnected'); // Or a new 'pending_config' state
             return false; 
        }

        try {
            // Use a shorter timeout for health checks
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

            const response = await fetch(`${window.API_CONFIG.BASE_URL}${window.API_CONFIG.ENDPOINTS.HEALTH}`, {
                headers: window.API_CONFIG.HEADERS,
                signal: controller.signal // Add abort signal
            });
            clearTimeout(timeoutId); // Clear timeout if fetch completes

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'ok' || data.status === 'healthy') {
                    if (this.status !== 'connected') { // Only update if status changes
                        this.updateStatus('connected');
                         // Trigger initial data fetch on successful connection
                         console.log("Connection successful, performing initial data fetch.");
                         fetchAndUpdateDashboardData(); 
                    }
                    this.currentRetry = 0;
                    return true;
                }
            }
             // If response not ok or status not healthy
             if (this.status !== 'disconnected') { // Only update if status changes
                 this.updateStatus('disconnected');
             }
             console.warn(`Health check failed: Status ${response.status}`);
            return false;
        } catch (error) {
             if (error.name === 'AbortError') {
                 console.warn('Connection check timed out.');
             } else {
                 console.error('Connection check failed:', error);
             }
             if (this.status !== 'disconnected') { // Only update if status changes
                this.updateStatus('disconnected');
            }
            return false;
        }
    },

    async retryConnection() {
        if (this.status === 'connecting') return; // Avoid multiple retries at once

        if (this.currentRetry >= this.maxRetries) {
            window.showToast('Maximum retry attempts reached. Please check backend status.', 'error');
            this.updateStatus('disconnected'); // Ensure status reflects failure
            return;
        }

        this.currentRetry++;
        window.showToast(`Attempting to reconnect... (${this.currentRetry}/${this.maxRetries})`, 'info');
        this.updateStatus('connecting');
        
        const connected = await this.checkConnection();
        // Status is updated within checkConnection now
        if (connected) {
            window.showToast('Connection restored!', 'success');
            // Initial data fetch is now handled by checkConnection on success
        } else if (this.currentRetry >= this.maxRetries) {
             window.showToast(`Failed to reconnect after ${this.maxRetries} attempts.`, 'error');
             // Status will be 'disconnected' from checkConnection
        }
        // No need for explicit 'failed' toast here, checkConnection handles status
    },

    updateStatus(status) {
        if (this.status === status) return; // Avoid redundant updates
        this.status = status;
        console.log("Connection status updated:", status);

        const iconEl = document.getElementById('connection-icon');
        const textEl = document.getElementById('connection-text');
        const retryBtn = document.getElementById('retry-connection');
        const statusPill = document.getElementById('connection-status-pill'); // Target the pill for class changes
        
        if (!iconEl || !textEl || !statusPill) {
             console.error("Connection status elements not found in DOM.");
             return;
        }

        // Remove previous status classes from pill
         statusPill.classList.remove('status-connecting', 'status-connected', 'status-disconnected');

        const statusConfig = {
            connecting: {
                iconClass: 'bi-arrow-repeat', // Rotating icon?
                text: 'Connecting...',
                pillClass: 'status-connecting',
                showRetry: false
            },
            connected: {
                iconClass: 'bi-check-circle-fill',
                text: 'Connected',
                pillClass: 'status-connected',
                showRetry: false
            },
            disconnected: {
                 iconClass: 'bi-exclamation-triangle-fill',
                 text: 'Disconnected',
                 pillClass: 'status-disconnected',
                showRetry: this.currentRetry < this.maxRetries // Show retry only if attempts remain
            }
        };

        const config = statusConfig[status];
        if (config) {
            iconEl.className = `bi ${config.iconClass}`; // Set icon class directly
            textEl.textContent = config.text;
            statusPill.classList.add(config.pillClass); // Add current status class
            if (retryBtn) {
                retryBtn.style.display = config.showRetry ? 'inline-block' : 'none';
            }
        }
    }
};

// Agent control functions (Modified setAgentState)
function initializeAgentControls() {
    const pauseButton = document.getElementById('pauseAgents');
    const resumeButton = document.getElementById('resumeAgents');
    const idleButton = document.getElementById('idleAgents');

    if (pauseButton) {
        pauseButton.addEventListener('click', () => setAgentState('paused'));
    }
    if (resumeButton) {
        resumeButton.addEventListener('click', () => setAgentState('active'));
    }
    if (idleButton) {
        idleButton.addEventListener('click', () => setAgentState('idle'));
    }
    console.log("Agent controls initialized.");
}

async function setAgentState(state) {
    console.log(`Attempting to set agent state to: ${state}`);
    const endpoint = `${window.API_CONFIG.ENDPOINTS.AGENTS}/${state}`;
    try {
         // Use apiCall (from base.js) - expecting { data } or throws error
         const { data } = await window.apiCall(endpoint, { method: 'PUT' });

        // Assuming backend returns { message: "..." } on success
        showToast('success', data.message || `Agents set to ${state}`);
        // Trigger an immediate metrics update after changing state
        fetchAndUpdateDashboardData(); 

    } catch (error) {
        console.error(`Error setting agent state to ${state}:`, error);
        // Use error.message which might come from APIError in base.js
        showToast('error', `Failed to set state: ${error.message || 'Unknown error'}`);
    }
}

// --- Central Data Fetching Function (Adjusted) ---
async function fetchAndUpdateDashboardData() {
    // Ensure connection before fetching data
    if (ConnectionManager.status !== 'connected') {
        console.warn("Skipping data fetch: Not connected.");
        return;
    }
    console.log("Fetching dashboard data...");
    try {
        // apiCall throws error on failure, returns { data } on success
        const { data } = await window.apiCall(window.API_CONFIG.ENDPOINTS.METRICS);

        if (data) {
            console.log("Dashboard data received:", data);
            // Assume API returns { overview: {...}, charts: {...} }
            OverviewManager.updateDOM(data.overview || data); 
            ChartsManager.updateAllCharts(data.charts || data); 
        } else {
             // This case might not be reached if apiCall always returns data or throws
             console.warn('Fetched dashboard data but it was empty/null.');
        }
    } catch (error) {
        console.error('Error fetching or updating dashboard data:', error);
        // Log error but avoid flooding UI with toasts for background updates
    }
}


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded. Initializing dashboard...");

    if (!window.API_CONFIG || !window.API_CONFIG.ENDPOINTS) {
        console.error('Dashboard: Required API_CONFIG or ENDPOINTS not found');
        showToast('Dashboard initialization failed: API configuration missing.', 'error');
        return;
    }

    // Initialize components only once
    if (!window.dashboardInitialized) {
        try {
            console.log("Initializing managers...");
            DashboardTheme.init();    // Theme first
            OverviewManager.init(); // Caches elements
            ChartsManager.init();   // Creates chart instances
            ConnectionManager.init(); // Starts connection checks, triggers first fetch on success
            initializeAgentControls();

            // Start periodic updates AFTER initialization and first connection
            // ConnectionManager now triggers the first fetchAndUpdateDashboardData on success
            // ChartsManager.startUpdates() sets the interval for subsequent fetches
            ChartsManager.startUpdates(); 
            
            window.dashboardInitialized = true;
            console.log("Dashboard initialized successfully.");

        } catch (error) {
            console.error('Error during dashboard initialization:', error);
            showToast('Error initializing dashboard components. Check console.', 'error');
        }
    } else {
        console.log("Dashboard already initialized.");
    }
});

// Helper function to show toast notifications
function showToast(type = 'info', message) {
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    const container = document.getElementById('toast-container') || document.body;
    container.appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: window.UI_CONFIG.TOAST_DURATION
    });
    bsToast.show();
    
    // Remove the toast element after it's hidden
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

// REMOVED REDUNDANT apiCall FUNCTION

// Redundant functions below this line should also be reviewed/removed if they duplicate base.js
// function initializeCharts() { ... } 
// function updateRateLimitChart(data) { ... }

// ... existing code ... 