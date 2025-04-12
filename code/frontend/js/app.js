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
        showLoading(agentListElement);
        activeAgentsCountElement.textContent = '...';
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/agents`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            allAgents = data; // Store globally
            filterAndRenderAgents();
            updateAgentDropdown();
            updateSystemStatus('online', 'System Online'); // Assume online if agents fetch works
        } catch (error) {
            console.error("Error fetching agents:", error);
            agentListElement.innerHTML = '';
            showError('agent-list', `Failed to load agents: ${error.message}`);
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
            // Format the endpoint URL
            const url = `${API_CONFIG.BASE_URL}/api/agents/${agentId}/status`;
            console.log(`Updating agent status: ${url}`, { status: newStatus });
            
            // Enhanced request with proper CORS headers
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ status: newStatus }),
                credentials: 'same-origin'  // Include credentials to handle CORS issues
            });
            
            if (response.ok) {
                console.log(`Successfully updated agent ${agentId} status to ${newStatus}`);
                // Refresh agent list smoothly
                fetchAgents(); 
            } else {
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
            }
        } catch (error) {
            console.error('Error updating agent status:', error);
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
        try {
            console.log("Fetching tools from:", `${API_CONFIG.BASE_URL}/api/tools`);
            
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/tools`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                let errorMessage = '';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || `Error ${response.status}`;
                } catch (e) {
                    errorMessage = await response.text() || `Error ${response.status}`;
                }
                
                console.error("Failed to fetch tools:", response.status, errorMessage);
                showError('tool-list', `Failed to fetch tools: ${errorMessage}`);
                return;
            }
            
            const tools = await response.json();
            console.log("Tools fetched:", tools);
            
            // Clear the tools list
            const toolList = document.getElementById('tool-list');
            toolList.innerHTML = '';
            
            if (tools.length === 0) {
                toolList.innerHTML = '<div class="text-muted text-center p-3">No tools available</div>';
                return;
            }
            
            // Add each tool to the list
            tools.forEach(tool => {
                const toolCard = createToolCard(tool);
                toolList.appendChild(toolCard);
            });
            
        } catch (error) {
            console.error("Error fetching tools:", error);
            showError('tool-list', `Network error fetching tools: ${error.message}`);
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
    function updateRealMcpDisplay() {
        if (!rolesCountElement || !messagesCountElement || !memoryCountElement || !contextUsageBarElement) {
            return;
        }
        
        // Fetch real metrics from the API
        fetch(`${API_CONFIG.BASE_URL}/api/metrics`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Get current values from API
                const rolesCount = allAgents.length || 0;
                
                // Update DOM elements with real data
                rolesCountElement.textContent = rolesCount;
                
                // Use metrics data from API for messages and memory
                if (messagesCountElement) messagesCountElement.textContent = data.active_sessions || 0;
                if (memoryCountElement) memoryCountElement.textContent = data.active_agents || 0;
                
                // Calculate real context usage based on API data
                const contextTotal = 4096; // Maximum context window size
                const contextUsed = data.total_tokens || 0;
                const usagePercent = Math.min(100, Math.round((contextUsed / contextTotal) * 100));
                
                // Update UI elements
                contextUsageBarElement.style.width = `${usagePercent}%`;
                contextUsageBarElement.textContent = `${usagePercent}%`;
                contextUsageBarElement.setAttribute('aria-valuenow', usagePercent);
                
                if (contextUsedElement) contextUsedElement.textContent = contextUsed.toLocaleString();
                if (contextTotalElement) contextTotalElement.textContent = contextTotal.toLocaleString();
                document.getElementById('context-usage-text').textContent = `${contextUsed.toLocaleString()} / ${contextTotal.toLocaleString()} tokens`;
                
                // Set color based on usage
                if (usagePercent > 80) {
                    contextUsageBarElement.classList.remove('bg-success', 'bg-warning');
                    contextUsageBarElement.classList.add('bg-danger');
                } else if (usagePercent > 50) {
                    contextUsageBarElement.classList.remove('bg-success', 'bg-danger');
                    contextUsageBarElement.classList.add('bg-warning');
                } else {
                    contextUsageBarElement.classList.remove('bg-warning', 'bg-danger');
                    contextUsageBarElement.classList.add('bg-success');
                }
                
                // Update chart with real data
                updateContextHistoryChart(usagePercent);
            })
            .catch(error => {
                console.error("Error fetching metrics:", error);
                showError('mcp-stats', `Failed to load metrics: ${error.message}`);
            });
    }
    
    // Context History Chart
    let chartData = {
        labels: Array.from({length: 12}, (_, i) => `${i*5}m ago`).reverse(),
        data: Array.from({length: 12}, () => 0) // Initialize with zeros instead of random data
    };

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
        
        // Attempt to fetch historical data first
        fetch(`${API_CONFIG.BASE_URL}/api/metrics`)
            .then(response => response.json())
            .then(data => {
                // Initialize with current usage
                const contextTotal = 4096;
                const contextUsed = data.total_tokens || 0;
                const usagePercent = Math.min(100, Math.round((contextUsed / contextTotal) * 100));
                
                // Fill the initial data with the current value
                chartData.data = Array.from({length: 12}, () => usagePercent);
                
                createContextChart();
            })
            .catch(error => {
                console.error("Error fetching initial metrics for chart:", error);
                createContextChart(); // Create chart anyway with empty data
            });
    }
    
    function createContextChart() {
        const chartElement = document.getElementById('context-history-chart');
        if (!chartElement || !window.Chart) return;
        
        const ctx = chartElement.getContext('2d');
        contextHistoryChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [...chartData.labels], // Create a copy to avoid reference issues
                datasets: [{
                    label: 'Context Usage %',
                    data: [...chartData.data], // Create a copy of the data
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false, // Disable animations completely
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
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
                    }
                }
            }
        });
    }
    
    function updateContextHistoryChart(newValue) {
        // Update the stored data
        chartData.data.shift();
        chartData.data.push(newValue);
        
        // If chart doesn't exist, initialize it
        if (!contextHistoryChart) {
            initContextHistoryChart();
            return;
        }
        
        // Check if chart is still valid (canvas might have been removed from DOM)
        if (!contextHistoryChart.canvas || !contextHistoryChart.canvas.parentNode) {
            contextHistoryChart = null;
            return;
        }
        
        // Update chart with new data (create a copy to avoid reference issues)
        contextHistoryChart.data.labels = [...chartData.labels];
        contextHistoryChart.data.datasets[0].data = [...chartData.data];
        contextHistoryChart.update('none'); // Update without animation
    }
    
    // Update the interval to be less frequent and clear it on cleanup
    let mcpUpdateInterval;

    function startMcpUpdates() {
        // Clear any existing interval
        if (mcpUpdateInterval) {
            clearInterval(mcpUpdateInterval);
            mcpUpdateInterval = null;
        }
        
        // Initialize chart data with zeros instead of random values
        chartData.data = Array.from({length: 12}, () => 0);
        
        // Update immediately with real data
        updateRealMcpDisplay();
        
        // Set new interval at reasonable frequency
        mcpUpdateInterval = setInterval(() => {
            // Only update if document is visible and the chart exists
            if (document.visibilityState === 'visible' && document.getElementById('context-history-chart')) {
                updateRealMcpDisplay();
            }
        }, 60000); // Once per minute is plenty for a dashboard
    }

    function cleanupCharts() {
        if (contextHistoryChart) {
            try {
                contextHistoryChart.destroy();
            } catch (e) {
                console.error("Error destroying chart:", e);
            }
            contextHistoryChart = null;
        }
        
        // Clear the update interval
        if (mcpUpdateInterval) {
            clearInterval(mcpUpdateInterval);
            mcpUpdateInterval = null;
        }
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
    
    // Initial data fetch
    loadAllData();

    // Add security metrics section
    function initSecurityDashboard() {
        fetch(`${API_CONFIG.BASE_URL}/api/security-metrics`)
            .then(response => response.json())
            .then(data => {
                renderRateLimitChart(data.rate_limits);
                renderRequestMap(data.geo_data);
                updateThreatFeed(data.recent_blocks);
            })
            .catch(error => {
                console.error("Error fetching security metrics:", error);
                showError('security-metrics', `Failed to load security metrics: ${error.message}`);
            });
    }
    
    function renderRateLimitChart(rateLimitData) {
        const chartElement = document.getElementById('rate-limit-chart');
        if (!chartElement || !window.Chart) return;
        
        // Transform data for chart
        const labels = rateLimitData.map(item => item.endpoint);
        const requestCounts = rateLimitData.map(item => item.requests);
        const errorCounts = rateLimitData.map(item => item.errors);
        
        const ctx = chartElement.getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Requests',
                        data: requestCounts,
                        backgroundColor: 'rgba(75, 192, 192, 0.6)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Errors',
                        data: errorCounts,
                        backgroundColor: 'rgba(255, 99, 132, 0.6)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'API Rate Limits & Errors'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Count'
                        }
                    }
                }
            }
        });
    }
    
    function renderRequestMap(geoData) {
        const mapElement = document.getElementById('request-map');
        if (!mapElement) return;
        
        // Simple visualization without actual map
        mapElement.innerHTML = `
            <div class="card h-100">
                <div class="card-header">
                    <h6 class="m-0 font-weight-bold">Request Geographic Distribution</h6>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-sm table-hover">
                            <thead>
                                <tr>
                                    <th>IP Address</th>
                                    <th>Requests</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${geoData.map(item => `
                                    <tr>
                                        <td>${item.client_ip}</td>
                                        <td>${item.requests}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }
    
    function updateThreatFeed(blockData) {
        const feedElement = document.getElementById('threat-feed');
        if (!feedElement) return;
        
        if (!blockData || blockData.length === 0) {
            feedElement.innerHTML = `
                <div class="card h-100">
                    <div class="card-header">
                        <h6 class="m-0 font-weight-bold">Security Events</h6>
                    </div>
                    <div class="card-body">
                        <p class="text-center text-muted">No security events detected</p>
                    </div>
                </div>
            `;
            return;
        }
        
        feedElement.innerHTML = `
            <div class="card h-100">
                <div class="card-header">
                    <h6 class="m-0 font-weight-bold">Security Events</h6>
                </div>
                <div class="card-body">
                    <div class="list-group security-feed">
                        ${blockData.map(item => `
                            <div class="list-group-item list-group-item-action flex-column align-items-start p-2">
                                <div class="d-flex w-100 justify-content-between">
                                    <h6 class="mb-1">${item.type || 'Unknown'}</h6>
                                    <small>${new Date(item.timestamp).toLocaleTimeString()}</small>
                                </div>
                                <p class="mb-1 small">${item.description || 'No details available'}</p>
                                <small class="text-danger">IP: ${item.ip || 'Unknown'}</small>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Initialize token usage metrics
    function initTokenUsageMetrics() {
        fetch(`${API_CONFIG.BASE_URL}/api/token-metrics`)
            .then(response => response.json())
            .then(data => {
                renderTokenHistory(data.token_history);
                updateTokenSummary(data);
            })
            .catch(error => {
                console.error("Error fetching token metrics:", error);
                showError('token-metrics', `Failed to load token metrics: ${error.message}`);
            });
    }
    
    function renderTokenHistory(tokenHistory) {
        const chartElement = document.getElementById('token-history-chart');
        if (!chartElement || !window.Chart) return;
        
        // Transform data for chart
        const labels = tokenHistory.map(item => item.day);
        const tokenCounts = tokenHistory.map(item => item.daily_tokens);
        
        const ctx = chartElement.getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Daily Token Usage',
                        data: tokenCounts,
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Token Usage History (7 Days)'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Tokens: ${context.parsed.y.toLocaleString()}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Tokens'
                        }
                    }
                }
            }
        });
    }
    
    function updateTokenSummary(data) {
        // Update the summary metrics
        const totalTokensElement = document.getElementById('total-tokens-count');
        const sessionTokensElement = document.getElementById('session-tokens-count');
        const avgTokensElement = document.getElementById('avg-tokens-count');
        const tokenUsageBarElement = document.getElementById('token-usage-bar');
        const tokenUsagePercentElement = document.getElementById('token-usage-percent');
        
        if (totalTokensElement) totalTokensElement.textContent = data.total_tokens.toLocaleString();
        if (sessionTokensElement) sessionTokensElement.textContent = data.session_tokens.toLocaleString();
        if (avgTokensElement) avgTokensElement.textContent = data.avg_tokens.toLocaleString();
        
        // Update the progress bar
        if (tokenUsageBarElement) {
            tokenUsageBarElement.style.width = `${data.usage_percent}%`;
            
            // Change color based on usage
            if (data.usage_percent < 50) {
                tokenUsageBarElement.className = 'progress-bar bg-success';
            } else if (data.usage_percent < 80) {
                tokenUsageBarElement.className = 'progress-bar bg-warning';
            } else {
                tokenUsageBarElement.className = 'progress-bar bg-danger';
            }
        }
        
        if (tokenUsagePercentElement) {
            tokenUsagePercentElement.textContent = `${data.usage_percent}%`;
        }
    }
    
    // Initialize security dashboard if we're on the main dashboard page
    if (document.getElementById('security-metrics')) {
        initSecurityDashboard();
        
        // Add event listener for security refresh button
        const refreshSecurityBtn = document.getElementById('refreshSecurity');
        if (refreshSecurityBtn) {
            refreshSecurityBtn.addEventListener('click', initSecurityDashboard);
        }
    }
    
    // Initialize token metrics if we're on the main dashboard page
    if (document.getElementById('token-metrics')) {
        initTokenUsageMetrics();
        
        // Add event listener for token refresh button
        const refreshTokensBtn = document.getElementById('refreshTokens');
        if (refreshTokensBtn) {
            refreshTokensBtn.addEventListener('click', initTokenUsageMetrics);
        }
    }

    function createToolCard(tool) {
        const div = document.createElement('div');
        div.className = 'list-group-item';
        const statusClass = tool.available ? 'text-success' : 'text-secondary';
        const statusIcon = tool.available ? 'bi-check-circle-fill' : 'bi-x-circle-fill';
        const statusText = tool.available ? 'Available' : 'Unavailable';

        div.innerHTML = `
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

        // Initialize tooltip
        const tooltip = new bootstrap.Tooltip(div.querySelector('[data-bs-toggle="tooltip"]'));

        return div;
    }
}); 