document.addEventListener('DOMContentLoaded', () => {
    console.log("Dashboard app.js loaded");

    // Ensure API_CONFIG is available from base.js
    if (typeof API_CONFIG === 'undefined') {
        console.error("API_CONFIG is not defined. Make sure base.js is loaded correctly.");
        // Display error messages in relevant sections
        showError('agent-list', 'Configuration Error: Cannot load API settings.');
        showError('tool-list', 'Configuration Error: Cannot load API settings.');
        showError('recent-activity-list', 'Configuration Error: Cannot load API settings.');
        updateSystemStatus('error', 'Config Error');
        return;
    }

    // Default fetch options for all API calls
    const defaultFetchOptions = {
        mode: 'cors',
        cache: 'no-cache',
        headers: API_CONFIG.DEFAULT_HEADERS,
        credentials: 'include'  // Changed from 'same-origin' to 'include' for CORS
    };

    // --- DOM Element References ---
    // Lists
    const agentListElement = document.getElementById('agent-list');
    const toolListElement = document.getElementById('tool-list');
    const recentActivityListElement = document.getElementById('recent-activity-list');
    
    // Metrics
    const activeAgentsCountElement = document.getElementById('active-agents-count');
    const availableToolsCountElement = document.getElementById('available-tools-count');
    const totalTasksCountElement = document.getElementById('total-tasks-count');
    const systemStatusElement = document.getElementById('system-status');
    
    // MCP Elements
    const rolesCountElement = document.getElementById('roles-count');
    const messagesCountElement = document.getElementById('messages-count');
    const memoryCountElement = document.getElementById('memory-count');
    const contextUsageBarElement = document.getElementById('context-usage-bar');
    const contextUsedElement = document.getElementById('context-used');
    const contextTotalElement = document.getElementById('context-total');
    
    // Search and Filter Elements
    const agentSearchInput = document.getElementById('agent-search');
    const toolSearchInput = document.getElementById('tool-search');
    const taskSearchInput = document.getElementById('task-search');
    
    // Refresh Buttons
    const globalRefreshBtn = document.getElementById('global-refresh-btn');
    const agentsRefreshBtn = document.getElementById('agents-refresh-btn');
    const toolsRefreshBtn = document.getElementById('tools-refresh-btn');
    const tasksRefreshBtn = document.getElementById('tasks-refresh-btn');
    const mcpRefreshBtn = document.getElementById('mcp-refresh-btn');
    
    // Filter Radios
    const agentFilterAll = document.getElementById('agent-filter-all');
    const agentFilterActive = document.getElementById('agent-filter-active');
    const agentFilterIdle = document.getElementById('agent-filter-idle');
    
    const taskFilterAll = document.getElementById('task-filter-all');
    const taskFilterCompleted = document.getElementById('task-filter-completed');
    const taskFilterInProgress = document.getElementById('task-filter-in-progress');
    const taskFilterPending = document.getElementById('task-filter-pending');
    const taskFilterFailed = document.getElementById('task-filter-failed');
    
    // Task Creation Elements
    const createTaskBtn = document.getElementById('create-task-btn');
    const submitTaskBtn = document.getElementById('submit-task-btn');
    const taskAgentSelect = document.getElementById('task-agent');
    const taskDescriptionInput = document.getElementById('task-description');
    const taskPrioritySelect = document.getElementById('task-priority');
    
    // Store data globally for filtering
    let allAgents = [];
    let allTools = [];
    let allTasks = [];
    
    // Chart reference
    let contextHistoryChart = null;
    let chartData = {
        labels: [],
        data: []
    };

    // Initialize data fetching AFTER DOM elements are initialized
    fetchAgents();
    fetchTools();
    updateRealMcpDisplay();

    // Set up refresh intervals
    setInterval(updateRealMcpDisplay, 30000); // Update MCP display every 30 seconds
    setInterval(fetchAgents, 60000); // Update agents every minute
    setInterval(fetchTools, 120000); // Update tools every 2 minutes

    // --- Utility Functions ---
    function showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            // Insert error inline, less intrusive than replacing all content
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-danger alert-dismissible fade show p-2 mt-2 mb-0';
            errorDiv.role = 'alert';
            errorDiv.innerHTML = `
                <small><i class="bi bi-exclamation-triangle-fill"></i> ${message}</small>
                <button type="button" class="btn-close btn-sm p-1" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            // Prepend error to keep content visible
            if (element.firstChild) {
                element.insertBefore(errorDiv, element.firstChild);
            } else {
                element.appendChild(errorDiv);
            }
        }
    }

    function showLoading(element) {
        if (element) {
             element.innerHTML = `
                <div class="list-group-item text-center p-3">
                    <div class="spinner-border text-secondary spinner-border-sm" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <span class="ms-2 text-muted">Loading...</span>
                </div>`;
        }
    }
    
    function initializeTooltips() {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
    
    function updateSystemStatus(status, text) {
        let badgeClass = 'bg-secondary';
        let iconClass = 'bi-question-circle';

        switch (status) {
            case 'online':
                badgeClass = 'bg-success';
                iconClass = 'bi-check-circle';
                break;
            case 'degraded':
                badgeClass = 'bg-warning text-dark';
                iconClass = 'bi-exclamation-triangle';
                break;
            case 'error':
                badgeClass = 'bg-danger';
                iconClass = 'bi-x-octagon';
                break;
        }
        systemStatusElement.className = `badge ${badgeClass}`;
        systemStatusElement.innerHTML = `<i class="bi ${iconClass}"></i> ${text}`;
    }

    // --- Data Fetching and Rendering Functions ---

    // Agents
    async function fetchAgents() {
        if (!agentListElement || !activeAgentsCountElement) {
            console.warn('Required DOM elements for agents not found');
            return;
        }
        showLoading(agentListElement);
        activeAgentsCountElement.textContent = '...';
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AGENTS}`, {
                ...defaultFetchOptions,
                method: 'GET'
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            allAgents = data;
            filterAndRenderAgents();
            updateAgentDropdown();
            updateSystemStatus('online', 'System Online');
        } catch (error) {
            console.error('Failed to fetch agents:', error);
            showError('agent-list', 'Failed to load agents');
            agentListElement.innerHTML = '';
            activeAgentsCountElement.textContent = 'Err';
            updateSystemStatus('error', 'Agent API Error');
        }
    }

    function filterAndRenderAgents() {
        // Apply filters and search
        let filteredAgents = [...allAgents];
        
        // Status filter
        if (agentFilterActive.checked) {
            filteredAgents = filteredAgents.filter(agent => agent.status === 'active');
        } else if (agentFilterIdle.checked) {
            filteredAgents = filteredAgents.filter(agent => agent.status === 'idle');
        }
        
        // Search filter
        const searchTerm = agentSearchInput.value.toLowerCase().trim();
        if (searchTerm) {
            filteredAgents = filteredAgents.filter(agent => 
                agent.name.toLowerCase().includes(searchTerm) || 
                agent.role.toLowerCase().includes(searchTerm) ||
                agent.goal.toLowerCase().includes(searchTerm) ||
                agent.capabilities.some(cap => cap.toLowerCase().includes(searchTerm))
            );
        }
        
        renderAgents(filteredAgents);
    }

    function renderAgents(agents) {
        agentListElement.innerHTML = ''; 
        if (!agents || agents.length === 0) {
            agentListElement.innerHTML = '<div class="list-group-item text-muted text-center p-3"><i class="bi bi-person-x"></i> No agents found matching criteria.</div>';
            activeAgentsCountElement.textContent = '0';
            return;
        }
        agents.forEach(agent => {
            const statusBadgeClass = agent.status === 'active' ? 'bg-success' : 'bg-secondary';
            const statusIconClass = agent.status === 'active' ? 'bi-check-circle-fill' : 'bi-pause-circle-fill';
            const isIdle = agent.status === 'idle';
            
            const item = document.createElement('div'); // Use div instead of a for direct button actions
            item.className = 'list-group-item';
            
            const activateBtnIcon = isIdle ? 'bi-play-circle' : 'bi-pause-circle';
            const activateBtnText = isIdle ? 'Activate' : 'Pause';
            const activateBtnClass = isIdle ? 'btn-outline-success' : 'btn-outline-secondary';
            const activateBtnTooltip = isIdle ? 'Activate this agent' : 'Pause this agent';
            
            item.innerHTML = `
                <div class="row g-2 align-items-center">
                    <div class="col-md-8">
                        <h6 class="mb-0">${agent.name || 'Unnamed Agent'}</h6>
                        <p class="mb-1 text-muted small">${agent.role || 'No role'}</p>
                        <p class="mb-1 text-muted small"><strong>Goal:</strong> ${agent.goal || 'No goal defined'}</p>
                        <div class="mb-1">
                            <strong>Capabilities:</strong>
                            ${(agent.capabilities || []).map(cap => 
                                `<span class="badge bg-info text-dark me-1">${cap}</span>`
                            ).join('') || '<span class="text-muted small">None</span>'}
                        </div>
                    </div>
                    <div class="col-md-4 text-end">
                        <div class="mb-2">
                             <span class="badge ${statusBadgeClass} rounded-pill" data-bs-toggle="tooltip" title="Current status: ${agent.status || 'unknown'}">
                                <i class="bi ${statusIconClass}"></i> ${agent.status || 'unknown'}
                            </span>
                        </div>
                        <div class="btn-group btn-group-sm" role="group">
                            <button type="button" class="btn btn-outline-primary agent-chat-btn" data-agent-id="${agent.id}" ${isIdle ? 'disabled' : ''} data-bs-toggle="tooltip" title="Open chat with ${agent.name}">
                                <i class="bi bi-chat-text"></i> Chat
                            </button>
                            <button type="button" class="btn ${activateBtnClass} agent-status-btn" data-agent-id="${agent.id}" data-status="${isIdle ? 'active' : 'idle'}" data-bs-toggle="tooltip" title="${activateBtnTooltip}">
                                <i class="bi ${activateBtnIcon}"></i> ${activateBtnText}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            agentListElement.appendChild(item);
        });
        
        // Add event listeners to status buttons
        document.querySelectorAll('.agent-status-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const agentId = btn.dataset.agentId;
                const newStatus = btn.dataset.status;
                updateAgentStatus(agentId, newStatus, btn);
            });
        });
        
        // Add event listeners to chat buttons
        document.querySelectorAll('.agent-chat-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const agentId = btn.dataset.agentId;
                window.location.href = `agent_chat.html?id=${agentId}`;
            });
        });
        
        activeAgentsCountElement.textContent = allAgents.filter(a => a.status === 'active').length;
        initializeTooltips(); // Initialize tooltips after rendering
    }
    
    async function updateAgentStatus(agentId, newStatus, buttonElement) {
        buttonElement.disabled = true;
        const originalIcon = buttonElement.querySelector('i').className;
        const originalText = buttonElement.innerText.trim().replace(originalIcon, '').trim();
        buttonElement.querySelector('i').className = 'bi bi-arrow-repeat spinner-grow spinner-grow-sm'; // Loading indicator
        
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AGENTS}/${agentId}`, {
                ...defaultFetchOptions,
                method: 'PUT',
                body: JSON.stringify({ status: newStatus })
            });
            
            if (!response.ok) {
                let errorMessage = '';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || `Error ${response.status}`;
                } catch (e) {
                    errorMessage = await response.text() || `Error ${response.status}`;
                }
                
                console.error("Failed to update agent status:", response.status, errorMessage);
                showError(`agent-list`, `Failed to update agent status: ${errorMessage}`);
                
                // Reset button on failure
                buttonElement.disabled = false;
                buttonElement.querySelector('i').className = originalIcon;
                buttonElement.innerHTML = `<i class="${originalIcon}"></i> ${originalText}`;
                return;
            }

            console.log(`Successfully updated agent ${agentId} status to ${newStatus}`);
            // Refresh agent list smoothly
            fetchAgents();
        } catch (error) {
            console.error('Failed to update agent status:', error);
            showError(`agent-list`, `Network error updating agent status: ${error.message}`);
            
            // Reset button on failure
            buttonElement.disabled = false;
            buttonElement.querySelector('i').className = originalIcon;
            buttonElement.innerHTML = `<i class="${originalIcon}"></i> ${originalText}`;
        }
    }
    
    function updateAgentDropdown() {
        if (!taskAgentSelect) return;
        
        // Clear existing options except the first one
        while (taskAgentSelect.options.length > 1) {
            taskAgentSelect.remove(1);
        }
        
        // Add active agents as options
        const activeAgents = allAgents.filter(agent => agent.status === 'active');
        activeAgents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent.id;
            option.textContent = agent.name;
            taskAgentSelect.appendChild(option);
        });
    }

    // Tools 
    async function fetchTools() {
        if (!toolListElement || !availableToolsCountElement) {
            console.warn('Required DOM elements for tools not found');
            return;
        }
        showLoading(toolListElement);
        availableToolsCountElement.textContent = '...';
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOOLS}`, {
                ...defaultFetchOptions,
                method: 'GET'
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            allTools = data;
            filterAndRenderTools();
        } catch (error) {
            console.error('Failed to fetch tools:', error);
            showError('tool-list', 'Failed to load tools');
            toolListElement.innerHTML = '';
            availableToolsCountElement.textContent = 'Err';
        }
    }

    function filterAndRenderTools() {
        // Apply search filter
        let filteredTools = [...allTools];
        const searchTerm = toolSearchInput ? toolSearchInput.value.toLowerCase().trim() : '';
        
        if (searchTerm) {
            filteredTools = filteredTools.filter(tool => 
                tool.name.toLowerCase().includes(searchTerm) || 
                tool.description.toLowerCase().includes(searchTerm)
            );
        }
        
        renderTools(filteredTools);
    }

    function renderTools(tools) {
        toolListElement.innerHTML = ''; 
        if (!tools || tools.length === 0) {
            toolListElement.innerHTML = '<div class="list-group-item text-muted text-center p-3"><i class="bi bi-tools"></i> No tools found matching criteria.</div>';
            availableToolsCountElement.textContent = '0';
            return;
        }
        tools.forEach(tool => {
            const item = document.createElement('div');
            item.className = 'list-group-item';
            const statusClass = tool.available ? 'text-success' : 'text-secondary';
            const statusIcon = tool.available ? 'bi-check-circle-fill' : 'bi-x-circle-fill';
            const statusText = tool.available ? 'Available' : 'Unavailable';

            item.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6 class="mb-1"><i class="bi bi-gear"></i> ${tool.name || 'Unnamed Tool'}</h6>
                        <p class="mb-0 text-muted small">${tool.description || 'No description'}</p>
                        <small class="text-muted">API: ${tool.api_endpoint || 'N/A'}</small>
                    </div>
                    <span class="${statusClass} small" data-bs-toggle="tooltip" title="${statusText}">
                        <i class="bi ${statusIcon}"></i>
                    </span>
                </div>
            `;
            toolListElement.appendChild(item);
        });
        availableToolsCountElement.textContent = allTools.filter(t => t.available).length;
        initializeTooltips(); // Initialize tooltips after rendering
    }
    
    // Real MCP Status with API data
    async function updateRealMcpDisplay() {
        try {
            // Use apiCall instead of direct fetch to ensure API key is included
            const response = await apiCall(API_CONFIG.ENDPOINTS.METRICS, API_CONFIG, { 
                method: 'GET' 
            });
            // Assuming apiCall returns { data, status } structure
            const metrics = response.data; 
            
            if (!metrics || !metrics.mcp) return;
            
            // Update MCP metrics display
            const mcpMetrics = metrics.mcp;
            
            // Get DOM elements with null checks
            const activeRolesElement = document.getElementById('active-roles');
            const totalMessagesElement = document.getElementById('total-messages');
            const memoryObjectsElement = document.getElementById('memory-objects');
            const contextUsageElement = document.getElementById('context-usage');
            
            // Update elements if they exist
            if (activeRolesElement) {
                activeRolesElement.textContent = mcpMetrics.roles || '0';
            }
            if (totalMessagesElement) {
                totalMessagesElement.textContent = mcpMetrics.messages || '0';
            }
            if (memoryObjectsElement) {
                memoryObjectsElement.textContent = mcpMetrics.memory_objects || '0';
            }
            
            // Update context usage if available
            if (mcpMetrics.context) {
                const usagePercent = mcpMetrics.context.usage_percentage || 0;
                
                if (contextUsageElement) {
                    contextUsageElement.textContent = `${Math.round(usagePercent)}%`;
                }
                
                // Update progress bar
                const progressBar = document.getElementById('context-progress');
                if (progressBar) {
                    progressBar.style.width = `${usagePercent}%`;
                    progressBar.setAttribute('aria-valuenow', usagePercent);
                    
                    // Update color based on usage
                    if (usagePercent > 90) {
                        progressBar.className = 'progress-bar bg-danger';
                    } else if (usagePercent > 75) {
                        progressBar.className = 'progress-bar bg-warning';
                    } else {
                        progressBar.className = 'progress-bar bg-success';
                    }
                }
                
                // Update chart if history data is available and chart exists
                if (mcpMetrics.context.history && mcpMetrics.context.history.length > 0 && document.getElementById('context-history-chart')) {
                    const historyData = mcpMetrics.context.history.map(point => ({
                        timestamp: point.timestamp,
                        value: (point.tokens_used / mcpMetrics.context.max_tokens) * 100
                    }));
                    updateContextHistoryChart(historyData);
                }
            }
        } catch (error) {
            console.error('Error updating MCP display:', error);
            showError('mcp-metrics', `Failed to fetch metrics: ${error.message}`);
        }
    }
    
    function updateContextHistoryChart(historyData) {
        // Update chartData with new values
        chartData.labels = historyData.map(point => {
            const time = point.timestamp;
            return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        });
        chartData.data = historyData.map(point => point.value);

        // If chart doesn't exist, initialize it
        if (!contextHistoryChart) {
            initContextHistoryChart();
            return;
        }
        
        // Check if chart is still valid
        if (!contextHistoryChart.canvas || !contextHistoryChart.canvas.parentNode) {
            contextHistoryChart = null;
            initContextHistoryChart();
            return;
        }
        
        // Update chart with new data
        contextHistoryChart.data.labels = chartData.labels;
        contextHistoryChart.data.datasets[0].data = chartData.data;
        contextHistoryChart.update('none');
    }
    
    function initContextHistoryChart() {
        const chartElement = document.getElementById('context-history-chart');
        if (!chartElement || !window.Chart) return;
        
        // Set fixed height for chart container and parent
        chartElement.style.height = '200px';
        chartElement.parentElement.style.height = '250px';
        chartElement.parentElement.style.overflow = 'hidden';
        
        // Destroy existing chart if it exists
        if (contextHistoryChart) {
            contextHistoryChart.destroy();
            contextHistoryChart = null;
        }
        
        createContextChart();
    }

    function createContextChart() {
        const chartElement = document.getElementById('context-history-chart');
        if (!chartElement || !window.Chart) return;
        
        const ctx = chartElement.getContext('2d');
        contextHistoryChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Context Usage %',
                    data: chartData.data,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `Usage: ${Math.round(context.raw)}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
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
    }

    // Update the interval to be less frequent and clear it on cleanup
    let mcpUpdateInterval;

    function startMcpUpdates() {
        // Clear any existing interval
        if (mcpUpdateInterval) {
            clearInterval(mcpUpdateInterval);
            mcpUpdateInterval = null;
        }
        
        // Initialize chart if it exists on the page
        if (document.getElementById('context-history-chart')) {
            initContextHistoryChart();
        }
        
        // Update immediately
        updateRealMcpDisplay();
        
        // Set new interval
        mcpUpdateInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                updateRealMcpDisplay();
            }
        }, 30000); // Update every 30 seconds
    }

    function cleanupCharts() {
        if (contextHistoryChart) {
            contextHistoryChart.destroy();
            contextHistoryChart = null;
        }
        
        if (mcpUpdateInterval) {
            clearInterval(mcpUpdateInterval);
            mcpUpdateInterval = null;
        }
        
        // Reset chart data
        chartData.labels = [];
        chartData.data = [];
    }

    // Optimize the visibility change handler
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            cleanupCharts();
        } else {
            // Only start updates if we're on a page with the chart
            if (document.getElementById('context-history-chart')) {
                startMcpUpdates();
            }
        }
    });

    // Cleanup before page unload
    window.addEventListener('beforeunload', () => {
        cleanupCharts();
    });

    // Load all data
    function loadAllData() {
        cleanupCharts();
        fetchAgents();
        fetchTools();
        
        // Only start MCP updates if the chart exists on the page
        if (document.getElementById('context-history-chart')) {
            startMcpUpdates();
        }
    }
    
    // --- Event Handlers ---
    
    // Search inputs
    if (agentSearchInput) {
        agentSearchInput.addEventListener('input', filterAndRenderAgents);
    }
    
    if (toolSearchInput) {
        toolSearchInput.addEventListener('input', filterAndRenderTools);
    }
    
    // Agent filters
    [agentFilterAll, agentFilterActive, agentFilterIdle].forEach(filter => {
        if (filter) {
            filter.addEventListener('change', filterAndRenderAgents);
        }
    });
    
    // Refresh buttons
    if (globalRefreshBtn) {
        globalRefreshBtn.addEventListener('click', loadAllData);
    }
    
    if (agentsRefreshBtn) {
        agentsRefreshBtn.addEventListener('click', fetchAgents);
    }
    
    if (toolsRefreshBtn) {
        toolsRefreshBtn.addEventListener('click', fetchTools);
    }
    
    if (mcpRefreshBtn) {
        mcpRefreshBtn.addEventListener('click', updateRealMcpDisplay);
    }
    
    // Security Feed Functions
    async function updateSecurityFeed() {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SECURITY}`, {
                ...defaultFetchOptions,
                method: 'GET'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.warn('Failed to fetch security events:', error);
            return [];
        }
    }

    // Check backend connectivity before making API calls
    async function checkBackendConnectivity() {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.HEALTH}`, {
                ...defaultFetchOptions,
                method: 'GET'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            if (data.status === 'healthy') {
                console.log('Backend connectivity check passed');
                return true;
            }
            throw new Error('Backend health check failed');
        } catch (error) {
            console.error('Backend connectivity check failed:', error);
            showError('system-status', `Backend connectivity error: ${error.message}`);
            updateSystemStatus('error', 'Backend Error');
            return false;
        }
    }

    // Modified loadAllData to check connectivity first
    async function loadAllData() {
        cleanupCharts();
        
        // Check backend connectivity first
        const isConnected = await checkBackendConnectivity();
        if (!isConnected) {
            showError('system-status', 'Cannot connect to backend. Please check your connection and try again.');
            return;
        }
        
        fetchAgents();
        fetchTools();
        
        // Only start MCP updates if the chart exists on the page
        if (document.getElementById('context-history-chart')) {
            startMcpUpdates();
        }
    }
    
    // Initial data fetch
    loadAllData();

    // Initialize security feed with better error handling
    updateSecurityFeed().then(blockData => {
        const feedElement = document.getElementById('security-feed');
        if (!feedElement) {
            console.warn('Security feed element not found');
            return;
        }
        
        feedElement.innerHTML = `
            <div class="card h-100">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="m-0 font-weight-bold">Security Events</h6>
                    <button class="btn btn-sm btn-outline-secondary refresh-security-feed" title="Refresh security feed">
                        <i class="bi bi-arrow-clockwise"></i>
                    </button>
                </div>
                <div class="card-body">
                    <div class="list-group security-feed">
                        ${blockData.length ? blockData.map(item => `
                            <div class="list-group-item list-group-item-action flex-column align-items-start p-2">
                                <div class="d-flex w-100 justify-content-between">
                                    <h6 class="mb-1">${item.type || 'Unknown'}</h6>
                                    <small>${new Date(item.timestamp).toLocaleTimeString()}</small>
                                </div>
                                <p class="mb-1 small">${item.description || 'No details available'}</p>
                                <small class="text-danger">IP: ${item.ip || 'Unknown'}</small>
                            </div>
                        `).join('') : `
                            <div class="list-group-item text-center text-muted">
                                <i class="bi bi-shield-check"></i> No security events to display
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;

        // Add refresh button handler
        const refreshBtn = feedElement.querySelector('.refresh-security-feed');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                refreshBtn.disabled = true;
                refreshBtn.querySelector('i').classList.add('spin');
                updateSecurityFeed().then(newData => {
                    // Update only the list group content
                    const listGroup = feedElement.querySelector('.security-feed');
                    if (listGroup) {
                        listGroup.innerHTML = newData.map(item => `
                            <div class="list-group-item list-group-item-action flex-column align-items-start p-2">
                                <div class="d-flex w-100 justify-content-between">
                                    <h6 class="mb-1">${item.type || 'Unknown'}</h6>
                                    <small>${new Date(item.timestamp).toLocaleTimeString()}</small>
                                </div>
                                <p class="mb-1 small">${item.description || 'No details available'}</p>
                                <small class="text-danger">IP: ${item.ip || 'Unknown'}</small>
                            </div>
                        `).join('');
                    }
                }).finally(() => {
                    refreshBtn.disabled = false;
                    refreshBtn.querySelector('i').classList.remove('spin');
                });
            });
        }
    });
});