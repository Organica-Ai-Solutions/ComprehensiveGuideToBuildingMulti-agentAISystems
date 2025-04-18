// Agent Chat Page JavaScript

// Initialize global objects for chat UI and state
window.ChatUI = {
    messageContainer: null,
    messageInput: null,
    sendButton: null,
    typingIndicator: null,
    contextPanel: null,
    reasoningContainer: null,
    toolContainer: null,

    init() {
        this.messageContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendMessage');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.contextPanel = document.getElementById('contextPanel');
        this.reasoningContainer = document.getElementById('thought-tree');
        this.toolContainer = document.getElementById('tool-usage');
        
        this.setupEventListeners();
        this.initializeContextPanel();
    },

    setupEventListeners() {
        this.sendButton.addEventListener('click', () => this.handleSend());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });

        // Context panel toggle
        document.getElementById('toggleContext').addEventListener('click', () => {
            this.contextPanel.classList.toggle('collapsed');
        });
    },

    handleSend() {
        const message = this.messageInput.value.trim();
        if (message) {
            window.ChatState.sendMessage(message);
            this.messageInput.value = '';
            this.startThinking();
        }
    },

    addMessage(message, isUser = false) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isUser ? 'user-message' : 'agent-message'}`;
        
        // Create message header with avatar
        const header = document.createElement('div');
        header.className = 'message-header d-flex align-items-center gap-2 mb-2';
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = isUser ? '<i class="bi bi-person"></i>' : '<i class="bi bi-robot"></i>';
        
        const name = document.createElement('div');
        name.className = 'message-name';
        name.textContent = isUser ? 'You' : 'AI Assistant';
        
        header.appendChild(avatar);
        header.appendChild(name);
        
        // Create message content
        const content = document.createElement('div');
        content.className = 'message-content';
        content.textContent = message;
        
        messageElement.appendChild(header);
        messageElement.appendChild(content);
        
        this.messageContainer.appendChild(messageElement);
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    },

    startThinking() {
        this.addReasoningStep('Analyzing your request...', 'thinking');
        this.showTyping();
    },

    addReasoningStep(step, type = 'step') {
        const stepElement = document.createElement('div');
        stepElement.className = 'reasoning-step';
        
        const icon = document.createElement('i');
        icon.className = this.getStepIcon(type);
        
        const content = document.createElement('div');
        content.className = 'ms-2';
        content.textContent = step;
        
        stepElement.appendChild(icon);
        stepElement.appendChild(content);
        
        this.reasoningContainer.appendChild(stepElement);
        this.reasoningContainer.scrollTop = this.reasoningContainer.scrollHeight;
    },

    getStepIcon(type) {
        const icons = {
            'thinking': 'bi bi-brain',
            'step': 'bi bi-arrow-right-circle',
            'tool': 'bi bi-tools',
            'conclusion': 'bi bi-check-circle'
        };
        return icons[type] || icons.step;
    },

    addToolUsage(tool) {
        const toolElement = document.createElement('div');
        toolElement.className = 'tool-usage-item mb-3';
        
        const header = document.createElement('div');
        header.className = 'tool-usage-header';
        header.innerHTML = `
            <i class="bi ${tool.icon}"></i>
            <span class="tool-name">${tool.name}</span>
            <span class="badge bg-${tool.color} ms-auto">${tool.riskLevel}</span>
        `;
        
        const details = document.createElement('div');
        details.className = 'tool-usage-details';
        details.innerHTML = `
            <div class="input-data">
                <small class="text-muted">Input:</small>
                <pre>${JSON.stringify(tool.input, null, 2)}</pre>
            </div>
            ${tool.output ? `
            <div class="output-data">
                <small class="text-muted">Output:</small>
                <pre>${JSON.stringify(tool.output, null, 2)}</pre>
            </div>
            ` : ''}
        `;
        
        toolElement.appendChild(header);
        toolElement.appendChild(details);
        
        this.toolContainer.appendChild(toolElement);
        this.toolContainer.scrollTop = this.toolContainer.scrollHeight;
    },

    showTyping() {
        if (!this.typingIndicator) return;
        this.typingIndicator.style.display = 'flex';
        
        // Create typing animation
        this.typingIndicator.innerHTML = `
            <div class="typing">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        `;
    },

    hideTyping() {
        if (this.typingIndicator) {
            this.typingIndicator.style.display = 'none';
        }
    },

    initializeContextPanel() {
        // Initialize empty sections
        this.reasoningContainer.innerHTML = `
            <div class="text-muted text-center p-3">
                <i class="bi bi-diagram-2 fs-4"></i>
                <p class="mt-2">Reasoning steps will appear here during conversation</p>
            </div>
        `;
        
        this.toolContainer.innerHTML = `
            <div class="text-muted text-center p-3">
                <i class="bi bi-tools fs-4"></i>
                <p class="mt-2">Tool usage will be shown here when tools are used</p>
            </div>
        `;
    }
};

window.ChatState = {
    socket: null,
    connected: false,

    init() {
        this.connectWebSocket();
    },

    connectWebSocket() {
        const wsUrl = `ws://${window.location.host}/ws/chat/`;
        this.socket = new WebSocket(wsUrl);
        
        this.socket.onopen = () => {
            this.connected = true;
            console.log('WebSocket connected');
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };

        this.socket.onclose = () => {
            this.connected = false;
            console.log('WebSocket disconnected');
            setTimeout(() => this.connectWebSocket(), 5000);
        };
    },

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'thinking':
                window.ChatUI.showTyping();
                if (data.step) {
                    window.ChatUI.addReasoningStep(data.step, 'thinking');
                }
                break;
            
            case 'reasoning':
                window.ChatUI.addReasoningStep(data.step, 'step');
                break;
            
            case 'tool_usage':
                window.ChatUI.hideTyping();
                window.ChatUI.addToolUsage(data.tool);
                window.ChatUI.addReasoningStep(`Using ${data.tool.name} tool...`, 'tool');
                break;
            
            case 'message':
                window.ChatUI.hideTyping();
                window.ChatUI.addMessage(data.message, false);
                window.ChatUI.addReasoningStep('Response generated', 'conclusion');
                break;
        }
    },

    async sendMessage(message) {
        window.ChatUI.addMessage(message, true);
        
        if (this.connected) {
            this.socket.send(JSON.stringify({
                type: 'message',
                message: message
            }));
        } else {
            try {
                const response = await fetch(`${window.API_CONFIG.BASE_URL}/chat/message`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ message })
                });
                
                if (!response.ok) throw new Error('Failed to send message');
                
                const data = await response.json();
                window.ChatUI.addMessage(data.response, false);
            } catch (error) {
                console.error('Error sending message:', error);
                window.ChatUI.addMessage('Error: Failed to send message. Please try again.', false);
            }
        }
    }
};

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ChatUI.init();
    window.ChatState.init();
});

// Agent functions are globally accessible via window object
window.routeToAgent = window.routeToAgent || function() {};
window.validateToolUse = window.validateToolUse || function() {};
window.handoffToAgent = window.handoffToAgent || function() {};
window.checkMessageSafety = window.checkMessageSafety || function() {};
window.validateResponse = window.validateResponse || function() {};

// API Configuration
window.API_CONFIG = window.API_CONFIG || {
    BASE_URL: 'http://localhost:8000/api',
    AGENTS: '/agents',
    MESSAGES: '/messages',
    TOOLS: '/tools',
    WS_CHAT: '/ws/chat'
};

// Default fetch options for all API calls
window.defaultFetchOptions = {
    mode: 'cors',
    cache: 'no-cache',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    },
    credentials: 'include'
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Agent Chat page loaded");
    console.log("Using API Configuration:", window.API_CONFIG);
    
    // Initialize all UI functions
    Object.assign(window.ChatUI, {
        initModelSelector,
        toggleSidebar,
        toggleContextPanel,
        showError,
        addSystemMessage,
        addUserMessage,
        addAgentMessage,
        showToolModal,
        updateContextChain,
        addReasoningStep,
        addToolUsage,
        showThinkingIndicator,
        hideThinkingIndicator,
        showConnectionStatus,
        showToolUsage,
        disableInput,
        enableInput,
        showToolConfirmation,
        initializeContextPanel,
        initializePanelSection
    });

    // Initialize chat functionality
    await initializeChat();
    await loadInitialData();
    setupWebSocket();
    initializeContextPanel();
});

// ... existing code ...