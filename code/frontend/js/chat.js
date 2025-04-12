// Agent Chat Page JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Agent Chat page loaded");
    
    // --- API Configuration ---
    // Determine protocol (http vs https) and corresponding WS protocol (ws vs wss)
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const hostname = window.location.hostname || 'localhost';
    const port = '8000'; // Updated backend server port
    
    // Ensure we have our own API_CONFIG in this file
    const API_CONFIG = {
        BASE_URL: `${protocol}://${hostname}:${port}`,
        WS_URL: `${wsProtocol}://${hostname}:${port}`,
        ENDPOINTS: {
            AGENTS: '/api/agents',
            MESSAGES: '/api/messages',
            TOOLS: '/api/tools'
        }
    };
    
    console.log("API Configuration:", API_CONFIG);
    
    // --- DOM Elements ---
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const newChatBtn = document.getElementById('new-chat');
    const newChatHeaderBtn = document.getElementById('new-chat-header');
    const agentsList = document.getElementById('agents-list');
    const toolsBar = document.getElementById('tools-bar');
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const contextPanel = document.getElementById('context-panel');
    const contextChain = document.getElementById('context-chain');
    const reasoningSteps = document.getElementById('reasoning-steps');
    const toolUsage = document.getElementById('tool-usage');
    const sidebarThemeToggler = document.getElementById('sidebar-theme-toggler');
    const currentAgentName = document.getElementById('current-agent-name');
    const chatLayout = document.querySelector('.chat-layout');
    const contextToggleBtn = document.getElementById('context-toggle-btn');
    const errorAlert = document.getElementById('errorAlert');
    const modelDropdownButton = document.getElementById('modelDropdownButton');
    const modelDropdownMenu = document.getElementById('modelDropdownMenu');
    const themeToggle = document.getElementById('theme-toggle');
    
    // Tool modal elements
    const toolModal = new bootstrap.Modal(document.getElementById('toolModal'), {
        keyboard: false
    });
    const toolModalLabel = document.getElementById('toolModalLabel');
    const toolModalBody = document.getElementById('toolModalBody');
    const useToolButton = document.getElementById('useTool');
    
    // --- State Management ---
    let currentAgentId = getAgentIdFromURL();
    let isProcessing = false;
    let activeAgents = [];
    let availableTools = [];
    let selectedToolId = null;
    let ws = null;
    let wsReconnectTimer = null;
    let wsConnectionAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    
    // Models configuration
    const availableModels = [
        { 
            id: 'gpt-4',
            name: 'GPT-4',
            description: 'GPT-4 is a large multimodal model that can solve difficult problems with greater accuracy than previous models.',
            parameters: '1.76 trillion',
            context_window: '128,000'
        },
        { 
            id: 'gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            description: 'GPT-3.5 Turbo is optimized for dialogue and cost-effective for various natural language tasks.',
            parameters: '175 billion',
            context_window: '16,000'
        },
        { 
            id: 'claude-3-opus',
            name: 'Claude 3 Opus',
            description: 'Claude 3 Opus is Anthropic\'s most intelligent model with exceptional performance across reasoning, knowledge, and safety.',
            parameters: '~2 trillion',
            context_window: '200,000'
        },
        { 
            id: 'claude-3-sonnet',
            name: 'Claude 3 Sonnet',
            description: 'Claude 3 Sonnet balances intelligence and speed, offering strong performance at an accessible price point.',
            parameters: '~1 trillion',
            context_window: '100,000'
        }
    ];
    
    // Get current model from localStorage or set default
    let currentModel = localStorage.getItem('currentModel') || 'gpt-4';
    
    // --- Initialize Model Selector ---
    function initModelSelector() {
        if (!modelDropdownButton || !modelDropdownMenu) {
            console.error('Model selector elements not found');
            return;
        }
        
        // Set initial button text
        const selectedModel = availableModels.find(m => m.id === currentModel);
        if (selectedModel) {
            modelDropdownButton.innerHTML = `${selectedModel.name} <i class="bi bi-chevron-down ms-1"></i>`;
        }
        
        // Clear existing options
        modelDropdownMenu.innerHTML = '';
        
        // Add model options to dropdown
        availableModels.forEach(model => {
            const item = document.createElement('a');
            item.className = 'dropdown-item';
            if (model.id === currentModel) {
                item.classList.add('active');
            }
            item.href = '#';
            item.textContent = model.name;
            
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Update current model
                currentModel = model.id;
                localStorage.setItem('currentModel', currentModel);
                
                // Update UI
                modelDropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
                    item.classList.remove('active');
                });
                item.classList.add('active');
                modelDropdownButton.innerHTML = `${model.name} <i class="bi bi-chevron-down ms-1"></i>`;
                
                // Add system message about model change
                addSystemMessage(`Model changed to ${model.name}`);
            });
            
            modelDropdownMenu.appendChild(item);
        });
    }
    
    // --- UI Layout Management ---
    function toggleSidebar() {
        sidebar.classList.toggle('collapsed');
        
        if (sidebar.classList.contains('collapsed')) {
            // Sidebar is now collapsed
            chatLayout.classList.remove('show-sidebar');
            
            if (!contextPanel.classList.contains('collapsed')) {
                // Context panel is expanded
                chatLayout.classList.add('show-context');
            }
        } else {
            // Sidebar is now expanded
            chatLayout.classList.add('show-sidebar');
            
            if (!contextPanel.classList.contains('collapsed')) {
                // Both panels are expanded
                chatLayout.classList.add('show-both');
            }
        }
        
        // Force redraw to ensure layout updates
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 300);
    }
    
    function toggleContextPanel() {
        const contextPanel = document.getElementById('context-panel');
        const chatLayout = document.querySelector('.chat-layout');
        const contextToggleBtn = document.getElementById('context-toggle-btn');
        
        if (!contextPanel) return;
        
        // Add animation class
        contextPanel.classList.add('animating');
        
        // Toggle collapsed state
        contextPanel.classList.toggle('collapsed');
        
        if (contextPanel.classList.contains('collapsed')) {
            // Context panel is now collapsed
            chatLayout.classList.remove('show-context');
            
            // Update toggle button icon
            if (contextToggleBtn) {
                contextToggleBtn.innerHTML = '<i class="bi bi-layout-sidebar-reverse"></i>';
                contextToggleBtn.title = "Show Context Panel";
            }
            
            if (!document.getElementById('sidebar').classList.contains('collapsed')) {
                // Sidebar is expanded
                chatLayout.classList.add('show-sidebar');
            }
        } else {
            // Context panel is now expanded
            chatLayout.classList.add('show-context');
            
            // Reset minimized state when showing
            contextPanel.classList.remove('minimized');
            
            // Update button icon if needed
            const contextMinimizeBtn = document.getElementById('context-minimize');
            if (contextMinimizeBtn) {
                contextMinimizeBtn.innerHTML = '<i class="bi bi-arrows-angle-contract"></i>';
                contextMinimizeBtn.title = 'Minimize panel';
            }
            
            // Update toggle button icon
            if (contextToggleBtn) {
                contextToggleBtn.innerHTML = '<i class="bi bi-layout-sidebar-inset-reverse"></i>';
                contextToggleBtn.title = "Hide Context Panel";
            }
            
            if (!document.getElementById('sidebar').classList.contains('collapsed')) {
                // Both panels are expanded
                chatLayout.classList.add('show-both');
            }
        }
        
        // Remove animation class after transition
        setTimeout(() => {
            contextPanel.classList.remove('animating');
        }, 300);
        
        // Force redraw to ensure layout updates
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 300);
    }
    
    // Initialize layout - ensure at least one panel is visible by default
    if (sidebar && sidebar.classList.contains('collapsed') && 
        contextPanel && contextPanel.classList.contains('collapsed')) {
        // Both panels are collapsed, show sidebar
        toggleSidebar();
    }
    
    // Initialize layout
    sidebarToggle.addEventListener('click', toggleSidebar);
    sidebarClose?.addEventListener('click', toggleSidebar);
    document.getElementById('context-close')?.addEventListener('click', toggleContextPanel);
    contextToggleBtn?.addEventListener('click', toggleContextPanel);
    
    // Initialize the enhanced context panel
    initializeContextPanel();
    
    // --- Theme Toggle ---
    function initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light'; // Changed to default to light
        document.documentElement.setAttribute('data-bs-theme', savedTheme);
        updateThemeToggle(savedTheme);
    }
    
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-bs-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-bs-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        updateThemeToggle(newTheme);
    }
    
    function updateThemeToggle(theme) {
        if (theme === 'dark') {
            themeToggle.innerHTML = '<i class="bi bi-sun-fill"></i> <span>Light</span>';
            sidebarThemeToggler.innerHTML = '<i class="bi bi-sun-fill"></i> <span>Light</span>';
        } else {
            themeToggle.innerHTML = '<i class="bi bi-moon-stars-fill"></i> <span>Dark</span>';
            sidebarThemeToggler.innerHTML = '<i class="bi bi-moon-stars-fill"></i> <span>Dark</span>';
        }
    }
    
    // --- Get Agent ID from URL ---
    function getAgentIdFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id') || '1'; // Default to agent ID 1 if not specified
    }
    
    // --- Utility Functions ---
    function showError(containerId, message) {
        const container = document.getElementById(containerId);
        if (container) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-danger';
            errorDiv.textContent = message;
            container.innerHTML = '';
            container.appendChild(errorDiv);
        }
    }
    
    function formatMessage(message) {
        if (!message) return '';
        let escaped = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        // Convert code blocks with ```
        escaped = escaped.replace(/```(\w*)([\s\S]*?)```/g, function(match, language, code) {
            return `<pre class="code-block ${language}"><code>${code.trim()}</code></pre>`;
        });
        
        // Convert normal line breaks
        escaped = escaped.replace(/\n/g, '<br>');
        
        return escaped;
    }
    
    function scrollToBottom(element, smooth = false) {
        if (element) {
            element.scrollTo({
                top: element.scrollHeight,
                behavior: smooth ? 'smooth' : 'auto'
            });
        }
    }
    
    // --- Message Display Functions ---
    function addUserMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="bi bi-person"></i>
            </div>
            <div class="message-content">
                <p>${formatMessage(message)}</p>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        scrollToBottom(chatMessages, true);
    }
    
    function addAgentMessage(message, agentName = 'AI') {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message agent';
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="bi bi-robot"></i>
            </div>
            <div class="message-content">
                <p>${formatMessage(message)}</p>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        scrollToBottom(chatMessages, true);
        
        // Check for potential tool usage in the message
        handleToolUsageInMessage(message);
        
        // Check for reasoning steps
        if (message.includes("Step 1:") || message.includes("First,")) {
            extractAndDisplayReasoningSteps(message);
        }
    }
    
    function addSystemMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message system ${type}`;
        messageDiv.innerHTML = `
            <div class="message-content">
                <p><i class="bi bi-info-circle"></i> ${formatMessage(message)}</p>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        scrollToBottom(chatMessages, true);
    }
    
    // --- Agents and Tools Display ---
    function displayAgents(agents) {
        agentsList.innerHTML = '';
        
        // Update current agent name in header
        const currentAgent = agents.find(agent => agent.id === currentAgentId);
        if (currentAgent && currentAgentName) {
            currentAgentName.textContent = currentAgent.name;
        }
        
        agents.forEach(agent => {
            const agentDiv = document.createElement('div');
            agentDiv.className = `agent-item ${agent.id === currentAgentId ? 'active' : ''}`;
            agentDiv.innerHTML = `
                <i class="bi bi-person-workspace"></i>
                <span>${agent.name}</span>
                <small class="badge ${agent.status === 'active' ? 'bg-success' : 'bg-secondary'}">${agent.status}</small>
            `;
            agentDiv.addEventListener('click', () => {
                window.location.href = `agent_chat.html?id=${agent.id}`;
            });
            agentsList.appendChild(agentDiv);
        });
    }
    
    function displayToolIcons(tools) {
        if (!toolsBar) {
            console.error("Tools bar element not found");
            return;
        }
        
        // Clear both sidebar tools bar and header tools bar
        toolsBar.innerHTML = '<div class="mb-2">Click on a tool to use it</div>';
        
        // Also populate the header tools bar if it exists
        const headerToolsBar = document.getElementById('header-tools-bar');
        if (headerToolsBar) {
            headerToolsBar.innerHTML = '';
        }
        
        // Tool icons with colors
        const iconMap = {
            'Web Search': { icon: 'bi-search', color: 'primary' },
            'Code Analysis': { icon: 'bi-code-square', color: 'success' },
            'Text Processing': { icon: 'bi-file-text', color: 'info' },
            'Database': { icon: 'bi-database', color: 'warning' },
            'File System': { icon: 'bi-folder', color: 'danger' },
            'API': { icon: 'bi-cloud', color: 'primary' },
            'Calculator': { icon: 'bi-calculator', color: 'success' },
            'Weather': { icon: 'bi-cloud-sun', color: 'info' },
            'Translation': { icon: 'bi-translate', color: 'warning' }
        };
        
        tools.forEach(tool => {
            // Create tool div for sidebar
            const toolDiv = document.createElement('div');
            toolDiv.className = 'tool-icon';
            
            // Choose icon and color based on tool name or default
            const iconInfo = iconMap[tool.name] || { icon: 'bi-tools', color: 'secondary' };
            
            toolDiv.innerHTML = `
                <i class="bi ${iconInfo.icon} text-${iconInfo.color}"></i>
                <span>${tool.name}</span>
            `;
            
            // Add click handler to open modal with tool details
            toolDiv.addEventListener('click', () => {
                showToolModal(tool);
            });
            
            toolsBar.appendChild(toolDiv);
            
            // Also add to header tools bar if it exists
            if (headerToolsBar) {
                const headerToolButton = document.createElement('button');
                headerToolButton.className = `btn btn-icon btn-sm tool-header-icon`;
                headerToolButton.title = tool.name;
                headerToolButton.innerHTML = `<i class="bi ${iconInfo.icon} text-${iconInfo.color}"></i>`;
                
                headerToolButton.addEventListener('click', () => {
                    showToolModal(tool);
                });
                
                headerToolsBar.appendChild(headerToolButton);
            }
        });
    }
    
    // Tool modal handlers
    function showToolModal(tool) {
        selectedToolId = tool.id;
        toolModalLabel.textContent = tool.name;
        
        toolModalBody.innerHTML = `
            <div class="tool-details">
                <div class="tool-description">
                    <strong>Description:</strong>
                    <p>${tool.description}</p>
                </div>
                <div class="tool-endpoint">
                    <strong>API Endpoint:</strong>
                    <code>${tool.api_endpoint}</code>
                </div>
                <div class="tool-params">
                    <strong>Usage Example:</strong>
                    <p>Would you please use the ${tool.name} tool to help me with my task?</p>
                </div>
            </div>
        `;
        
        toolModal.show();
    }
    
    // Use tool button handler
    if (useToolButton) {
        useToolButton.addEventListener('click', () => {
            const selectedTool = availableTools.find(tool => tool.id === selectedToolId);
            if (selectedTool) {
                const prompt = `Please use the ${selectedTool.name} tool to help me with my task.`;
                messageInput.value = prompt;
                messageInput.focus();
                
                // Auto-adjust height
                messageInput.style.height = 'auto';
                messageInput.style.height = messageInput.scrollHeight + 'px';
                
                // Close the modal
                toolModal.hide();
            }
        });
    }
    
    // --- Context and Reasoning Display ---
    function updateContextChain(nodes) {
        // Get the content container
        const contextChainContent = document.getElementById('context-chain-content');
        if (!contextChainContent) return;
        
        // If nodes is not provided or empty, add a default message
        if (!nodes || nodes.length === 0) {
            contextChainContent.innerHTML = `
                <div class="text-center text-muted my-3">
                    <i class="bi bi-info-circle"></i>
                    <p>Context information will appear here during the conversation.</p>
                </div>
            `;
            return;
        }
        
        // Clear existing content
        contextChainContent.innerHTML = '';
        
        // Create a container for horizontal scrolling
        const nodesContainer = document.createElement('div');
        nodesContainer.className = 'context-nodes-container d-flex gap-2 overflow-auto pb-2';
        
        nodes.forEach((node, index) => {
            const nodeDiv = document.createElement('div');
            nodeDiv.className = 'context-node';
            
            // Determine appropriate icon based on node type
            let icon = 'bi-circle';
            if (node.type.toLowerCase().includes('user')) {
                icon = 'bi-person';
            } else if (node.type.toLowerCase().includes('agent')) {
                icon = 'bi-robot';
            } else if (node.type.toLowerCase().includes('tool')) {
                icon = 'bi-tools';
            } else if (node.type.toLowerCase().includes('memory')) {
                icon = 'bi-database';
            } else if (node.type.toLowerCase().includes('context')) {
                icon = 'bi-layers';
            }
            
            nodeDiv.innerHTML = `
                <i class="bi ${icon}"></i>
                <span>${node.type}</span>
                <div class="context-node-tooltip">${node.content.substring(0, 100)}${node.content.length > 100 ? '...' : ''}</div>
            `;
            
            // Add click handler to show full content
            nodeDiv.addEventListener('click', () => {
                // Get the reasoning steps content container
                const reasoningStepsContent = document.getElementById('reasoning-steps-content');
                if (reasoningStepsContent) {
                    // Update reasoning steps with this context
                    reasoningStepsContent.innerHTML = `
                        <div class="context-detail p-3">
                            <h6>${node.type}</h6>
                            <p>${node.content}</p>
                        </div>
                    `;
                    
                    // Make sure reasoning steps section is visible
                    const reasoningStepsSection = document.getElementById('reasoning-steps');
                    if (reasoningStepsSection.classList.contains('collapsed')) {
                        const toggleBtn = reasoningStepsSection.querySelector('.toggle-section');
                        if (toggleBtn) toggleBtn.click();
                    }
                    
                    // If reasoning steps section is hidden by the header toggle, show it
                    if (reasoningStepsSection.classList.contains('d-none')) {
                        const headerToggleBtn = document.getElementById('toggle-reasoning');
                        if (headerToggleBtn) headerToggleBtn.click();
                    }
                }
                
                // Mark this node as active and others as inactive
                document.querySelectorAll('.context-node').forEach(n => n.classList.remove('active'));
                nodeDiv.classList.add('active');
            });
            
            nodesContainer.appendChild(nodeDiv);
        });
        
        contextChainContent.appendChild(nodesContainer);
        
        // Auto-scroll to the end of the context chain
        setTimeout(() => {
            nodesContainer.scrollLeft = nodesContainer.scrollWidth;
        }, 100);
    }
    
    function addReasoningStep(step) {
        // Get the reasoning steps content container
        const reasoningStepsContent = document.getElementById('reasoning-steps-content');
        if (!reasoningStepsContent) return;
        
        const stepDiv = document.createElement('div');
        stepDiv.className = 'reasoning-step';
        stepDiv.innerHTML = `
            <small class="text-muted">Step ${step.step_number}</small>
            <p>${step.content}</p>
        `;
        reasoningStepsContent.appendChild(stepDiv);
        
        // Make sure reasoning steps section is visible
        const reasoningStepsSection = document.getElementById('reasoning-steps');
        if (reasoningStepsSection.classList.contains('collapsed')) {
            const toggleBtn = reasoningStepsSection.querySelector('.toggle-section');
            if (toggleBtn) toggleBtn.click();
        }
        
        // If reasoning steps section is hidden by the header toggle, show it
        if (reasoningStepsSection.classList.contains('d-none')) {
            const headerToggleBtn = document.getElementById('toggle-reasoning');
            if (headerToggleBtn) headerToggleBtn.click();
        }
        
        // Show the context panel if it's collapsed
        if (contextPanel.classList.contains('collapsed')) {
            toggleContextPanel();
        }
    }
    
    function addToolUsage(usage) {
        // Get the tool usage content container
        const toolUsageContent = document.getElementById('tool-usage-content');
        if (!toolUsageContent) return;
        
        const usageDiv = document.createElement('div');
        usageDiv.className = 'tool-usage-item';
        usageDiv.innerHTML = `
            <small class="text-muted">${usage.tool_name}</small>
            <p>Input: ${usage.input_data}</p>
            <p>Output: ${usage.output_data}</p>
        `;
        toolUsageContent.appendChild(usageDiv);
        
        // Make sure tool usage section is visible
        const toolUsageSection = document.getElementById('tool-usage');
        if (toolUsageSection.classList.contains('collapsed')) {
            const toggleBtn = toolUsageSection.querySelector('.toggle-section');
            if (toggleBtn) toggleBtn.click();
        }
        
        // If tool usage section is hidden by the header toggle, show it
        if (toolUsageSection.classList.contains('d-none')) {
            const headerToggleBtn = document.getElementById('toggle-tools');
            if (headerToggleBtn) headerToggleBtn.click();
        }
        
        // Show the context panel if it's collapsed
        if (contextPanel.classList.contains('collapsed')) {
            toggleContextPanel();
        }
    }
    
    // Add tool usage to UI after agent uses a tool
    function handleToolUsageInMessage(message) {
        // Check if message contains tool usage indicators
        if (message.includes('Using tool:') || message.includes('Tool used:')) {
            // Try to extract tool name and usage
            const toolMatch = message.match(/Using tool: ([^\.]+)/) || 
                              message.match(/Tool used: ([^\.]+)/);
            
            if (toolMatch) {
                const toolName = toolMatch[1].trim();
                
                // Look for tool in available tools
                const tool = availableTools.find(t => 
                    t.name.toLowerCase() === toolName.toLowerCase());
                
                if (tool) {
                    // Extract input/output if possible
                    let inputData = "Not specified";
                    let outputData = "Not specified";
                    
                    const inputMatch = message.match(/Input: ([^\n]+)/);
                    if (inputMatch) inputData = inputMatch[1].trim();
                    
                    const outputMatch = message.match(/Output: ([^\n]+)/) || 
                                        message.match(/Result: ([^\n]+)/);
                    if (outputMatch) outputData = outputMatch[1].trim();
                    
                    // Add to tool usage panel
                    addToolUsage({
                        tool_name: tool.name,
                        input_data: inputData,
                        output_data: outputData
                    });
                }
            }
        }
    }
    
    // Extract reasoning steps from message
    function extractAndDisplayReasoningSteps(message) {
        // Get the reasoning steps content container
        const reasoningStepsContent = document.getElementById('reasoning-steps-content');
        if (!reasoningStepsContent) return;
        
        // Clear existing steps
        reasoningStepsContent.innerHTML = '';
        
        // Look for numbered steps
        const steps = message.match(/Step \d+:([^\n]+)/g) || 
                     message.match(/\d+\.\s+([^\n]+)/g);
        
        if (steps && steps.length > 0) {
            steps.forEach((step, index) => {
                const stepContent = step.replace(/Step \d+:/, '').replace(/\d+\.\s+/, '').trim();
                addReasoningStep({
                    step_number: index + 1,
                    content: stepContent
                });
            });
        } else {
            // Try to identify steps by keywords
            const sentences = message.split(/\.\s+/);
            if (sentences.length >= 3) {
                const keywordIndicators = [
                    'first', 'second', 'third', 'next', 'then', 'finally',
                    'initially', 'after that', 'lastly'
                ];
                
                let stepNumber = 1;
                sentences.forEach(sentence => {
                    const lowerSentence = sentence.toLowerCase();
                    if (keywordIndicators.some(kw => lowerSentence.includes(kw)) || 
                        stepNumber <= 3) { // Include first few sentences as potential steps
                        addReasoningStep({
                            step_number: stepNumber++,
                            content: sentence.trim()
                        });
                    }
                });
            }
        }
    }
    
    // --- WebSocket Connection ---
    function setupWebSocket() {
        if (!currentAgentId) {
            console.log("No agent ID specified, skipping WebSocket setup");
            addSystemMessage("No agent selected. Select an agent or try refreshing the page.", "warning");
            return;
        }
        
        cleanupWebSocket();
        
        try {
            // Increment connection attempts before attempting connection
            wsConnectionAttempts++;
            
            const wsUrl = `${API_CONFIG.WS_URL}/ws/${currentAgentId}`;
            console.log(`Setting up WebSocket connection to ${wsUrl} (Attempt ${wsConnectionAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
            
            // Add a message to the UI to show connection attempt
            if (wsConnectionAttempts > 1) {
                addSystemMessage(`Attempting to connect... (${wsConnectionAttempts}/${MAX_RECONNECT_ATTEMPTS})`, "info");
            }
            
            ws = new WebSocket(wsUrl);
            
            // Set timeout to handle connection timeout
            const connectionTimeout = setTimeout(() => {
                if (ws && ws.readyState !== WebSocket.OPEN) {
                    console.log("WebSocket connection timeout");
                    ws.close();
                }
            }, 10000); // 10 second timeout
            
            ws.onopen = () => {
                console.log("WebSocket connection established");
                clearTimeout(connectionTimeout);
                wsConnectionAttempts = 0;
                clearTimeout(wsReconnectTimer);
                addSystemMessage("Realtime connection established", "success");
                
                // Enable the send button once connection is established
                if (sendButton) {
                    sendButton.disabled = false;
                }
            };
            
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log("WebSocket message received:", data);
                    
                    // More verbose logging to debug exact message structure
                    console.log("Message type:", data.type);
                    console.log("Message content:", data.content);
                    console.log("Message sender:", data.sender);
                    
                    if (data.type === 'message' && data.sender === 'agent') {
                        // Handle agent message
                        console.log("Received agent message");
                        
                        // Check if message contains tool usage
                        if (data.tool_usage) {
                            handleToolUsageInMessage(data);
                        }
                        
                        // Check for reasoning steps
                        if (data.reasoning_steps && data.reasoning_steps.length > 0) {
                            data.reasoning_steps.forEach(step => addReasoningStep(step));
                        }
                        
                        // Handle context chain
                        if (data.context_chain) {
                            updateContextChain(data.context_chain);
                        }
                        
                        addAgentMessage(data.content);
                    } else if (data.type === 'system') {
                        // Handle system message
                        console.log("Received system message:", data.content);
                        addSystemMessage(data.content, data.message_type || 'info');
                    } else if (data.type === 'thinking') {
                        // Show thinking indicator
                        console.log("Agent is thinking...");
                    } else if (data.type === 'error') {
                        handleWebSocketError(data);
                    } else {
                        // Fallback for any other message type
                        console.log("Received unknown message type:", data.type);
                        if (data.content) {
                            addAgentMessage(data.content);
                        }
                    }
                } catch (error) {
                    console.error("Error processing WebSocket message:", error, event.data);
                }
            };
            
            ws.onclose = (event) => {
                clearTimeout(connectionTimeout);
                console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
                ws = null;
                
                // If the close wasn't initiated by the user and we haven't exceeded max attempts
                if (wsConnectionAttempts < MAX_RECONNECT_ATTEMPTS) {
                    scheduleReconnect();
                } else if (wsConnectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
                    addSystemMessage(`Could not establish connection to the backend server. Please check if the server is running on port ${API_CONFIG.WS_URL.split(':')[2] || 8080}.`, "error");
                    console.log("Max reconnection attempts reached, giving up.");
                }
            };
            
            ws.onerror = (error) => {
                clearTimeout(connectionTimeout);
                console.error("WebSocket error:", error);
                
                // Do not show error message for each attempt to avoid spamming the UI
                if (wsConnectionAttempts <= 1) {
                    addSystemMessage("Connection error. Please make sure the backend server is running.", "warning");
                }
                
                // The onclose handler will be called after this
            };
        } catch (error) {
            console.error("Error setting up WebSocket:", error);
            addSystemMessage("Failed to establish connection to the backend server.", "error");
        }
    }
    
    function handleWebSocketError(data) {
        const errorMessage = data.content || "An unknown error occurred";
        console.error("WebSocket error message:", errorMessage);
        addSystemMessage(errorMessage, "error");
    }
    
    function scheduleReconnect() {
        // Clear any existing reconnect timer
        if (wsReconnectTimer) {
            clearTimeout(wsReconnectTimer);
        }
        
        // Increase backoff time based on attempts (capped at 10 seconds)
        const backoffTime = Math.min(1000 * Math.pow(1.5, wsConnectionAttempts), 10000);
        
        // Only schedule if page is visible and we haven't exceeded maximum attempts
        if (document.visibilityState === 'visible' && wsConnectionAttempts < MAX_RECONNECT_ATTEMPTS) {
            wsReconnectTimer = setTimeout(() => {
                if (document.visibilityState === 'visible') {
                    setupWebSocket();
                }
            }, backoffTime);
            
            console.log(`Scheduled reconnect in ${backoffTime}ms (attempt ${wsConnectionAttempts})`);
        }
    }
    
    function cleanupWebSocket() {
        // Clear any pending reconnect
        if (wsReconnectTimer) {
            clearTimeout(wsReconnectTimer);
            wsReconnectTimer = null;
        }
        
        // Close existing WebSocket connection properly
        if (ws) {
            // Remove all listeners to prevent memory leaks
            ws.onopen = null;
            ws.onmessage = null;
            ws.onclose = null;
            ws.onerror = null;
            
            // Check if connection is still open before closing
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                try {
                    ws.close(1000, "Client disconnecting");
                } catch (error) {
                    console.error("Error closing WebSocket:", error);
                }
            }
            
            ws = null;
        }
    }
    
    // --- Message Handling ---
    async function sendMessage(message) {
        if (!message.trim() || isProcessing) return;
        
        // Clear input right away to prevent duplicate sends
        const messageText = message.trim();
        messageInput.value = '';
        messageInput.style.height = 'auto';
        
        isProcessing = true;
        messageInput.disabled = true;
        sendButton.disabled = true;
        sendButton.innerHTML = '<div class="spinner"></div>';
        
        // Add user message to UI immediately
        addUserMessage(messageText);
        
        // Check if WebSocket is connected - use that if possible
        if (ws && ws.readyState === WebSocket.OPEN) {
            console.log("Sending message via WebSocket");
            try {
                // Send via WebSocket
                ws.send(JSON.stringify({
                    type: 'message',
                    content: messageText,
                    agent_id: currentAgentId,
                    sender: 'user',
                    model: currentModel
                }));
                
                // Add a small delay to simulate thinking
                setTimeout(() => {
                    // No need to re-enable input immediately, it will be enabled when the response is received
                    sendButton.innerHTML = '<i class="bi bi-send-fill"></i>';
                }, 500);
                
                // Note: We're not setting isProcessing = false here because we're
                // waiting for the response via WebSocket
                
                return; // Exit early if sent via WebSocket
            } catch (wsError) {
                console.error("WebSocket send error:", wsError);
                // Fall back to REST API below if WebSocket fails
            }
        }
        
        // If WebSocket is not available or fails, use REST API
        console.log("Using REST API fallback");
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/agents/${currentAgentId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    agent_id: currentAgentId,
                    content: messageText,
                    sender: 'user',
                    model: currentModel
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }
            
            // Process the response
            const data = await response.json();
            console.log("REST API response:", data);
            
            // Display reasoning steps if present
            if (data.reasoning_steps && data.reasoning_steps.length > 0) {
                data.reasoning_steps.forEach(step => addReasoningStep(step));
            }
            
            // Check if the response contains tool usage
            if (data.tool_usage) {
                addToolUsage(data.tool_usage);
            }
            
            // Add agent response to chat
            addAgentMessage(data.content);
            
        } catch (error) {
            console.error("Error sending message:", error);
            addSystemMessage(`Failed to send message: ${error.message}. Please try again.`, "error");
        } finally {
            isProcessing = false;
            messageInput.disabled = false;
            sendButton.disabled = false;
            sendButton.innerHTML = '<i class="bi bi-send-fill"></i>';
        }
    }
    
    async function resetChat() {
        // Clear UI
        chatMessages.innerHTML = '';
        messageInput.value = '';
        contextChain.innerHTML = '<h6 class="section-title">Context Chain</h6>';
        reasoningSteps.innerHTML = '<h6 class="section-title">Reasoning Steps</h6>';
        toolUsage.innerHTML = '<h6 class="section-title">Tool Usage</h6>';
        
        // Add system message
        addSystemMessage('Starting new chat session...');
        
        try {
            // Reset conversation with the agent via REST API
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/agents/${currentAgentId}/reset`, {
                method: 'POST'
            });
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            addSystemMessage('Chat has been reset. You can start a new conversation.');
            
            // Focus input
            messageInput.focus();
            
        } catch (error) {
            console.error('Error resetting chat:', error);
            showError('chat-messages', `Failed to reset chat: ${error.message}`);
        }
    }
    
    // Enable input initially
    if (messageInput) {
        messageInput.disabled = false;
    }
    
    // Start with enabled send button for better UX
    if (sendButton) {
        sendButton.disabled = false;
    }
    
    // Initialize event listener for input to adjust height
    if (messageInput) {
        messageInput.addEventListener('input', function() {
            // Auto-adjust height
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }
    
    // Add default welcome message
    addSystemMessage("Welcome to Agent Chat! You can type a message below to start a conversation.", "info");
    
    // --- Event Listeners ---
    if (sendButton) {
        sendButton.addEventListener('click', () => {
            // Only send if there's content
            if (messageInput.value.trim()) {
                sendMessage(messageInput.value);
            }
        });
    }
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && messageInput.value.trim()) {
                e.preventDefault();
                sendMessage(messageInput.value);
            }
        });
    }
    
    if (newChatBtn) {
        newChatBtn.addEventListener('click', resetChat);
    }
    
    if (newChatHeaderBtn) {
        newChatHeaderBtn.addEventListener('click', resetChat);
    }
    
    // Initialize when DOM content loaded
    if (!API_CONFIG || !API_CONFIG.BASE_URL) {
        showError('API configuration is missing. Please check your setup.');
        return;
    }
    
    // Initialize UI components
    initializeTheme();
    initModelSelector();
    
    // Set up theme toggle listeners
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    if (sidebarThemeToggler) {
        sidebarThemeToggler.addEventListener('click', toggleTheme);
    }
    
    // Load initial data and set up connections
    loadInitialData().catch(error => {
        console.error("Failed to initialize:", error);
        addSystemMessage("Failed to initialize chat. Please try refreshing the page.", "error");
    });
    
    // --- Data Loading ---
    async function loadInitialData() {
        try {
            console.log("Loading initial data...");
            addSystemMessage("Connecting to backend...", "info");
            
            // Check if the API_CONFIG is properly set
            if (!API_CONFIG || !API_CONFIG.BASE_URL) {
                throw new Error("API configuration is missing or invalid. Check if base.js is loaded correctly.");
            }
            
            console.log("Using API config:", API_CONFIG);
            
            // Check backend connectivity first
            try {
                const pingResponse = await fetch(`${API_CONFIG.BASE_URL}/api/agents`, {
                    method: 'HEAD',
                    headers: { 'Accept': 'application/json' },
                    mode: 'cors',
                    cache: 'no-cache'
                });
                
                if (!pingResponse.ok) {
                    const statusMessage = pingResponse.status === 404 ? 'API endpoint not found' : 
                                         pingResponse.status === 500 ? 'Server error' :
                                         `Error code: ${pingResponse.status}`;
                    
                    addSystemMessage(`Backend connection issue: ${statusMessage}. Using offline mode with simulated data.`, "warning");
                    console.warn(`Backend connectivity check failed: ${pingResponse.status} ${pingResponse.statusText}`);
                    
                    // Load default/simulated data
                    loadSimulatedData();
                    return;
                }
            } catch (connectionError) {
                console.error("Backend connectivity check failed:", connectionError);
                addSystemMessage(`Cannot connect to backend at ${API_CONFIG.BASE_URL}. Check if the server is running. Using offline mode.`, "error");
                
                // Load default/simulated data
                loadSimulatedData();
                return;
            }
            
            // Load agents
            let agents = [];
            try {
                console.log("Fetching agents from:", `${API_CONFIG.BASE_URL}/api/agents`);
                const agentsResponse = await fetch(`${API_CONFIG.BASE_URL}/api/agents`, {
                    headers: { 'Accept': 'application/json' },
                    mode: 'cors',
                    cache: 'no-cache'
                });
                
                if (!agentsResponse.ok) {
                    throw new Error(`Error fetching agents: ${agentsResponse.status} ${agentsResponse.statusText}`);
                }
                
                agents = await agentsResponse.json();
                console.log("Agents loaded:", agents);
                activeAgents = agents;
                displayAgents(agents);
            } catch (error) {
                console.error("Error loading agents:", error);
                addSystemMessage(`Could not load agents. Backend server may be down or inaccessible. Using default agents instead.`, "warning");
                
                // Add default agents for UI testing
                const defaultAgents = [
                    { id: '1', name: 'Assistant', status: 'active', description: 'General purpose assistant' },
                    { id: '2', name: 'Researcher', status: 'active', description: 'Specialized in research tasks' },
                    { id: '3', name: 'Coder', status: 'idle', description: 'Programming and code analysis' }
                ];
                
                activeAgents = defaultAgents;
                displayAgents(defaultAgents);
                // Don't return, continue loading other components
            }
            
            // Load tools
            try {
                console.log("Fetching tools from:", `${API_CONFIG.BASE_URL}/api/tools`);
                const toolsResponse = await fetch(`${API_CONFIG.BASE_URL}/api/tools`, {
                    headers: { 'Accept': 'application/json' },
                    mode: 'cors',
                    cache: 'no-cache'
                });
                
                if (!toolsResponse.ok) {
                    throw new Error(`Error fetching tools: ${toolsResponse.status} ${toolsResponse.statusText}`);
                }
                
                const tools = await toolsResponse.json();
                console.log("Tools loaded:", tools);
                availableTools = tools;
                displayToolIcons(tools);
            } catch (error) {
                console.error("Error loading tools:", error);
                addSystemMessage(`Could not load tools. Using default tools instead.`, "warning");
                
                // Add default tools for UI testing
                const defaultTools = [
                    { id: '1', name: 'Web Search', description: 'Search the web for information', api_endpoint: '/api/tools/search' },
                    { id: '2', name: 'Calculator', description: 'Perform calculations', api_endpoint: '/api/tools/calculator' },
                    { id: '3', name: 'Code Analysis', description: 'Analyze code and provide suggestions', api_endpoint: '/api/tools/code' },
                    { id: '4', name: 'Weather', description: 'Get weather information', api_endpoint: '/api/tools/weather' }
                ];
                
                availableTools = defaultTools;
                displayToolIcons(defaultTools);
                // Continue anyway as this is not critical
            }
            
            // Load previous messages if an agent is selected
            if (currentAgentId) {
                console.log("Fetching messages for agent:", currentAgentId);
                try {
                    const messagesResponse = await fetch(`${API_CONFIG.BASE_URL}/api/agents/${currentAgentId}/messages`, {
                        headers: { 'Accept': 'application/json' },
                        mode: 'cors',
                        cache: 'no-cache'
                    });
                    
                    if (messagesResponse.ok) {
                        const messages = await messagesResponse.json();
                        
                        // Clear existing messages
                        chatMessages.innerHTML = '';
                        
                        // Display messages in order
                        messages.forEach(msg => {
                            if (msg.sender === 'user') {
                                addUserMessage(msg.content);
                            } else {
                                addAgentMessage(msg.content, "AI");
                            }
                        });
                        
                        // Set current agent name
                        const currentAgent = activeAgents.find(a => a.id === currentAgentId);
                        if (currentAgent) {
                            currentAgentName.textContent = currentAgent.name;
                        }
                    } else {
                        // If we can't load messages, just show a welcome message
                        console.warn(`Failed to load messages: ${messagesResponse.status} ${messagesResponse.statusText}`);
                        addSystemMessage(`Connected to agent. Start a conversation!`);
                    }
                } catch (error) {
                    console.error("Error loading messages:", error);
                    addSystemMessage(`Could not load previous messages. Starting new conversation.`, "warning");
                }
                
                // Setup WebSocket for real-time updates
                setupWebSocket();
            } else {
                // No agent selected, show welcome message
                addSystemMessage("Select an agent from the sidebar to start chatting");
            }
        } catch (error) {
            console.error("Error loading initial data:", error);
            addSystemMessage(`Could not load necessary data: ${error.message}. Please check if the backend server is running.`, "error");
        }
    }
    
    // Function to load simulated data when backend is unavailable
    function loadSimulatedData() {
        console.log("Loading simulated data for offline mode");
        
        // Add default agents
        const defaultAgents = [
            { id: '1', name: 'Assistant', status: 'active', description: 'General purpose assistant' },
            { id: '2', name: 'Researcher', status: 'active', description: 'Specialized in research tasks' },
            { id: '3', name: 'Coder', status: 'idle', description: 'Programming and code analysis' }
        ];
        
        activeAgents = defaultAgents;
        displayAgents(defaultAgents);
        
        // Add default tools
        const defaultTools = [
            { id: '1', name: 'Web Search', description: 'Search the web for information', api_endpoint: '/api/tools/search' },
            { id: '2', name: 'Calculator', description: 'Perform calculations', api_endpoint: '/api/tools/calculator' },
            { id: '3', name: 'Code Analysis', description: 'Analyze code and provide suggestions', api_endpoint: '/api/tools/code' },
            { id: '4', name: 'Weather', description: 'Get weather information', api_endpoint: '/api/tools/weather' }
        ];
        
        availableTools = defaultTools;
        displayToolIcons(defaultTools);
        
        // Add offline notice for current agent
        if (currentAgentId) {
            const currentAgent = defaultAgents.find(a => a.id === currentAgentId);
            if (currentAgent) {
                currentAgentName.textContent = `${currentAgent.name} (Offline)`;
            }
            
            addSystemMessage("Backend server is offline. Chat functionality will be limited.", "warning");
        } else {
            addSystemMessage("Backend server is offline. Select an agent to continue in limited offline mode.", "warning");
        }
    }

    // Initialize context panel functionality
    function initializeContextPanel() {
        const contextPanel = document.getElementById('context-panel');
        const contextChainSection = document.getElementById('context-chain');
        const reasoningStepsSection = document.getElementById('reasoning-steps');
        const toolUsageSection = document.getElementById('tool-usage');
        const contextResizeHandle = document.getElementById('context-resize-handle');
        const contextMinimizeBtn = document.getElementById('context-minimize');
        
        // Toggle individual sections
        document.querySelectorAll('.toggle-section').forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.getAttribute('data-target');
                const targetContent = document.getElementById(targetId);
                const parentSection = button.closest('.context-section');
                
                if (parentSection) {
                    parentSection.classList.toggle('collapsed');
                    const isCollapsed = parentSection.classList.contains('collapsed');
                    
                    // Update icon
                    const icon = button.querySelector('i');
                    if (icon) {
                        icon.className = isCollapsed ? 'bi bi-chevron-down' : 'bi bi-chevron-up';
                    }
                }
            });
        });
        
        // Section toggle buttons in header
        document.getElementById('toggle-context-chain').addEventListener('click', (e) => {
            e.target.closest('button').classList.toggle('active');
            contextChainSection.classList.toggle('d-none');
        });
        
        document.getElementById('toggle-reasoning').addEventListener('click', (e) => {
            e.target.closest('button').classList.toggle('active');
            reasoningStepsSection.classList.toggle('d-none');
        });
        
        document.getElementById('toggle-tools').addEventListener('click', (e) => {
            e.target.closest('button').classList.toggle('active');
            toolUsageSection.classList.toggle('d-none');
        });
        
        // Minimize/Maximize button
        if (contextMinimizeBtn) {
            contextMinimizeBtn.addEventListener('click', () => {
                contextPanel.classList.toggle('minimized');
                
                // Update button icon and title
                const isMinimized = contextPanel.classList.contains('minimized');
                contextMinimizeBtn.innerHTML = isMinimized 
                    ? '<i class="bi bi-arrows-angle-expand"></i>' 
                    : '<i class="bi bi-arrows-angle-contract"></i>';
                contextMinimizeBtn.title = isMinimized ? 'Maximize panel' : 'Minimize panel';
            });
        }
        
        // Resize functionality (basic)
        if (contextResizeHandle) {
            let startX, startWidth;
            
            contextResizeHandle.addEventListener('mousedown', (e) => {
                startX = e.clientX;
                startWidth = parseInt(document.defaultView.getComputedStyle(contextPanel).width, 10);
                document.documentElement.style.cursor = 'ew-resize';
                
                // Add event listeners for dragging
                document.addEventListener('mousemove', resize);
                document.addEventListener('mouseup', stopResize);
                
                // Prevent text selection during resize
                e.preventDefault();
            });
            
            function resize(e) {
                const width = startWidth - (e.clientX - startX);
                if (width > 250 && width < 600) {
                    contextPanel.style.width = `${width}px`;
                }
            }
            
            function stopResize() {
                document.documentElement.style.cursor = '';
                document.removeEventListener('mousemove', resize);
                document.removeEventListener('mouseup', stopResize);
            }
        }
    }
});