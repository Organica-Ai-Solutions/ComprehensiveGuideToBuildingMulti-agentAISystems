// Agent Chat Page JavaScript
// Import manager agent functionality
import { 
    routeToAgent, 
    validateToolUse, 
    handoffToAgent, 
    checkMessageSafety,
    validateResponse 
} from './agents/manager.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Agent Chat page loaded");
    
    // --- API Configuration ---
    // Determine protocol (http vs https) and corresponding WS protocol (ws vs wss)
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const hostname = '127.0.0.1';  // Force IPv4 localhost
    const port = '8000'; // Backend server port
    
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
    
    // Default fetch options for all API calls
    const defaultFetchOptions = {
        mode: 'cors',
        cache: 'no-cache',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        credentials: 'include'
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
    let ws;
    let wsReconnectAttempts = 0;
    const MAX_WS_RECONNECT_ATTEMPTS = 5;
    const WS_RECONNECT_DELAY = 2000;
    
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
        const sidebar = document.getElementById('sidebar');
        const chatLayout = document.querySelector('.chat-layout');
        
        if (!sidebar || !chatLayout) return;
        
        sidebar.classList.toggle('collapsed');
        
        if (sidebar.classList.contains('collapsed')) {
            chatLayout.classList.remove('show-sidebar');
        } else {
            chatLayout.classList.add('show-sidebar');
        }
    }
    
    function toggleContextPanel() {
        // Get required elements
        const contextPanel = document.getElementById('context-panel');
        const chatLayout = document.querySelector('.chat-layout');
        const contextToggleBtn = document.getElementById('context-toggle-btn');
        
        if (!contextPanel || !chatLayout || !contextToggleBtn) {
            console.error('Missing required elements for context panel toggle');
            return;
        }
        
        // Simple direct toggle implementation
        if (contextPanel.classList.contains('collapsed')) {
            // Open the panel
            contextPanel.classList.remove('collapsed');
            chatLayout.classList.add('show-context');
            contextToggleBtn.innerHTML = '<i class="bi bi-layout-sidebar-inset-reverse"></i>';
        } else {
            // Close the panel
            contextPanel.classList.add('collapsed');
            chatLayout.classList.remove('show-context');
            contextToggleBtn.innerHTML = '<i class="bi bi-layout-sidebar-reverse"></i>';
        }
    }
    
    // Initialize event listeners
    document.addEventListener('DOMContentLoaded', () => {
        // Set up sidebar toggle
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebarClose = document.getElementById('sidebar-close');
        
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', toggleSidebar);
        }
        
        if (sidebarClose) {
            sidebarClose.addEventListener('click', toggleSidebar);
        }
        
        // Set up context panel toggle button
        const contextToggleBtn = document.getElementById('context-toggle-btn');
        if (contextToggleBtn) {
            contextToggleBtn.addEventListener('click', function(e) {
                e.preventDefault();
                toggleContextPanel();
            });
        }
        
        // Set up context panel close button
        const contextClose = document.getElementById('context-close');
        if (contextClose) {
            contextClose.addEventListener('click', function(e) {
                e.preventDefault();
                toggleContextPanel();
            });
        }
        
        // Call updateToolUsage to add direct handlers
        const toolUsageItems = document.querySelectorAll('.tool-usage-item');
        toolUsageItems.forEach(item => {
            item.addEventListener('click', function() {
                // Make sure context panel is open when clicking on a tool
                const contextPanel = document.getElementById('context-panel');
                if (contextPanel && contextPanel.classList.contains('collapsed')) {
                    toggleContextPanel();
                }
            });
        });
    });
    
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
    
    // --- WebSocket Connection Management ---
    function setupWebSocket() {
        if (!currentAgentId) {
            console.warn('No agent ID specified for WebSocket connection');
            return;
        }

        // Clean up existing connection if any
        if (ws) {
            console.log('Closing existing WebSocket connection');
            ws.close();
            ws = null;
        }

        const wsUrl = `${API_CONFIG.WS_URL}/ws/${currentAgentId}`;
        console.log('Setting up WebSocket connection:', wsUrl);

        try {
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('WebSocket connection established');
                wsReconnectAttempts = 0;
                
                // Only show connection message on first connection or after disconnection
                if (!hasInitialConnection || wsReconnectAttempts > 0) {
                    addSystemMessage('Connected to agent', 'success');
                    hasInitialConnection = true;
                }
            };

            ws.onclose = (event) => {
                console.log('WebSocket connection closed:', event.code, event.reason);
                hideThinkingIndicator();
                enableInput();
                
                if (wsReconnectAttempts < MAX_WS_RECONNECT_ATTEMPTS) {
                    wsReconnectAttempts++;
                    const delay = WS_RECONNECT_DELAY * Math.pow(2, wsReconnectAttempts - 1);
                    showConnectionStatus('reconnecting', delay);
                    
                    setTimeout(() => {
                        if (document.visibilityState === 'visible') {
                            setupWebSocket();
                        }
                    }, delay);
                } else {
                    showConnectionStatus('failed');
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                handleWebSocketError(error);
            };

            ws.onmessage = (event) => {
                console.log('Received WebSocket message:', event.data);
                try {
                    const message = JSON.parse(event.data);
                    handleWebSocketMessage(message);
                } catch (error) {
                    console.error('Error processing WebSocket message:', error);
                    addSystemMessage('Error processing message', 'error');
                }
            };

        } catch (error) {
            console.error('Error setting up WebSocket:', error);
            handleWebSocketError(error);
        }
    }

    function handleWebSocketError(error) {
        if (wsReconnectAttempts < MAX_WS_RECONNECT_ATTEMPTS) {
            // Error will trigger onclose which handles reconnection
            if (ws) ws.close();
        } else {
            addSystemMessage('Connection error. Please refresh the page.', 'error');
        }
    }

    function handleWebSocketMessage(message) {
        if (!message || !message.type) return;
        
        console.log('Processing message:', message);
        
        // Validate output with guardrails
        if (message.content && ['agent_message', 'system'].includes(message.type)) {
            const validationResult = validateResponse(message.content, currentAgentId);
            
            if (!validationResult.valid) {
                console.error('Invalid response:', validationResult.reason);
                addSystemMessage(`The agent response was invalid: ${validationResult.reason}`, 'error');
                isProcessing = false;
                enableInput();
                hideThinkingIndicator();
                return;
            }
        }
        
        // Handle tool requests
        if (message.content && message.content.toLowerCase().includes('please use the')) {
            const toolMatch = message.content.match(/please use the (.*?) tool/i);
            if (toolMatch) {
                const requestedTool = toolMatch[1];
                const tool = availableTools.find(t => 
                    t.name.toLowerCase() === requestedTool.toLowerCase());
                
                if (tool) {
                    addSystemMessage(`Using ${tool.name} tool...`, 'info');
                    // Send tool usage message
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'tool_request',
                            tool_id: tool.id,
                            content: message.content,
                            agent_id: currentAgentId,
                            timestamp: new Date().toISOString()
                        }));
                    }
                    return;
                }
            }
        }
        
        switch (message.type) {
            case 'agent_message':
                hideThinkingIndicator();
                // Only show default response if it's not following a tool request
                if (message.content === defaultAgentResponse && lastMessageWasDefault) {
                    console.log('Skipping duplicate default response');
                    return;
                }
                
                addAgentMessage(message.content, message.agent_name);
                lastMessageWasDefault = (message.content === defaultAgentResponse);
                break;
                
            case 'tool_response':
                hideThinkingIndicator();
                if (message.result) {
                    addSystemMessage(`Tool result: ${message.result}`, 'success');
                    updateToolUsage({
                        tool_name: message.tool_name,
                        input_data: message.input || 'Not specified',
                        output_data: message.result
                    });
                }
                break;
                
            case 'thinking':
                showThinkingIndicator();
                break;
                
            case 'error':
                hideThinkingIndicator();
                addSystemMessage(message.content, 'error');
                break;
                
            case 'system':
                // Skip initial connection message if we've already shown one
                if (message.content && message.content.includes('Connected') && hasInitialConnection) {
                    console.log('Skipping duplicate connection message');
                    return;
                }
                
                hideThinkingIndicator();
                addSystemMessage(message.content, message.status || 'info');
                break;
                
            case 'handoff':
                hideThinkingIndicator();
                addSystemMessage(`Transferring to ${message.to_agent_name}...`, 'info');
                
                // Update current agent ID and name
                currentAgentId = message.to_agent_id;
                if (currentAgentName) {
                    currentAgentName.textContent = message.to_agent_name;
                }
                
                // Reset connection state for new agent
                hasInitialConnection = false;
                wsReconnectAttempts = 0;
                
                // Set up new WebSocket connection
                setupWebSocket();
                break;
                
            case 'reasoning':
                if (message.steps && message.steps.length > 0) {
                    message.steps.forEach((step, index) => {
                        addReasoningStep({
                            step_number: index + 1,
                            content: step
                        });
                    });
                }
                break;
                
            default:
                console.warn('Unhandled message type:', message.type);
                break;
        }
        
        isProcessing = false;
        enableInput();
    }

    function updateToolUsage(toolData) {
        const toolUsageContent = document.getElementById('tool-usage-content');
        if (!toolUsageContent) return;
        
        // Remove empty state if present
        const emptyState = toolUsageContent.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
        
        // Create tool usage item
        const usageDiv = document.createElement('div');
        usageDiv.className = 'tool-usage-item';
        usageDiv.innerHTML = `
            <div class="tool-usage-header">
                <span class="tool-name">
                    <i class="bi bi-tools"></i>
                    ${toolData.tool_name}
                </span>
                <span class="timestamp">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="tool-usage-details">
                <div class="input-data">
                    <strong>Input:</strong>
                    <pre>${toolData.input_data}</pre>
                </div>
                <div class="output-data">
                    <strong>Output:</strong>
                    <pre>${toolData.output_data}</pre>
                </div>
            </div>
        `;
        
        toolUsageContent.appendChild(usageDiv);
        toolUsageContent.scrollTop = toolUsageContent.scrollHeight;
        
        // Directly open context panel using DOM manipulation
        const contextPanel = document.getElementById('context-panel');
        if (contextPanel && contextPanel.classList.contains('collapsed')) {
            toggleContextPanel();
        }
        
        // Add direct click handler
        usageDiv.addEventListener('click', function() {
            // Ensure context panel is open when clicking on a tool
            if (contextPanel && contextPanel.classList.contains('collapsed')) {
                toggleContextPanel();
            }
        });
    }

    // --- UI State Management ---
    function showThinkingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.innerHTML = `
                <div class="thinking">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
            `;
            typingIndicator.classList.remove('hidden');
        }
    }

    function hideThinkingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.classList.add('hidden');
        }
    }

    function showConnectionStatus(status, delay = null) {
        let message = '';
        let type = 'info';
        
        switch (status) {
            case 'connected':
                message = 'Connected to agent';
                type = 'success';
                break;
            case 'disconnected':
                message = 'Disconnected from agent';
                type = 'warning';
                break;
            case 'reconnecting':
                message = `Connection lost. Reconnecting in ${delay/1000}s...`;
                type = 'warning';
                break;
            case 'failed':
                message = 'Connection failed. Please refresh the page.';
                type = 'error';
                break;
            case 'error':
                message = 'Connection error occurred';
                type = 'error';
                break;
        }
        
        addSystemMessage(message, type);
    }

    function showError(message) {
        console.error('Error:', message);
        addSystemMessage(message, 'error');
    }

    function showToolUsage(tool, status, result = null) {
        const toolUsageContent = document.getElementById('tool-usage-content');
        if (!toolUsageContent) return;
        
        const timestamp = new Date().toLocaleTimeString();
        
        if (status === 'start') {
            const usageDiv = document.createElement('div');
            usageDiv.className = 'tool-usage-item';
            usageDiv.innerHTML = `
                <div class="tool-usage-header">
                    <span class="tool-name">${tool.name}</span>
                    <span class="tool-status">Running...</span>
                    <span class="timestamp">${timestamp}</span>
                </div>
            `;
            toolUsageContent.appendChild(usageDiv);
        } else if (status === 'end' && result) {
            const lastUsage = toolUsageContent.lastElementChild;
            if (lastUsage) {
                lastUsage.querySelector('.tool-status').textContent = 'Completed';
                lastUsage.innerHTML += `
                    <div class="tool-result">
                        <pre>${JSON.stringify(result, null, 2)}</pre>
                    </div>
                `;
            }
        }
        
        toolUsageContent.scrollTop = toolUsageContent.scrollHeight;
    }

    function disableInput() {
        if (messageInput) messageInput.disabled = true;
        if (sendButton) {
            sendButton.disabled = true;
            sendButton.innerHTML = '<div class="spinner"></div>';
        }
    }

    function enableInput() {
        if (messageInput) messageInput.disabled = false;
        if (sendButton) {
            sendButton.disabled = false;
            sendButton.innerHTML = '<i class="bi bi-send-fill"></i>';
        }
    }

    // --- Message Handling with Orchestration and Guardrails ---
    async function sendMessage(message) {
        if (!message.trim() || isProcessing) return;
        
        console.log('Sending message:', message);
        
        const messageText = message.trim();
        messageInput.value = '';
        messageInput.style.height = 'auto';
        
        // Apply input guardrails
        const safetyCheck = checkMessageSafety(messageText);
        if (!safetyCheck.safe) {
            addSystemMessage(`We cannot process your message: ${safetyCheck.reason}`, 'error');
            return;
        }
        
        isProcessing = true;
        showThinkingIndicator();
        disableInput();
        
        addUserMessage(messageText);
        
        try {
            // Use manager to route to appropriate agent
            const routingResult = await routeToAgent(messageText);
            console.log("Message routed to agent:", routingResult);
            
            // Add context about routing decision
            updateContextChain([{
                type: "Routing",
                content: `Message routed to ${routingResult.agentName} (confidence: ${Math.round(routingResult.confidence * 100)}%) because: ${routingResult.reason}`
            }]);
            
            // If routing suggests a different agent than the current one, perform handoff
            if (routingResult.agentId !== currentAgentId) {
                addSystemMessage(`Transferring to ${routingResult.agentName} for better assistance...`, 'info');
                
                const handoffResult = await handoffToAgent(
                    currentAgentId,
                    routingResult.agentId,
                    messageText,
                    { previousMessages: getConversationContext() }
                );
                
                if (handoffResult.success) {
                    // Update the current agent
                    currentAgentId = routingResult.agentId;
                    if (currentAgentName) {
                        currentAgentName.textContent = routingResult.agentName;
                    }
                    
                    // Set up new WebSocket connection to the new agent
                    setupWebSocket();
                    
                    // Add to context chain
                    addReasoningStep({
                        step_number: 1,
                        content: `Handoff initiated to ${routingResult.agentName} to better handle your request.`
                    });
                } else {
                    // Handoff failed, continue with current agent
                    addSystemMessage(`Continuing with current agent due to handoff error.`, 'warning');
                }
            }
            
            // Check if message contains tool request
            if (messageText.toLowerCase().includes('please use the')) {
                const toolMatch = messageText.match(/please use the (.*?) tool/i);
                if (toolMatch) {
                    const requestedTool = toolMatch[1];
                    // Validate tool usage
                    const toolValidation = validateToolUse(requestedTool.toLowerCase().replace(' ', '_'), messageText);
                    
                    if (!toolValidation.allowed) {
                        addSystemMessage(`Cannot use the ${requestedTool} tool: ${toolValidation.reason}`, 'error');
                        isProcessing = false;
                        hideThinkingIndicator();
                        enableInput();
                        return;
                    }
                    
                    // If tool requires confirmation, show confirmation UI
                    if (toolValidation.requiresConfirmation) {
                        addSystemMessage(`The ${requestedTool} tool requires confirmation before use. Click "Confirm" to proceed.`, 'warning');
                        showToolConfirmation(requestedTool, messageText);
                        return;
                    }
                    
                    // Tool use is allowed without confirmation
                    addSystemMessage(`Using ${requestedTool} tool...`, 'info');
                }
            }
            
            // Send message via WebSocket
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'message',
                    content: messageText,
                    agent_id: currentAgentId,
                    model: currentModel,
                    timestamp: new Date().toISOString()
                }));
            } else {
                showError('Not connected to agent');
                hideThinkingIndicator();
                enableInput();
            }
        } catch (error) {
            console.error('Error sending message:', error);
            addSystemMessage('Failed to process your message. Please try again.', 'error');
            hideThinkingIndicator();
            enableInput();
            isProcessing = false;
        }
    }

    // Get conversation context for handoffs
    function getConversationContext() {
        const messages = [];
        const messageElements = chatMessages.querySelectorAll('.message');
        
        messageElements.forEach(msgEl => {
            if (msgEl.classList.contains('user')) {
                messages.push({
                    type: 'user',
                    content: msgEl.querySelector('.message-content p').textContent
                });
            } else if (msgEl.classList.contains('agent')) {
                messages.push({
                    type: 'agent',
                    content: msgEl.querySelector('.message-content p').textContent
                });
            }
        });
        
        return messages.slice(-10); // Return the last 10 messages
    }

    // Show tool confirmation UI
    function showToolConfirmation(toolName, message) {
        // Create or get confirmation UI
        let confirmationUI = document.getElementById('tool-confirmation');
        if (!confirmationUI) {
            confirmationUI = document.createElement('div');
            confirmationUI.id = 'tool-confirmation';
            confirmationUI.className = 'tool-confirmation-ui';
            chatMessages.appendChild(confirmationUI);
        }
        
        confirmationUI.innerHTML = `
            <div class="confirmation-message">
                <p>Do you want to use the <strong>${toolName}</strong> tool?</p>
                <p>This action requires confirmation for security reasons.</p>
                <div class="confirmation-buttons">
                    <button class="btn btn-primary confirm-btn">Confirm</button>
                    <button class="btn btn-secondary cancel-btn">Cancel</button>
                </div>
            </div>
        `;
        
        // Add event listeners
        confirmationUI.querySelector('.confirm-btn').addEventListener('click', () => {
            // Send tool request with confirmation
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'tool_request',
                    tool_name: toolName.toLowerCase().replace(' ', '_'),
                    content: message,
                    confirmed: true,
                    agent_id: currentAgentId,
                    timestamp: new Date().toISOString()
                }));
            }
            
            confirmationUI.remove();
            addSystemMessage(`Using ${toolName} tool after confirmation...`, 'info');
        });
        
        confirmationUI.querySelector('.cancel-btn').addEventListener('click', () => {
            confirmationUI.remove();
            addSystemMessage(`Tool usage canceled.`, 'info');
            hideThinkingIndicator();
            enableInput();
            isProcessing = false;
        });
        
        scrollToBottom(chatMessages, true);
    }

    // --- Initialize Chat ---
    let hasInitialConnection = false;
    let isInitialLoad = true;
    let lastMessageWasDefault = false;
    const defaultAgentResponse = "As a Research Assistant, I can help you with: Literature Review, Data Analysis, Citation Management. How can I assist with your research?";

    function initializeChat() {
        // Clear chat history
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }

        // Reset context panels
        const contextChainContent = document.getElementById('context-chain-content');
        const reasoningStepsContent = document.getElementById('reasoning-steps-content');
        const toolUsageContent = document.getElementById('tool-usage-content');

        if (contextChainContent) {
            contextChainContent.innerHTML = `
                <div class="empty-state">
                    <p>No context chain available</p>
                </div>
            `;
        }

        if (reasoningStepsContent) {
            reasoningStepsContent.innerHTML = `
                <div class="empty-state">
                    <p>No reasoning steps available</p>
                </div>
            `;
        }

        if (toolUsageContent) {
            toolUsageContent.innerHTML = `
                <div class="empty-state">
                    <p>No tools have been used yet</p>
                </div>
            `;
        }

        // Initialize WebSocket connection
        setupWebSocket();
    }

    // Initialize when DOM content loaded
    document.addEventListener('DOMContentLoaded', () => {
        initializeTools();
        initializeChat();
        
        // Clear initial load flag after a short delay
        setTimeout(() => {
            isInitialLoad = false;
        }, 1000);
    });
    
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
    
    // Utility function for retrying failed fetch requests
    async function retryFetch(url, options, maxRetries = 3, delay = 2000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response;
            } catch (error) {
                lastError = error;
                if (attempt === maxRetries) {
                    break;
                }
                console.warn(`Attempt ${attempt}/${maxRetries} failed. Retrying in ${delay/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }

    // --- Data Loading ---
    async function loadInitialData() {
        try {
            console.log("Loading initial data...");
            addSystemMessage("Connecting to backend...", "info");
            
            // Check if the API_CONFIG is properly set
            if (!API_CONFIG || !API_CONFIG.BASE_URL) {
                throw new Error("API configuration is missing or invalid. Check if base.js is loaded correctly.");
            }
            
            // Check backend health with the new implementation
            const isHealthy = await checkBackendHealth();
            if (!isHealthy) {
                throw new Error("Backend health check failed");
            }
            
            // Load agents with retry
            try {
                const agentsResponse = await retryFetch(`${API_CONFIG.BASE_URL}/api/agents`, {
                    ...defaultFetchOptions
                });
                
                const agents = await agentsResponse.json();
                console.log("Agents loaded:", agents);
                activeAgents = agents;
                displayAgents(agents);
            } catch (error) {
                console.error("Error loading agents:", error);
                addSystemMessage(`Could not load agents. Using default agents.`, "warning");
                loadSimulatedData();
            }
            
            // Load tools with retry
            try {
                const toolsResponse = await retryFetch(`${API_CONFIG.BASE_URL}/api/tools`, {
                    ...defaultFetchOptions
                });
                
                const tools = await toolsResponse.json();
                console.log("Tools loaded:", tools);
                availableTools = tools;
                displayToolIcons(tools);
            } catch (error) {
                console.error("Error loading tools:", error);
                addSystemMessage(`Could not load tools. Using default tools.`, "warning");
                // Continue with default tools from loadSimulatedData
            }
            
            // Load messages if agent selected
            if (currentAgentId) {
                try {
                    const messagesResponse = await retryFetch(
                        `${API_CONFIG.BASE_URL}/api/agents/${currentAgentId}/messages`,
                        { ...defaultFetchOptions }
                    );
                    
                    const messages = await messagesResponse.json();
                    chatMessages.innerHTML = '';
                    messages.forEach(msg => {
                        if (msg.sender === 'user') {
                            addUserMessage(msg.content);
                        } else {
                            addAgentMessage(msg.content, "AI");
                        }
                    });
                    
                    const currentAgent = activeAgents.find(a => a.id === currentAgentId);
                    if (currentAgent) {
                        currentAgentName.textContent = currentAgent.name;
                    }
                } catch (error) {
                    console.error("Error loading messages:", error);
                    addSystemMessage(`Could not load previous messages. Starting new conversation.`, "warning");
                }
                
                setupWebSocket();
            } else {
                addSystemMessage("Select an agent from the sidebar to start chatting");
            }
        } catch (error) {
            console.error("Error in loadInitialData:", error);
            addSystemMessage(`Initialization failed: ${error.message}. Using offline mode.`, "error");
            loadSimulatedData();
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

    // --- Context Panel Management ---
    function initializeContextPanel() {
        // Initialize panel sections
        initializePanelSection('context-chain', 'Context Chain', 'bi-diagram-2');
        initializePanelSection('reasoning-steps', 'Reasoning Steps', 'bi-list-check');
        initializePanelSection('tool-usage', 'Tool Usage', 'bi-tools');
        
        // Set initial state for context panel
        const contextPanel = document.getElementById('context-panel');
        const chatLayout = document.querySelector('.chat-layout');
        
        if (contextPanel && chatLayout) {
            if (!contextPanel.classList.contains('collapsed')) {
                chatLayout.classList.add('show-context');
            }
        }
    }
    
    function initializePanelSection(id, title, icon) {
        const section = document.getElementById(id);
        if (!section) return;
        
        section.innerHTML = `
            <div class="section-header">
                <h6 class="section-title">
                    <i class="bi ${icon}"></i>
                    ${title}
                </h6>
                <button class="btn btn-sm btn-icon clear-section" title="Clear ${title}">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
            <div id="${id}-content" class="section-content">
                <div class="empty-state">
                    <i class="bi ${icon} text-muted"></i>
                    <p class="text-muted">No ${title.toLowerCase()} available</p>
                </div>
            </div>
        `;
        
        // Add clear functionality
        const clearBtn = section.querySelector('.clear-section');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                const contentDiv = section.querySelector('.section-content');
                if (contentDiv) {
                    contentDiv.innerHTML = `
                        <div class="empty-state">
                            <i class="bi ${icon} text-muted"></i>
                            <p class="text-muted">No ${title.toLowerCase()} available</p>
                        </div>
                    `;
                }
            });
        }
    }
    
    // --- Tool Management ---
    function initializeTools() {
        const toolsBar = document.getElementById('tools-bar');
        const headerToolsBar = document.getElementById('header-tools-bar');
        
        if (!toolsBar) {
            console.error('Tools bar element not found');
            return;
        }
        
        // Clear existing tools
        toolsBar.innerHTML = '';
        if (headerToolsBar) {
            headerToolsBar.innerHTML = '';
        }
        
        // Add tools header
        const toolsHeader = document.createElement('div');
        toolsHeader.className = 'tools-header mb-2';
        toolsHeader.innerHTML = '<span>Click on a tool to use it</span>';
        toolsBar.appendChild(toolsHeader);
        
        // Tool icons with colors
        const iconMap = {
            'Web Search': { icon: 'bi-search', color: 'primary' },
            'Code Analysis': { icon: 'bi-code-square', color: 'success' },
            'Text Processing': { icon: 'bi-file-text', color: 'info' }
        };
        
        // Create tool buttons
        availableTools.forEach(tool => {
            const iconInfo = iconMap[tool.name] || { icon: 'bi-tools', color: 'secondary' };
            
            // Create sidebar tool button
            const toolDiv = document.createElement('div');
            toolDiv.className = 'tool-icon';
            toolDiv.innerHTML = `
                <i class="bi ${iconInfo.icon} text-${iconInfo.color}"></i>
                <span>${tool.name}</span>
            `;
            
            toolDiv.addEventListener('click', () => {
                const prompt = `Please use the ${tool.name} tool to help me with my task.`;
                if (messageInput) {
                    messageInput.value = prompt;
                    messageInput.focus();
                    messageInput.dispatchEvent(new Event('input'));
                }
            });
            
            toolsBar.appendChild(toolDiv);
            
            // Create header tool button if header tools bar exists
            if (headerToolsBar) {
                const headerToolBtn = document.createElement('button');
                headerToolBtn.className = `btn btn-icon btn-sm tool-header-icon`;
                headerToolBtn.title = tool.name;
                headerToolBtn.innerHTML = `<i class="bi ${iconInfo.icon} text-${iconInfo.color}"></i>`;
                
                headerToolBtn.addEventListener('click', () => {
                    const prompt = `Please use the ${tool.name} tool to help me with my task.`;
                    if (messageInput) {
                        messageInput.value = prompt;
                        messageInput.focus();
                        messageInput.dispatchEvent(new Event('input'));
                    }
                });
                
                headerToolsBar.appendChild(headerToolBtn);
            }
        });
    }
    
    // Update the health check implementation
    async function checkBackendHealth() {
        try {
            console.log("Checking backend health at:", `${API_CONFIG.BASE_URL}/api/health`);
            const healthResponse = await fetch(`${API_CONFIG.BASE_URL}/api/health`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                mode: 'cors',
                credentials: 'include'
            });
            
            if (!healthResponse.ok) {
                throw new Error(`HTTP error! status: ${healthResponse.status}`);
            }
            
            const healthData = await healthResponse.json();
            console.log("Health check response:", healthData);
            
            if (healthData.status !== 'healthy') {
                throw new Error(`Unexpected health status: ${healthData.status}`);
            }
            
            return true;
        } catch (error) {
            console.error("Backend health check failed:", error);
            return false;
        }
    }
});