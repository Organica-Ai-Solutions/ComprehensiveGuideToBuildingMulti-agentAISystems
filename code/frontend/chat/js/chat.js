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
    uploadButton: null,
    fileInput: null,
    filePreviewContainer: null,
    tools: [
        {
            id: 'web_search',
            icon: 'bi-search',
            tooltip: 'Web Search',
            action: function() {
                this.messageInput.value = 'Search the web for: ';
                this.messageInput.focus();
                this.messageInput.setSelectionRange(this.messageInput.value.length, this.messageInput.value.length);
            }
        },
        {
            id: 'code_analysis',
            icon: 'bi-code-slash',
            tooltip: 'Code Analysis',
            action: function() {
                this.messageInput.value = 'Analyze this code:\n```\n\n```';
                this.messageInput.focus();
                const pos = this.messageInput.value.indexOf('\n') + 1;
                this.messageInput.setSelectionRange(pos, pos);
            }
        },
        {
            id: 'text_processing',
            icon: 'bi-text-paragraph',
            tooltip: 'Text Processing',
            action: function() {
                this.messageInput.value = 'Process this text: ';
                this.messageInput.focus();
                this.messageInput.setSelectionRange(this.messageInput.value.length, this.messageInput.value.length);
            }
        },
        {
            id: 'calculator',
            icon: 'bi-calculator',
            tooltip: 'Calculator',
            action: function() {
                this.messageInput.value = 'Please help me calculate: ';
                this.messageInput.focus();
                this.messageInput.setSelectionRange(this.messageInput.value.length, this.messageInput.value.length);
            }
        },
        {
            id: 'weather_alerts',
            icon: 'bi-cloud-lightning',
            tooltip: 'Weather Alerts',
            action: function() {
                this.messageInput.value = 'Show me weather alerts for state: ';
                this.messageInput.focus();
                this.messageInput.setSelectionRange(this.messageInput.value.length, this.messageInput.value.length);
            }
        },
        {
            id: 'weather_forecast',
            icon: 'bi-cloud-sun',
            tooltip: 'Weather Forecast',
            action: function() {
                this.messageInput.value = 'What\'s the weather forecast for location: ';
                this.messageInput.focus();
                this.messageInput.setSelectionRange(this.messageInput.value.length, this.messageInput.value.length);
            }
        }
    ],
    activeTools: new Set(),

    init() {
        console.log('ChatUI Initialized.');
        // Try both possible message container IDs
        this.messageContainer = document.getElementById('messagesContainer') || document.getElementById('chat-messages');
        // Try both possible message input IDs
        this.messageInput = document.getElementById('messageInput') || document.getElementById('message-input');
        // Try both possible send button IDs
        this.sendButton = document.getElementById('sendMessage') || document.getElementById('send-button');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.contextPanel = document.getElementById('contextPanel');
        this.reasoningContainer = document.getElementById('reasoningSteps');
        this.toolContainer = document.getElementById('toolUsage');
        this.uploadButton = document.getElementById('uploadFile');
        this.fileInput = document.getElementById('fileInput');
        this.filePreviewContainer = document.getElementById('filePreview');

        if (!this.messageContainer) {
            console.error("ChatUI Error: Message container not found in the DOM.");
            return;
        }

        // Ensure chat input container exists and is visible
        let chatInputContainer = document.querySelector('.chat-input-container');
        if (!chatInputContainer) {
            chatInputContainer = document.createElement('div');
            chatInputContainer.className = 'chat-input-container';
            this.messageContainer.parentElement.appendChild(chatInputContainer);
        }

        // Ensure input group exists
        let inputGroup = chatInputContainer.querySelector('.input-group');
        if (!inputGroup) {
            inputGroup = document.createElement('div');
            inputGroup.className = 'input-group';
            chatInputContainer.appendChild(inputGroup);
        }

        // Ensure message input exists
        if (!this.messageInput) {
            this.messageInput = document.createElement('textarea');
            this.messageInput.id = 'messageInput';
            this.messageInput.className = 'form-control chat-input';
            this.messageInput.placeholder = 'Type your message...';
            this.messageInput.rows = '1';
            inputGroup.appendChild(this.messageInput);
        } else if (this.messageInput.parentElement !== inputGroup) {
            inputGroup.appendChild(this.messageInput);
        }

        // Ensure send button exists
        if (!this.sendButton) {
            this.sendButton = document.createElement('button');
            this.sendButton.id = 'sendMessage';
            this.sendButton.className = 'btn btn-primary';
            this.sendButton.innerHTML = '<i class="bi bi-send"></i>';
            inputGroup.appendChild(this.sendButton);
        } else if (this.sendButton.parentElement !== inputGroup) {
            inputGroup.appendChild(this.sendButton);
        }

        // Set proper styles to ensure visibility
        chatInputContainer.style.position = 'sticky';
        chatInputContainer.style.bottom = '0';
        chatInputContainer.style.backgroundColor = 'var(--bs-body-bg)';
        chatInputContainer.style.zIndex = '100';
        chatInputContainer.style.padding = '1rem';
        chatInputContainer.style.borderTop = '1px solid var(--bs-border-color)';
        chatInputContainer.style.width = '100%';

        // Style the input group
        inputGroup.style.display = 'flex';
        inputGroup.style.gap = '0.5rem';

        // Style the message input
        this.messageInput.style.resize = 'none';
        this.messageInput.style.minHeight = '38px';
        this.messageInput.style.maxHeight = '200px';
        this.messageInput.style.width = '100%';
        this.messageInput.style.border = '1px solid var(--bs-border-color)';
        this.messageInput.style.borderRadius = '4px';
        this.messageInput.style.padding = '0.5rem';
        this.messageInput.style.color = 'var(--bs-body-color)';

        this.setupEventListeners();
        this.initializeContextPanel();
        this.scrollToBottom();
        this.messageContainer.addEventListener('scroll', this.handleScroll.bind(this));
        this.initializeTools();
    },

    handleScroll() {
        // Load more messages when scrolling near top
        if (this.messageContainer.scrollTop < 100) {
            ChatState.loadMoreMessages();
        }
    },

    setupEventListeners() {
        // Input handling
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });

        this.sendButton.addEventListener('click', () => this.handleSend());

        // Auto-resize input
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = (this.messageInput.scrollHeight) + 'px';
        });

        // Context panel toggle
        const contextToggle = document.getElementById('toggleContext');
        if (contextToggle) {
            contextToggle.addEventListener('click', () => {
                this.contextPanel.classList.toggle('collapsed');
            });
        }

        // File Upload Listener
        if (this.uploadButton && this.fileInput) {
            this.uploadButton.addEventListener('click', () => this.fileInput.click());
            this.fileInput.addEventListener('change', (event) => this.handleFileSelection(event));
        }
    },

    handleSend() {
        const message = this.messageInput.value.trim();
        if (message) {
            const messageData = {
                content: message,
                tools: Array.from(this.activeTools)
            };

            this.addMessage(message, true);
            this.messageInput.value = '';
            this.messageInput.style.height = 'auto';
            ChatState.sendMessage(messageData);
            this.startThinking();

            // Reset active tools after sending
            this.activeTools.clear();
            this.tools.forEach(tool => {
                const button = document.getElementById(`tool-${tool.id}`);
                if (button) button.classList.remove('active');
            });
            this.updateInputPlaceholder();
            
            // Force scroll to bottom after sending
            this.scrollToBottom(true);
        }
    },

    addMessage(content, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'agent-message'}`;
        
        if (!isUser) {
            // Add avatar and name for agent messages
            const header = document.createElement('div');
            header.className = 'message-header';
            header.innerHTML = `
                <div class="message-avatar">
                    <i class="bi bi-robot"></i>
                </div>
                <strong>${ChatState.getCurrentAgentName() || 'AI Assistant'}</strong>
            `;
            messageDiv.appendChild(header);
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = this.formatMessage(content);
        messageDiv.appendChild(contentDiv);

        // Add timestamp
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = new Date().toLocaleTimeString();
        messageDiv.appendChild(timestamp);

        this.messageContainer.appendChild(messageDiv);
        this.scrollToBottom(true);

        // Ensure input is visible and focused after sending
        if (isUser) {
            this.messageInput.focus();
        }
    },

    formatMessage(content) {
        // Convert markdown-like syntax
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    },

    scrollToBottom(force = false) {
        if (!this.messageContainer) return;
        
        const shouldScroll = force || 
            (this.messageContainer.scrollHeight - this.messageContainer.scrollTop - this.messageContainer.clientHeight < 100);
        
        if (shouldScroll) {
            requestAnimationFrame(() => {
                this.messageContainer.scrollTo({
                    top: this.messageContainer.scrollHeight,
                    behavior: 'smooth'
                });
            });
        }
    },

    showTyping() {
        if (this.typingIndicator) {
            this.typingIndicator.style.display = 'flex';
            this.typingIndicator.innerHTML = `
                <div class="typing">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
            `;
        }
    },

    hideTyping() {
        if (this.typingIndicator) {
            this.typingIndicator.style.display = 'none';
        }
    },

    startThinking() {
        this.addReasoningStep('Thinking...', 'thinking');
        this.showTyping();
    },

    addReasoningStep(description, type = 'thinking') {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'reasoning-step';
        
        let icon = 'bi-arrow-right';
        if (type === 'error') icon = 'bi-exclamation-triangle';
        else if (type === 'tool_call') icon = 'bi-tools';
        else if (type === 'thinking') icon = 'bi-hourglass-split';
        else if (type === 'final_answer') icon = 'bi-check-circle';
        
        stepDiv.innerHTML = `
            <i class="bi ${icon}"></i>
            <div class="step-content">${description}</div>
        `;
        
        if (this.reasoningContainer) {
            this.reasoningContainer.appendChild(stepDiv);
            this.reasoningContainer.scrollTop = this.reasoningContainer.scrollHeight;
        }
    },

    addToolUsage(toolData) {
        if (!toolData || !toolData.tool_name) return;

        const toolDiv = document.createElement('div');
        toolDiv.className = 'tool-usage-item';
        
        toolDiv.innerHTML = `
            <div class="tool-usage-header">
                <i class="bi bi-tools"></i>
                <strong>${toolData.tool_name}</strong>
                ${toolData.status ? `<span class="badge bg-${toolData.status === 'success' ? 'success' : 'danger'} ms-auto">${toolData.status}</span>` : ''}
            </div>
            <div class="tool-usage-content">
                <div class="input-data">
                    <strong>Input:</strong>
                    <pre>${JSON.stringify(toolData.tool_input || {}, null, 2)}</pre>
                </div>
                ${toolData.result ? `
                    <div class="output-data">
                        <strong>Output:</strong>
                        <pre>${typeof toolData.result === 'object' ? JSON.stringify(toolData.result, null, 2) : toolData.result}</pre>
                    </div>
                ` : ''}
            </div>
        `;
        
        if (this.toolContainer) {
            this.toolContainer.appendChild(toolDiv);
            this.toolContainer.scrollTop = this.toolContainer.scrollHeight;
        }
    },

    initializeContextPanel() {
        if (this.reasoningContainer) {
            this.reasoningContainer.innerHTML = `
                <div class="placeholder text-muted text-center p-3">
                    <i class="bi bi-diagram-2 fs-4"></i>
                    <p class="mt-2 mb-0 small">Reasoning steps will appear here.</p>
                </div>
            `;
        }
        
        if (this.toolContainer) {
            this.toolContainer.innerHTML = `
                <div class="placeholder text-muted text-center p-3">
                    <i class="bi bi-tools fs-4"></i>
                    <p class="mt-2 mb-0 small">Tool usage will be shown here.</p>
                </div>
            `;
        }
    },

    clearPlaceholdersIfNeeded() {
        ['reasoningSteps', 'toolUsage'].forEach(id => {
            const element = document.getElementById(id);
            if (element && element.querySelector('.placeholder')) {
                element.innerHTML = '';
            }
        });
    },

    handleFileSelection(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        ChatState.addFiles(Array.from(files));
        this.displayFilePreviews();
        event.target.value = null;
    },

    displayFilePreviews() {
        if (!this.filePreviewContainer) return;
        
        this.filePreviewContainer.innerHTML = '';
        this.filePreviewContainer.style.display = ChatState.attachedFiles.length > 0 ? 'flex' : 'none';

        ChatState.attachedFiles.forEach(file => {
            const previewDiv = document.createElement('div');
            previewDiv.className = 'file-preview-item';
            previewDiv.innerHTML = `
                <span class="filename">${file.name}</span>
                <button class="remove-file btn btn-sm btn-link text-danger">
                    <i class="bi bi-x"></i>
                </button>
            `;

            const removeButton = previewDiv.querySelector('.remove-file');
            if (removeButton) {
                removeButton.addEventListener('click', () => this.removeFilePreview(file.name));
            }

            this.filePreviewContainer.appendChild(previewDiv);
        });
    },

    removeFilePreview(fileName) {
        ChatState.removeFile(fileName);
        this.displayFilePreviews();
    },

    clearFilePreviews() {
        if (this.filePreviewContainer) {
            this.filePreviewContainer.innerHTML = '';
            this.filePreviewContainer.style.display = 'none';
        }
    },

    initializeTools() {
        // Find the chat input container
        const chatInputContainer = document.querySelector('.chat-input-container');
        if (!chatInputContainer) return;

        // Create tools container if it doesn't exist
        let toolsContainer = chatInputContainer.querySelector('.chat-tools');
        if (!toolsContainer) {
            toolsContainer = document.createElement('div');
            toolsContainer.className = 'chat-tools';
            chatInputContainer.insertBefore(toolsContainer, chatInputContainer.firstChild);
        }

        // Clear existing tools
        toolsContainer.innerHTML = '';

        // Add tool buttons
        this.tools.forEach(tool => {
            const button = document.createElement('button');
            button.className = 'btn btn-icon';
            button.id = `tool-${tool.id}`;
            button.title = tool.tooltip;
            button.innerHTML = `<i class="bi ${tool.icon}"></i>`;
            button.addEventListener('click', () => this.handleToolClick(tool));
            toolsContainer.appendChild(button);
        });

        // Setup file input handling
        this.uploadButton = document.getElementById('uploadFile');
        this.fileInput = document.getElementById('fileInput');

        if (this.uploadButton && this.fileInput) {
            this.uploadButton.addEventListener('click', () => this.fileInput.click());
            this.fileInput.addEventListener('change', (event) => this.handleFileSelection(event));
        }
    },

    handleToolClick(tool) {
        if (typeof tool.action === 'function') {
            tool.action.call(this);
        }
    },

    toggleTool(toolId) {
        const button = document.getElementById(`tool-${toolId}`);
        if (!button) return;

        if (this.activeTools.has(toolId)) {
            this.activeTools.delete(toolId);
            button.classList.remove('active');
        } else {
            this.activeTools.add(toolId);
            button.classList.add('active');
        }

        // Update input placeholder based on active tools
        this.updateInputPlaceholder();
    },

    updateInputPlaceholder() {
        const activeToolNames = Array.from(this.activeTools).map(toolId => {
            const tool = this.tools.find(t => t.id === toolId);
            return tool ? tool.tooltip : '';
        });

        if (activeToolNames.length > 0) {
            this.messageInput.placeholder = `Using: ${activeToolNames.join(', ')}`;
        } else {
            this.messageInput.placeholder = 'Type your message...';
        }
    }
};

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Chat DOM Content Loaded.');
    ChatUI.init();
});

// Refactored ChatState for HTTP API calls
window.ChatState = {
    currentConversationId: null,
    selectedAgentId: 'default_agent',
    availableAgents: [],
    attachedFiles: [],
    messageHistory: [],
    isLoadingMore: false,

    async init() {
        this.currentConversationId = `conv_${Date.now()}`;
        console.log(`ChatState Initialized. Conversation ID: ${this.currentConversationId}`);
        
        // Initialize agents first
        await this.loadAgents();
        
        // Then try to load conversation history
        await this.loadConversationHistory();
    },

    async loadConversationHistory() {
        if (!window.API_CONFIG?.ENDPOINTS?.MESSAGES) {
            console.warn('Messages endpoint not configured, skipping history load');
            return;
        }

        try {
            const response = await fetch(`${window.API_CONFIG.BASE_URL}${window.API_CONFIG.ENDPOINTS.MESSAGES}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.messageHistory = data.messages || [];
            
            // Display initial messages
            this.messageHistory.forEach(msg => {
                ChatUI.addMessage(msg.content, msg.isUser);
            });
        } catch (error) {
            console.error("Error loading conversation history:", error);
            this.messageHistory = [];
        }
    },

    async loadMoreMessages() {
        if (this.isLoadingMore || this.messageHistory.length === 0) return;
        if (!window.API_CONFIG?.ENDPOINTS?.MESSAGES) return;
        
        this.isLoadingMore = true;
        const oldestMessageId = this.messageHistory[0]?.id;
        
        try {
            const response = await fetch(
                `${window.API_CONFIG.BASE_URL}${window.API_CONFIG.ENDPOINTS.MESSAGES}?before=${oldestMessageId}`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.messages && data.messages.length > 0) {
                this.messageHistory.unshift(...data.messages);
                
                // Add messages to UI
                data.messages.reverse().forEach(msg => {
                    const messageDiv = ChatUI.createMessageElement(msg.content, msg.isUser);
                    ChatUI.messageContainer.prepend(messageDiv);
                });
            }
        } catch (error) {
            console.error("Error loading more messages:", error);
        } finally {
            this.isLoadingMore = false;
        }
    },

    getCurrentAgentName() {
        const currentAgent = this.availableAgents.find(agent => agent.id === this.selectedAgentId);
        return currentAgent ? currentAgent.name : 'AI Assistant';
    },

    async loadAgents() {
        if (!window.API_CONFIG?.ENDPOINTS?.AGENTS) {
            console.warn('Agents endpoint not configured, using default agent');
            this.availableAgents = [{
                id: 'default_agent',
                name: 'Default AI Assistant'
            }];
            this.populateAgentSelector();
            return;
        }

        try {
            const response = await fetch(`${window.API_CONFIG.BASE_URL}${window.API_CONFIG.ENDPOINTS.AGENTS}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (Array.isArray(data)) {
                this.availableAgents = data;
                
                // Set first available agent as default if exists
                if (data.length > 0 && data[0].id) {
                    this.selectedAgentId = data[0].id;
                }
            } else {
                throw new Error('Invalid agents data format');
            }
        } catch (error) {
            console.error("Error loading agents:", error);
            // Fallback to default agent
            this.availableAgents = [{
                id: 'default_agent',
                name: 'Default AI Assistant'
            }];
        } finally {
            this.populateAgentSelector();
        }
    },

    populateAgentSelector() {
        const selectElement = document.getElementById('agentSelect');
        if (!selectElement) return;

        selectElement.innerHTML = '';

        // Add available agents
        this.availableAgents.forEach(agent => {
            if (agent && agent.id) {
                const option = document.createElement('option');
                option.value = agent.id;
                option.textContent = agent.name || agent.id;
                selectElement.appendChild(option);
            }
        });

        // Set current selection
        selectElement.value = this.selectedAgentId;

        // Add change listener
        selectElement.addEventListener('change', (e) => {
            this.selectedAgentId = e.target.value;
            console.log(`Selected agent: ${this.selectedAgentId}`);
        });
    },

    addFiles(files) {
        // Basic validation (can add size/type checks later)
        files.forEach(file => {
            // Avoid duplicates by name
            if (!this.attachedFiles.some(f => f.name === file.name)) {
                this.attachedFiles.push(file);
            }
        });
        console.log("ChatState: Files attached:", this.attachedFiles);
    },

    removeFile(fileName) {
        this.attachedFiles = this.attachedFiles.filter(file => file.name !== fileName);
        console.log("ChatState: File removed. Remaining files:", this.attachedFiles);
    },
    
    clearFiles() {
        this.attachedFiles = [];
        console.log("ChatState: Attached files cleared.");
    },

    async sendMessage(messageData) {
        console.log(`ChatState: Sending message with tools:`, messageData);
        
        if (!messageData.content && this.attachedFiles.length === 0) return;

        const chatEndpoint = '/api/chat';  // Use consistent endpoint path
        const url = `${window.API_CONFIG.BASE_URL}${chatEndpoint}`;
        
        let payload = {
            message: messageData.content,
            conversation_id: this.currentConversationId,
            agent_id: this.selectedAgentId || 'default',  // Ensure default agent if none selected
            tools: messageData.tools || [],
            files: []
        };

        // Process attached files
        if (this.attachedFiles.length > 0) {
            console.log("ChatState: Processing attached files...");
            payload.files = await Promise.all(this.attachedFiles.map(async (file) => {
                return {
                    filename: file.name,
                    content: await this.readFileAsBase64(file),
                    mime_type: file.type
                };
            }));
            console.log(`ChatState: Processed ${payload.files.length} files.`);
        }

        try {
            const response = await window.apiCall(chatEndpoint, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            ChatUI.hideTyping();
            this.clearFiles();
            ChatUI.clearFilePreviews();

            if (response && response.data) {
                console.log("ChatState: API Response received:", response.data);
                this.handleApiResponse(response.data);
            } else {
                console.warn('ChatState: API call succeeded but returned no data.');
                ChatUI.addMessage("Received an empty response from the server.", false);
                ChatUI.addReasoningStep("No response data received from server.", 'error');
            }
        } catch (error) {
            ChatUI.hideTyping();
            console.error('ChatState: Error sending message via apiCall:', error);
            const errorMessage = error instanceof APIError 
                ? error.message 
                : 'Could not reach the server. Please try again.';
            ChatUI.addMessage(`Error: ${errorMessage}`, false);
            ChatUI.addReasoningStep(`Failed to process request: ${errorMessage}`, 'error');
        }
    },
    
    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]); // Get Base64 part
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    },

    handleApiResponse(data) {
        // Process different parts of the response
        // Adjust based on the actual structure returned by your /api/chat endpoint

        // 1. Display Agent's final answer/reply
        if (data.reply) {
            ChatUI.addMessage(data.reply, false);
        }

        // 2. Display Reasoning Steps (Chain of Thought)
        if (data.reasoning && Array.isArray(data.reasoning)) {
             ChatUI.clearPlaceholdersIfNeeded(); // Clear placeholders only if we have real steps
            data.reasoning.forEach(step => {
                // Assuming step is an object like { description: "...", type: "step" }
                ChatUI.addReasoningStep(step.description || step, step.type || 'step');
            });
        }

        // 3. Display Tool Usage
        if (data.tool_usage && Array.isArray(data.tool_usage)) {
            ChatUI.clearPlaceholdersIfNeeded(); // Clear placeholders only if we have real steps
            data.tool_usage.forEach(toolCall => {
                 // Assuming toolCall is an object like { tool_name: "...", tool_input: {...}, result: ..., status: "success" }
                ChatUI.addToolUsage(toolCall);
            });
        }
        
        // Add a concluding reasoning step if not already present
        if (data.reply && (!data.reasoning || !data.reasoning.some(s => s.type === 'final_answer'))) {
             ChatUI.addReasoningStep("Task completed.", 'final_answer');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("Chat DOM Content Loaded.");
    
    // Verify API configuration
    if (!window.API_CONFIG || !window.API_CONFIG.BASE_URL) {
        console.error("Chat: Required API_CONFIG not found or incomplete.");
        ChatUI.addMessage("Error: Chat system configuration is incomplete. Please refresh the page.", false);
        return;
    }
    
    // Initialize UI and State managers
    if (!window.chatInitialized) {
        ChatUI.init();
        ChatState.init();
        window.chatInitialized = true;
        console.log("Chat initialized successfully.");
    } else {
        console.log("Chat already initialized.");
    }
});

// Agent functions are globally accessible via window object
window.routeToAgent = window.routeToAgent || function() {};
window.validateToolUse = window.validateToolUse || function() {};
window.handoffToAgent = window.handoffToAgent || function() {};
window.checkMessageSafety = window.checkMessageSafety || function() {};
window.validateResponse = window.validateResponse || function() {};

// API Configuration
window.API_CONFIG = {
    BASE_URL: '/api',  // Update this based on your backend URL
    ENDPOINTS: {
        AGENTS: '/agents',
        MESSAGES: '/messages',
        CHAT: '/chat',
        TOOLS: '/tools'
    }
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