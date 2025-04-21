// Agent Chat Page JavaScript

class ChatApp {
    constructor() {
        // UI Elements
        this.messageContainer = null;
        this.messageInput = null;
        this.sendButton = null;
        this.typingIndicator = null; // Will be created dynamically if needed
        this.contextPanel = null;
        this.reasoningContainer = null;
        this.toolContainer = null;
        this.uploadButton = null;
        this.fileInput = null;
        this.filePreviewContainer = null;
        this.agentSelect = null;
        this.serverStatusContainer = null; // For displaying connection status

        // State
        this.ws = null;
        this.messageQueue = [];
        this.isProcessingQueue = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5; // Default, replace if needed from config
        this.reconnectInterval = 5000; // Default, replace if needed from config
        this.selectedAgentId = 'default_agent'; // Default agent
        this.attachedFiles = []; // To store attached File objects
        this.agents = []; // Store loaded agent info
        this.currentConversationId = `conv_${Date.now()}`; // Simple conversation ID

        // Placeholder for tools - should be loaded dynamically
        this.tools = [];
        this.activeTools = new Set();

        // Bind 'this' for methods used as event handlers or callbacks
        this.handleSend = this.handleSend.bind(this);
        this.handleWebSocketMessage = this.handleWebSocketMessage.bind(this);
        this.handleWebSocketOpen = this.handleWebSocketOpen.bind(this);
        this.handleWebSocketClose = this.handleWebSocketClose.bind(this);
        this.handleWebSocketError = this.handleWebSocketError.bind(this);
        this.handleFileSelection = this.handleFileSelection.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
        this.initializeWebSocket = this.initializeWebSocket.bind(this); // For retries

        // Check for API_CONFIG early
        if (typeof API_CONFIG === 'undefined') {
            console.error("FATAL: API_CONFIG not found. Ensure base.js is loaded before chat.js");
            alert("Configuration Error: Cannot initialize chat application.");
            return;
        }

        this.init();
    }

    async init() {
        console.log("ChatApp: Initializing...");
        this.initializeUIElements();
        if (!this.messageContainer) return; // Stop if essential elements aren't found

        this.addServerStatusIndicator(); // Add indicator early
        this.setupEventListeners();
        this.initializeTools(); // Placeholder for tool buttons
        this.initializeContextPanelPlaceholders(); // Set initial context panel state

        await this.loadAgents(); // Load agents to populate selector
        await this.initializeWebSocket(); // Attempt WebSocket connection
        // await this.loadConversationHistory(); // TODO: Implement history loading if needed

        this.scrollToBottom(true); // Initial scroll
        console.log("ChatApp: Initialization complete.");
    }

    initializeUIElements() {
        console.log("ChatApp: Initializing UI elements...");
        this.messageContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendMessage');
        this.contextPanel = document.getElementById('contextPanel');
        this.reasoningContainer = document.getElementById('thoughtTree');
        this.toolContainer = document.getElementById('toolUsage');
        this.uploadButton = document.getElementById('uploadFile');
        this.fileInput = document.getElementById('fileInput');
        this.filePreviewContainer = document.getElementById('filePreview');
        this.agentSelect = document.getElementById('agentSelect');
        // Note: typingIndicator is created dynamically

        // --- Crucial Element Checks ---
        if (!this.messageContainer) {
            console.error("ChatApp FATAL Error: Message container ('messagesContainer') not found.");
            alert("UI Error: Chat message container is missing.");
            return;
        }
        if (!this.messageInput) console.warn("ChatApp Warning: Message input ('messageInput') not found.");
        if (!this.sendButton) console.warn("ChatApp Warning: Send button ('sendMessage') not found.");
        if (!this.agentSelect) console.warn("ChatApp Warning: Agent select ('agentSelect') not found.");
        if (!this.uploadButton) console.warn("ChatApp Warning: Upload button ('uploadFile') not found.");
        if (!this.fileInput) console.warn("ChatApp Warning: File input ('fileInput') not found.");
        if (!this.filePreviewContainer) console.warn("ChatApp Warning: File preview ('filePreview') not found.");
        if (!this.reasoningContainer) console.warn("ChatApp Warning: Reasoning container ('thoughtTree') not found.");
        if (!this.toolContainer) console.warn("ChatApp Warning: Tool container ('toolUsage') not found.");
        // --- End Crucial Checks ---

        // Initially disable input until WebSocket connection is confirmed
        this.updateInputState(false); // Start in disabled state
        console.log("ChatApp: UI elements initialized.");
    }

    updateInputState(isEnabled) {
        if (this.messageInput) {
            this.messageInput.disabled = !isEnabled;
            this.messageInput.placeholder = isEnabled ? 'Type your message...' : 'Connecting...';
        }
        if (this.sendButton) this.sendButton.disabled = !isEnabled;
        if (this.uploadButton) this.uploadButton.disabled = !isEnabled;
    }

    addServerStatusIndicator() {
        if (document.getElementById('server-status')) return; // Don't add if already exists

        this.serverStatusContainer = document.createElement('div');
        this.serverStatusContainer.id = 'server-status';
        this.serverStatusContainer.className = 'server-status'; // Add styles via CSS
        this.serverStatusContainer.style.position = 'sticky';
        this.serverStatusContainer.style.top = '0';
        this.serverStatusContainer.style.zIndex = '1050';
        this.serverStatusContainer.style.padding = '0.5rem';
        this.serverStatusContainer.style.background = 'var(--bs-body-bg)'; // Use theme background

        // Insert at the top, before the message container's parent's first child (usually nav)
        const layoutElement = document.querySelector('.chat-layout'); // Adjust selector if needed
        if (layoutElement) {
            layoutElement.parentNode.insertBefore(this.serverStatusContainer, layoutElement);
        } else if (this.messageContainer?.parentElement) {
            this.messageContainer.parentElement.insertBefore(this.serverStatusContainer, this.messageContainer.parentElement.firstChild);
        } else {
             document.body.insertBefore(this.serverStatusContainer, document.body.firstChild);
             console.warn("ChatApp: Could not find optimal placement for server status indicator.");
        }

        this.updateConnectionStatus(false, 'Initializing Connection...'); // Set initial message
    }

    updateConnectionStatus(isConnected, statusText = '') {
         if (!this.serverStatusContainer) {
             console.warn("ChatApp: Server status container not found, cannot update status.");
             return; // Exit if the container wasn't added
         }

        let alertClass = isConnected ? 'alert-success' : 'alert-warning'; // Default to warning for errors/disconnects
        let iconClass = isConnected ? 'bi-cloud-check-fill' : 'bi-exclamation-triangle-fill';
        let effectiveStatusText = statusText || (isConnected ? 'Connected' : 'Connecting...');

        // Handle specific error/failure states
        if (!isConnected) {
            if (statusText.includes('Failed') || statusText.includes('Error') || statusText.includes('Unable')) {
                alertClass = 'alert-danger';
            } else if (statusText === 'Disconnected') {
                alertClass = 'alert-warning';
                effectiveStatusText = 'Connection lost. Attempting to reconnect...';
            } else {
                 alertClass = 'alert-info'; // For states like 'Initializing' or 'Connecting'
                 iconClass = 'bi-info-circle-fill';
            }
        }

        // Use Bootstrap alert structure
        this.serverStatusContainer.innerHTML = `
            <div class="alert ${alertClass} alert-dismissible fade show d-flex align-items-center" role="alert" style="margin-bottom: 0;">
                <i class="bi ${iconClass} me-2"></i>
                <div>${effectiveStatusText}</div>
                <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;

        // Ensure it's visible when showing status
        this.serverStatusContainer.style.display = 'block';

        // Automatically hide success messages after a delay
        if (isConnected) {
            setTimeout(() => {
                const successAlert = this.serverStatusContainer.querySelector('.alert-success');
                if (successAlert) {
                    try {
                        // Use Bootstrap's static method to get instance and close
                         const alertInstance = bootstrap.Alert.getOrCreateInstance(successAlert);
                         if (alertInstance) alertInstance.close();
                    } catch (e) {
                        console.warn("Bootstrap Alert component not available or failed to close:", e);
                        successAlert.style.display = 'none'; // Fallback hide
                    }
                }
            }, 5000); // 5 seconds
        }

        // Enable/disable input based on connection status
        this.updateInputState(isConnected);
    }


    initializeWebSocket() {
        // Ensure API_CONFIG is available from base.js
        if (typeof API_CONFIG === 'undefined' || !API_CONFIG.WS_URL) {
            console.error('ChatApp FATAL: API_CONFIG or API_CONFIG.WS_URL is not defined. Cannot initialize WebSocket.');
            this.updateConnectionStatus(false, 'Configuration Error');
            return;
        }

        // Use the agent-specific WebSocket endpoint from the backend definition
        const agentId = this.selectedAgentId || 'default_agent'; // Use selected or default
        const wsUrl = `${API_CONFIG.WS_URL}/ws/${agentId}`; // Construct URL like ws://host:port/ws/agent_id
        console.log(`ChatApp: Attempting WebSocket connection to: ${wsUrl}`);
        this.updateConnectionStatus(false, `Connecting to WebSocket for agent ${agentId}...`);

        // Close existing connection cleanly before creating a new one
        if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
            console.log("ChatApp: Closing previous WebSocket connection.");
            this.ws.onclose = null; // Prevent old close handler from triggering reconnect
            this.ws.onerror = null;
            this.ws.onmessage = null;
            this.ws.onopen = null;
            this.ws.close();
        }

        try {
            this.ws = new WebSocket(wsUrl);
            // Assign event handlers using bound methods
            this.ws.onopen = this.handleWebSocketOpen;
            this.ws.onclose = this.handleWebSocketClose;
            this.ws.onerror = this.handleWebSocketError;
            this.ws.onmessage = this.handleWebSocketMessage;
        } catch (error) {
            console.error('ChatApp: Failed to create WebSocket:', error);
            this.updateConnectionStatus(false, `Connection Failed: ${error.message}`);
            // Consider if retry logic should be invoked here immediately
        }
    }

    handleWebSocketOpen() {
        console.log('ChatApp: WebSocket connection established');
        this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        this.updateConnectionStatus(true, 'Connected');
        this.processMessageQueue(); // Send any queued messages
        // Optionally send a 'client connected' status message to backend
        this.sendMessageInternal({ type: 'status', payload: { status: 'connected', clientId: 'user-ui' } }); // Send internal message
    }

    handleWebSocketClose(event) {
        console.log(`ChatApp: WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`);
        this.updateConnectionStatus(false, 'Disconnected');
        this.ws = null; // Clear the ws object reference

        // Attempt to reconnect only if the closure was unexpected or retry attempts remain
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            // Exponential backoff for reconnect delay
            const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
            console.log(`ChatApp: Attempting WebSocket reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);
            setTimeout(this.initializeWebSocket, delay); // Use bound method for retry
        } else if (!event.wasClean) {
            console.error('ChatApp: Max WebSocket reconnection attempts reached.');
            this.updateConnectionStatus(false, 'Reconnection Failed');
            this.showError('Unable to maintain server connection. Please check the server status or refresh the page.');
        } else {
            console.log("ChatApp: WebSocket closed cleanly.");
            // No reconnection needed if closed cleanly (e.g., page unload, server shutdown intent)
        }
    }

    handleWebSocketError(error) {
        console.error('ChatApp: WebSocket error observed:', error);
        // Don't usually need to do much here as 'onclose' will likely fire immediately after
        // and handle the reconnection logic. We could show a transient error.
        this.updateConnectionStatus(false, 'Connection Error');
        // Avoid showing raw error objects to the user directly
        this.showError('A WebSocket communication error occurred.');
    }

    handleWebSocketMessage(event) {
        console.log("ChatApp: Raw WS message received:", event.data); // ADDED: Log raw data
        try {
            const data = JSON.parse(event.data);
            console.log("ChatApp: Parsed WS message object:", data); // ADDED: Log parsed object

            // Validate basic structure
            if (typeof data !== 'object' || data === null || !data.type) {
                console.warn('ChatApp: Received invalid message structure:', data);
                return;
            }

            console.log("ChatApp: Handling message type:", data.type); // ADDED: Log message type
            // --- Message Type Handling ---
            switch (data.type) {
                case 'agent_response':
                case 'message': // Treat agent responses and general messages similarly for display
                case 'agent_message': // Add handling for this type
                    console.log("ChatApp: Calling displayMessage for type", data.type, "with payload:", data.payload || data); // ADDED: Log before display
                    this.hideTyping(); // Hide typing indicator when response arrives
                    this.displayMessage(data);
                    break;
                case 'status':
                    this.handleStatusUpdate(data.payload || data); // Handle nested or flat payload
                    break;
                case 'error':
                    this.hideTyping();
                    this.handleError(data.payload || data); // Handle nested or flat payload
                    break;
                case 'typing':
                    this.handleTypingIndicator(data.payload || data); // Handle nested or flat payload
                    break;
                case 'tool_call':
                case 'tool_result': // Can be combined if structure is similar
                    this.clearContextPlaceholder('toolUsage');
                    this.addToolUsage(data.payload || data); // Handle nested or flat payload
                    break;
                case 'reasoning':
                case 'thought': // Can be combined
                     this.clearContextPlaceholder('thoughtTree');
                     this.addReasoningStep(data.payload || data); // Handle nested or flat payload
                     break;
                case 'pong':
                     // console.log("ChatApp: Pong received from server."); // Keep-alive check
                     break;
                default:
                    console.warn('ChatApp: Received unknown WebSocket message type:', data.type, data);
            }
        } catch (error) {
            console.error('ChatApp: Error parsing or handling WebSocket message:', error, 'Raw data:', event.data);
            // Avoid showing raw errors to the user unless debugging is enabled
            // this.showError('Error processing message from server.');
        }
    }

    // --- Agent Loading ---
    async loadAgents() {
        console.log("ChatApp: Loading agents...");
        if (!this.agentSelect) {
            console.warn("ChatApp: Agent select element not found, cannot load agents.");
            return;
        }
        if (typeof apiCall !== 'function') {
             console.error("ChatApp: apiCall function not available. Ensure base.js is loaded.");
             this.showError("Application error: Cannot load agents.");
             return;
        }

        try {
            // Use the apiCall function from base.js, passing the global API_CONFIG
            const response = await apiCall(API_CONFIG.ENDPOINTS.AGENTS, API_CONFIG);
            this.agents = response.data; // Assuming response.data is the array

            if (!Array.isArray(this.agents)) {
                throw new Error("Invalid agent data format received from server.");
            }

            this.populateAgentSelector();
            console.log("ChatApp: Agents loaded successfully:", this.agents);

        } catch (error) {
            console.error('ChatApp: Failed to load agents:', error);
            this.showError(`Failed to load agents: ${error.message || 'Server error'}`);
            this.agentSelect.innerHTML = '<option disabled selected>Failed to load agents</option>';
        }
    }

    populateAgentSelector() {
        if (!this.agentSelect) return;
        this.agentSelect.innerHTML = ''; // Clear existing options

        if (this.agents.length === 0) {
            const defaultOption = document.createElement('option');
            defaultOption.textContent = 'No Agents Available';
            defaultOption.disabled = true;
            this.agentSelect.appendChild(defaultOption);
            console.warn("ChatApp: No agents loaded from the backend.");
            return;
        }

        this.agents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent.id; // Assuming agent object has an 'id'
            option.textContent = agent.name || `Agent ${agent.id}`; // Use name or fallback to ID
            this.agentSelect.appendChild(option);
        });

        // Set default selection
        const defaultAgent = this.agents.find(a => a.id === this.selectedAgentId) || this.agents[0];
        if (defaultAgent) {
            this.selectedAgentId = defaultAgent.id;
            this.agentSelect.value = this.selectedAgentId;
        }
    }

    // --- Event Listeners Setup ---
    setupEventListeners() {
        console.log("ChatApp: Setting up event listeners...");

        // Send Button and Enter Key
        if (this.sendButton && this.messageInput) {
            this.sendButton.addEventListener('click', this.handleSend);
            this.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); // Prevent default newline
                    this.handleSend();
                }
            });
            // Auto-resize input textarea
            this.messageInput.addEventListener('input', () => {
                 this.messageInput.style.height = 'auto'; // Reset height
                 this.messageInput.style.height = `${this.messageInput.scrollHeight}px`; // Set to content height
            });
             console.log("ChatApp: Send listeners attached.");
        } else {
            console.warn("ChatApp: Could not attach send listeners (button or input missing).");
        }

        // File Upload
        if (this.uploadButton && this.fileInput) {
            this.uploadButton.addEventListener('click', () => this.fileInput.click()); // Trigger hidden input
            this.fileInput.addEventListener('change', this.handleFileSelection);
            console.log("ChatApp: File upload listeners attached.");
        } else {
            console.warn("ChatApp: Could not attach file upload listeners (button or input missing).");
        }

        // Agent Selection Change
        if (this.agentSelect) {
            this.agentSelect.addEventListener('change', (e) => {
                this.selectedAgentId = e.target.value;
                console.log(`ChatApp: Agent selected: ${this.selectedAgentId}`);
                // Optional: Clear chat, notify backend, display agent info, etc.
                // this.clearChat();
                // this.sendMessageInternal({ type: 'agent_switch', payload: { agent_id: this.selectedAgentId } });
            });
            console.log("ChatApp: Agent select listener attached.");
        } else {
            console.warn("ChatApp: Could not attach agent select listener (element missing).");
        }

        // Scroll Listener (e.g., for loading more messages)
        if (this.messageContainer) {
            this.messageContainer.addEventListener('scroll', this.handleScroll);
            console.log("ChatApp: Scroll listener attached to message container.");
        }
    }

    // --- Message Handling ---
    handleSend() {
        if (!this.messageInput) return;
        const content = this.messageInput.value.trim();

        if (!content && this.attachedFiles.length === 0) {
            this.showError("Cannot send an empty message without attachments.");
            return;
        }

        const messageData = {
            type: 'message', // Standard message type for user input
            payload: {
                 id: generateId(), // Use utility from base.js
                 timestamp: new Date().toISOString(),
                 sender: 'user',
                 agent_id: this.selectedAgentId, // Send currently selected agent
                 content: content,
                 attachments: this.attachedFiles.map(file => ({ // Send file metadata
                     filename: file.name,
                     content_type: file.type,
                     size: file.size
                 }))
                 // Note: Actual file content might need separate upload/handling via WS or HTTP
            }
        };

        // Display user message immediately in the UI
        this.displayMessage(messageData);

        // Send the message via WebSocket
        this.sendMessageInternal(messageData);

        // --- File Upload Logic (Example - adjust as needed) ---
        if (this.attachedFiles.length > 0) {
            this.uploadFiles(this.attachedFiles, messageData.payload.id); // Pass message ID for association
        }
        // --- End File Upload ---

        // Clear input fields after sending
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto'; // Reset textarea height
        this.attachedFiles = []; // Clear internal file list
        this.clearFilePreviews(); // Clear UI previews
        this.messageInput.focus();
        this.scrollToBottom(true); // Force scroll after sending
    }

    // Internal method to send JSON data via WebSocket
    sendMessageInternal(messageObject) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('ChatApp: WebSocket not open. Queuing message:', messageObject);
            this.messageQueue.push(messageObject); // Queue if not connected
            this.showError('Connection unavailable. Message queued.');
            return false; // Indicate message was queued, not sent
        }
        try {
            this.ws.send(JSON.stringify(messageObject));
            // console.log("ChatApp: Sent WS message:", messageObject); // Uncomment for debugging
            return true; // Indicate message sent
        } catch (error) {
            console.error('ChatApp: Failed to send message via WebSocket:', error, messageObject);
            this.showError('Failed to send message.');
            this.messageQueue.unshift(messageObject); // Re-queue at the front on failure
            return false; // Indicate message failed to send
        }
    }

    async processMessageQueue() {
        if (this.isProcessingQueue || this.messageQueue.length === 0) {
            return; // Don't run if already processing or queue is empty
        }
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log("ChatApp: WebSocket not open. Queue processing deferred.");
            return; // Wait for connection
        }

        this.isProcessingQueue = true;
        console.log(`ChatApp: Processing ${this.messageQueue.length} queued messages.`);

        // Process queue FIFO
        while (this.messageQueue.length > 0) {
            if (this.ws.readyState !== WebSocket.OPEN) {
                 console.log("ChatApp: WebSocket closed during queue processing. Pausing.");
                 break; // Stop processing if connection drops
            }
            const messageData = this.messageQueue[0]; // Peek at the first message
            const sentSuccessfully = this.sendMessageInternal(messageData); // Attempt to send

            if (sentSuccessfully) {
                this.messageQueue.shift(); // Remove from queue only if sent successfully
            } else {
                // If sending failed, break the loop to wait for reconnection or fix
                console.warn("ChatApp: Failed to send queued message. Pausing queue processing.");
                break;
            }
            // Optional delay between sending queued messages if needed
            // await new Promise(resolve => setTimeout(resolve, 50));
        }

        this.isProcessingQueue = false;
        console.log("ChatApp: Message queue processing finished.");
    }


    displayMessage(data) {
         console.log("ChatApp: displayMessage called with data:", data); // ADDED: Log data passed to displayMessage
         // Expects data like: { type: 'message', payload: { id, timestamp, sender, agent_id, content, attachments: [...] } }
         // Or potentially flatter structure for agent messages: { type: 'agent_response', id, timestamp, sender, agent_id, content, attachments: [...] }
         console.log("ChatApp: Displaying message:", data);
         if (!this.messageContainer) {
             console.error("ChatApp: Cannot display message, container not found.");
             return;
         }

         const payload = data.payload || data; // Handle nested or flat structure

         // Basic validation of payload
         if (!payload || typeof payload !== 'object' || !payload.sender) {
             console.warn("ChatApp: Cannot display message - invalid payload structure:", payload);
             return;
         }

         const isUser = payload.sender === 'user';
         const templateId = isUser ? 'userMessageTemplate' : 'agentMessageTemplate';
         const template = document.getElementById(templateId);

         if (!template || !template.content) {
             console.error(`ChatApp Error: Message template not found or invalid: #${templateId}`);
             // Fallback: Create elements manually
             this.displayMessageFallback(payload, isUser);
             return;
         }

         try {
             const messageElement = template.content.cloneNode(true).firstElementChild;
             const contentElement = messageElement.querySelector('.message-content'); // Crucial selector

             if (!contentElement) {
                 console.error(`ChatApp Error: Could not find '.message-content' in template #${templateId}`);
                 // Fallback display
                 this.displayMessageFallback(payload, isUser);
                 return;
             }

             // --- Populate Template ---
             // Agent Name (for agent messages)
             if (!isUser) {
                 const agentNameElement = messageElement.querySelector('.message-header strong');
                 if (agentNameElement) {
                      const agent = this.agents.find(a => a.id === payload.agent_id);
                      agentNameElement.textContent = agent?.name || payload.agent_name || payload.agent_id || 'AI Assistant';
                 }
                 // Add agent avatar/icon later if needed
             }

             // Message Content
             contentElement.innerHTML = ''; // Clear template placeholder
             if (payload.content && typeof payload.content === 'string') {
                 const formattedContentDiv = this.formatMessageContent(payload.content);
                 contentElement.appendChild(formattedContentDiv);
             } else {
                 console.warn("ChatApp: Message payload has no text content:", payload);
                 // Optionally display a placeholder like "[empty message]"
             }

            // Attachments Display
             const attachments = payload.attachments || [];
             if (attachments.length > 0) {
                 const attachmentsDiv = document.createElement('div');
                 attachmentsDiv.className = 'message-attachments mt-2';
                 attachments.forEach(file => {
                     const fileDiv = document.createElement('div');
                     fileDiv.className = 'attachment-item d-inline-flex align-items-center border rounded p-1 me-2 mb-1 bg-light small';
                     // Basic display with icon, filename, size
                     const iconClass = this.getIconForMimeType(file.content_type);
                     fileDiv.innerHTML = `<i class="bi ${iconClass} me-1"></i> ${sanitizeInput(file.filename)} (${this.formatFileSize(file.size || 0)})`;
                     // Optional: Make clickable if there's a download URL or preview action
                     attachmentsDiv.appendChild(fileDiv);
                 });
                 contentElement.appendChild(attachmentsDiv);
             }
             // --- End Populate ---

             console.log("ChatApp: Appending message element to container...");
             this.messageContainer.appendChild(messageElement);
             console.log("ChatApp: Message element appended. Calling scrollToBottom...");
             this.scrollToBottom();

         } catch (error) {
             console.error("ChatApp: Error creating message element from template:", error);
             this.displayMessageFallback(payload, isUser); // Attempt fallback
         }
     }

     // Fallback message display if templates fail
     displayMessageFallback(payload, isUser) {
         console.warn("ChatApp: Using fallback message display for:", payload);
         const messageDiv = document.createElement('div');
         messageDiv.className = `message ${isUser ? 'user-message' : 'agent-message'} border rounded p-2 mb-2`;
         let contentHTML = '';
         if (!isUser) {
              const agent = this.agents.find(a => a.id === payload.agent_id);
              contentHTML += `<div class="message-header mb-1 small text-muted"><strong>${agent?.name || payload.agent_id || 'AI'}</strong></div>`;
         }
         contentHTML += `<div>${this.formatMessageContent(payload.content || '[empty message]').innerHTML}</div>`;

         // Basic attachment display fallback
         const attachments = payload.attachments || [];
          if (attachments.length > 0) {
              contentHTML += '<div class="message-attachments mt-2 small text-muted">';
              attachments.forEach(file => {
                  contentHTML += `<div><i class="bi bi-paperclip me-1"></i> ${sanitizeInput(file.filename)}</div>`;
              });
              contentHTML += '</div>';
          }

         messageDiv.innerHTML = contentHTML;
         console.log("ChatApp: Appending fallback message element to container...");
         this.messageContainer.appendChild(messageDiv);
         console.log("ChatApp: Fallback message element appended. Calling scrollToBottom...");
         this.scrollToBottom();
     }


    // Helper to format message content (handles basic markdown, code blocks, sanitization)
    formatMessageContent(content) {
        const outerDiv = document.createElement('div');
        if (typeof content !== 'string') return outerDiv; // Return empty div if content isn't string

        // 1. Sanitize FIRST to prevent HTML injection
        let sanitizedContent = sanitizeInput(content); // Use function from base.js

        // 2. Handle Code Blocks (```lang\ncode\n```) - needs careful parsing
        //    Replace with <pre><code class="language-lang">...</code></pre>
        //    This requires a more robust parser, potentially a library like Marked.js or highlight.js
        //    Basic placeholder replacement:
        sanitizedContent = sanitizedContent.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const languageClass = lang ? `language-${lang}` : '';
            // Re-sanitize code content *within* the block to prevent escaped HTML issues
            const sanitizedCode = sanitizeInput(code);
            return `<pre><code class="${languageClass}">${sanitizedCode}</code></pre>`;
        });
         // Handle inline code `code`
        sanitizedContent = sanitizedContent.replace(/`([^`]+)`/g, '<code>$1</code>');


        // 3. Handle Basic Markdown AFTER code blocks
        sanitizedContent = sanitizedContent
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/\*(.*?)\*/g, '<em>$1</em>');       // Italics

        // 4. Convert newlines to <br> AFTER other formatting
        sanitizedContent = sanitizedContent.replace(/\n/g, '<br>');

        outerDiv.innerHTML = sanitizedContent;
        return outerDiv;
    }


    // --- File Handling ---
    handleFileSelection(event) {
        if (!this.fileInput || !event.target.files) return;
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        // TODO: Add file size/type validation here if needed
        const maxFileSize = 10 * 1024 * 1024; // Example: 10 MB limit
        const allowedTypes = ['image/jpeg', 'image/png', 'text/plain', 'application/pdf']; // Example allowed types

        const validFiles = files.filter(file => {
             if (file.size > maxFileSize) {
                 this.showError(`File "${file.name}" exceeds the size limit of ${this.formatFileSize(maxFileSize)}.`);
                 return false;
             }
            // if (!allowedTypes.includes(file.type)) {
            //     this.showError(`File type "${file.type}" for "${file.name}" is not allowed.`);
            //     return false;
            // }
            // Avoid duplicates
             if (this.attachedFiles.some(f => f.name === file.name && f.size === file.size)) {
                console.warn(`File "${file.name}" is already attached.`);
                return false;
             }
             return true;
         });


        // Add valid files to the internal list
        this.attachedFiles.push(...validFiles);

        // Update UI previews
        this.displayFilePreviews();

        // Clear the input value so the same file can be selected again if removed and re-added
        this.fileInput.value = '';
    }

    displayFilePreviews() {
        if (!this.filePreviewContainer) return;
        this.filePreviewContainer.innerHTML = ''; // Clear existing previews

        if (this.attachedFiles.length === 0) {
            this.filePreviewContainer.style.display = 'none';
            return;
        }

        this.filePreviewContainer.style.display = 'flex'; // Show the container

        const template = document.getElementById('filePreviewTemplate');
        if (!template || !template.content) {
            console.error("ChatApp Error: File preview template ('filePreviewTemplate') not found or invalid.");
            // Fallback preview display
            this.attachedFiles.forEach(file => {
                 const fallbackPreview = document.createElement('div');
                 fallbackPreview.className = 'file-preview-item border rounded p-1 me-2 mb-1 bg-light small';
                 fallbackPreview.textContent = `${file.name}`;
                 const removeBtn = document.createElement('button');
                 removeBtn.className = 'btn-close btn-sm ms-2';
                 removeBtn.onclick = () => this.removeAttachedFile(file.name);
                 fallbackPreview.appendChild(removeBtn);
                 this.filePreviewContainer.appendChild(fallbackPreview);
            });
            return;
        }

        this.attachedFiles.forEach(file => {
            try {
                const previewElement = template.content.cloneNode(true).firstElementChild;
                const filenameElement = previewElement.querySelector('.filename');
                const removeButton = previewElement.querySelector('.remove-file'); // Assumes button has this class

                if (filenameElement) {
                     filenameElement.textContent = file.name;
                     // Optionally add file size: filenameElement.textContent += ` (${this.formatFileSize(file.size)})`;
                } else {
                     console.warn("Template missing '.filename' element.");
                     previewElement.textContent = file.name; // Fallback
                }

                if (removeButton) {
                    // Use an anonymous function to ensure correct 'this' and pass filename
                    removeButton.onclick = () => this.removeAttachedFile(file.name);
                } else {
                     console.warn("Template missing '.remove-file' button.");
                     // Add fallback remove button
                     const fallbackRemoveBtn = document.createElement('button');
                     fallbackRemoveBtn.className = 'btn-close btn-sm ms-2';
                     fallbackRemoveBtn.onclick = () => this.removeAttachedFile(file.name);
                     previewElement.appendChild(fallbackRemoveBtn);
                }

                this.filePreviewContainer.appendChild(previewElement);
            } catch (error) {
                console.error("ChatApp: Error creating file preview from template:", error);
            }
        });
    }

    // Renamed from removeFilePreview for clarity
    removeAttachedFile(fileName) {
        this.attachedFiles = this.attachedFiles.filter(file => file.name !== fileName);
        this.displayFilePreviews(); // Refresh the UI previews
    }

    clearFilePreviews() {
        if (this.filePreviewContainer) {
            this.filePreviewContainer.innerHTML = '';
            this.filePreviewContainer.style.display = 'none';
        }
    }

    // Example File Upload Function (Adapt based on backend requirements)
    async uploadFiles(files, associatedMessageId) {
        console.log(`ChatApp: Uploading ${files.length} files for message ${associatedMessageId}...`);
        // This needs a backend endpoint (e.g., /api/upload)
        // For simplicity, this example doesn't implement the actual upload network request
        // You would typically use FormData and fetch/apiCall here.

        // Example: Iterate and potentially send one by one or as a batch
        for (const file of files) {
            console.log(` -> Simulating upload for: ${file.name}`);
            // const formData = new FormData();
            // formData.append('file', file);
            // formData.append('message_id', associatedMessageId);
            // formData.append('agent_id', this.selectedAgentId);
            //
            // try {
            //     const response = await fetch('/api/upload', { // Replace with actual endpoint
            //         method: 'POST',
            //         body: formData,
            //         headers: {
            //             // Add auth headers if needed (e.g., 'X-API-Key': API_CONFIG.BACKEND_KEY)
            //         }
            //     });
            //     if (!response.ok) {
            //         throw new Error(`Upload failed for ${file.name}: ${response.statusText}`);
            //     }
            //     const result = await response.json();
            //     console.log(`   Upload success for ${file.name}:`, result);
            //     // Optionally update UI or send WS message confirming upload
            // } catch (error) {
            //     console.error(`   Upload failed for ${file.name}:`, error);
            //     this.showError(`Failed to upload file: ${file.name}`);
            //     // Handle upload failure - maybe remove from UI preview?
            // }
        }
        console.log("ChatApp: File upload process completed (simulation).");
    }


    // --- UI Helpers ---
    scrollToBottom(force = false) {
        if (!this.messageContainer) return;
        const scrollThreshold = 150; // How close to bottom (pixels) to trigger auto-scroll
        const isNearBottom = this.messageContainer.scrollHeight - this.messageContainer.scrollTop - this.messageContainer.clientHeight < scrollThreshold;

        // Scroll if forced (e.g., after user sends) or if the user is already near the bottom when a message arrives.
        if (force || isNearBottom) {
            // Use setTimeout to ensure scrollHeight is updated after DOM manipulation
            setTimeout(() => {
                 // Calculate the maximum scroll position to show the bottom of the content
                 const targetScrollTop = this.messageContainer.scrollHeight - this.messageContainer.clientHeight;
                 // Ensure targetScrollTop is not negative (can happen if content height is less than container height)
                 const finalScrollTop = Math.max(0, targetScrollTop);

                 this.messageContainer.scrollTo({
                     top: finalScrollTop, // Scroll to the calculated bottom position
                     behavior: force ? 'smooth' : 'auto' // Smooth scroll for user send, auto for incoming
                 });
            }, 0); // Delay of 0 pushes to end of execution queue
        }
    }

    handleScroll() {
        if (!this.messageContainer) return;
        // Example: Load more messages when scrolled near the top
        if (this.messageContainer.scrollTop < 50) { // Threshold for loading more
            // console.log("ChatApp: Scrolled near top - potentially load more messages.");
            // this.loadMoreMessages(); // TODO: Implement if needed
        }
    }

    showError(message) {
        console.error("ChatApp Error:", message);
        // Use the showToast function (assumed global or imported from base.js)
        if (typeof showToast === 'function') {
            showToast(message, 'danger', 8000); // Show as danger (red), 8 seconds duration
        } else {
            alert(`Error: ${message}`); // Fallback to basic alert
        }
    }

    formatFileSize(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

     getIconForMimeType(mimeType) {
         if (!mimeType) return 'bi-file-earmark'; // Default icon
         if (mimeType.startsWith('image/')) return 'bi-file-earmark-image';
         if (mimeType.startsWith('audio/')) return 'bi-file-earmark-music';
         if (mimeType.startsWith('video/')) return 'bi-file-earmark-play';
         if (mimeType === 'application/pdf') return 'bi-file-earmark-pdf';
         if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'bi-file-earmark-zip';
         if (mimeType.startsWith('text/')) return 'bi-file-earmark-text';
         if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'bi-file-earmark-spreadsheet';
         if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'bi-file-earmark-slides';
         if (mimeType.includes('word') || mimeType.includes('document')) return 'bi-file-earmark-word';
         return 'bi-file-earmark'; // Default fallback
     }

    // --- Context Panel Handling ---
     initializeContextPanelPlaceholders() {
         this.setContextPlaceholder('thoughtTree', '<i class="bi bi-diagram-3 fs-4"></i><p class="mt-2 mb-0 small">Reasoning steps will appear here.</p>');
         this.setContextPlaceholder('toolUsage', '<i class="bi bi-tools fs-4"></i><p class="mt-2 mb-0 small">Tool usage details will show here.</p>');
     }

     setContextPlaceholder(containerId, htmlContent) {
         const container = document.getElementById(containerId);
         if (container) {
             container.innerHTML = `<div class="context-placeholder text-muted text-center p-3">${htmlContent}</div>`;
         } else {
              console.warn(`ChatApp: Context container #${containerId} not found.`);
         }
     }

     clearContextPlaceholder(containerId) {
         const container = document.getElementById(containerId);
         const placeholder = container?.querySelector('.context-placeholder');
         if (placeholder) {
             container.innerHTML = ''; // Clear the placeholder content
         }
     }

     addReasoningStep(stepData) {
         if (!this.reasoningContainer) return;
         // console.log("ChatApp: Adding reasoning step:", stepData);

         // Expect stepData like { description: "...", type: "thinking/tool/final" } or just a string
         const description = typeof stepData === 'string' ? stepData : (stepData.description || stepData.step || '');
         const type = typeof stepData === 'object' ? stepData.type : 'thinking'; // Default type

         if (!description) {
             console.warn("ChatApp: Received reasoning step with no description:", stepData);
             return;
         }

         const stepElement = document.createElement('div');
         stepElement.className = 'reasoning-step mb-2 p-2 border rounded bg-light-subtle small d-flex align-items-start';

         // Choose icon based on type
         let iconClass = 'bi-arrow-right-circle'; // Default
         if (type === 'thinking' || type === 'step') iconClass = 'bi-gear';
         if (type === 'tool_call') iconClass = 'bi-tools';
         if (type === 'error') iconClass = 'bi-exclamation-diamond text-danger';
         if (type === 'final_answer' || type === 'success') iconClass = 'bi-check-circle text-success';

         // Sanitize description before inserting
         stepElement.innerHTML = `<i class="bi ${iconClass} me-2 mt-1"></i> <div>${sanitizeInput(description)}</div>`;

         this.reasoningContainer.appendChild(stepElement);
         this.scrollContextPanel(this.reasoningContainer); // Scroll context panel to show new step
     }

     addToolUsage(toolData) {
         if (!this.toolContainer) return;
         // console.log("ChatApp: Adding tool usage:", toolData);

         // Expect toolData like { tool_name: "...", input: {...}, output: {...}, status: "success/failure" }
         if (!toolData || typeof toolData !== 'object' || !toolData.tool_name) {
              console.warn("ChatApp: Invalid tool usage data received:", toolData);
              return;
         }

         const toolElement = document.createElement('div');
         toolElement.className = 'tool-usage-item mb-2 p-2 border rounded bg-light-subtle small';

         const statusClass = toolData.status === 'success' ? 'text-success' : (toolData.status === 'failure' ? 'text-danger' : 'text-muted');
         const statusIcon = toolData.status === 'success' ? 'bi-check-circle-fill' : (toolData.status === 'failure' ? 'bi-x-octagon-fill' : 'bi-question-circle-fill');

         // Use pre/code for input/output if they are complex objects/strings
         const formatToolData = (data) => {
             if (data === null || data === undefined) return '<span class="text-muted">N/A</span>';
             const content = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
             // Sanitize before putting inside pre/code
             return `<pre class="tool-data bg-light p-1 rounded small m-0"><code>${sanitizeInput(content)}</code></pre>`;
         };

         toolElement.innerHTML = `
             <div class="d-flex justify-content-between align-items-center mb-1">
                 <span><i class="bi bi-tools me-1"></i> <strong>${sanitizeInput(toolData.tool_name)}</strong></span>
                 ${toolData.status ? `<span class="${statusClass} small"><i class="bi ${statusIcon} me-1"></i> ${toolData.status}</span>` : ''}
             </div>
             ${toolData.input !== undefined ? `<div class="mt-1"><strong>Input:</strong> ${formatToolData(toolData.input)}</div>` : ''}
             ${toolData.output !== undefined ? `<div class="mt-1"><strong>Output:</strong> ${formatToolData(toolData.output)}</div>` : ''}
             ${toolData.error ? `<div class="mt-1 text-danger"><strong>Error:</strong> ${formatToolData(toolData.error)}</div>` : ''}
         `;

         this.toolContainer.appendChild(toolElement);
         this.scrollContextPanel(this.toolContainer); // Scroll context panel
     }

     scrollContextPanel(container) {
         if (container && container.parentElement) {
             // Scroll the parent element (which should have overflow enabled)
             requestAnimationFrame(() => {
                 container.parentElement.scrollTo({
                     top: container.scrollHeight,
                     behavior: 'smooth'
                 });
             });
         }
     }

    // --- Typing Indicators ---
    handleTypingIndicator(data) {
        // Expect data like { agent_id: "...", is_typing: true/false }
        if (typeof data !== 'object' || data === null || typeof data.is_typing === 'undefined') {
             console.warn("ChatApp: Invalid typing indicator data:", data);
             return;
        }
        const agentId = data.agent_id || 'default_agent';
        const agent = this.agents.find(a => a.id === agentId);
        const agentName = agent?.name || agentId || 'AI Assistant';

        if (data.is_typing) {
            this.showTyping(agentName);
        } else {
            this.hideTyping();
        }
    }

     showTyping(agentName = 'AI Assistant') {
        // Create typing indicator dynamically if it doesn't exist or is hidden
        if (!this.typingIndicator || this.typingIndicator.style.display === 'none') {
             if (!this.typingIndicator) {
                 this.typingIndicator = document.createElement('div');
                 this.typingIndicator.id = 'typingIndicator';
                 this.typingIndicator.className = 'message agent-message typing-indicator'; // Use same classes as agent message for styling
                 // Inner structure based on agent message template for consistency
                 this.typingIndicator.innerHTML = `
                     <div class="message-header">
                         <div class="message-avatar"><i class="bi bi-robot"></i></div>
                         <strong>${sanitizeInput(agentName)}</strong>
                     </div>
                     <div class="message-content">
                         <div class="dots"><span></span><span></span><span></span></div>
                     </div>
                 `;
                 if (this.messageContainer) {
                     this.messageContainer.appendChild(this.typingIndicator);
                 } else {
                     console.error("ChatApp: Cannot add typing indicator - message container not found.");
                     return; // Don't try to show if container missing
                 }
             } else {
                  // Update agent name if indicator already exists but is hidden
                  const agentNameElement = this.typingIndicator.querySelector('strong');
                  if (agentNameElement) agentNameElement.textContent = sanitizeInput(agentName);
             }
             this.typingIndicator.style.display = 'flex'; // Show it (use flex if messages use flex layout)
             this.scrollToBottom(true); // Scroll to make it visible
        } else {
             // If already visible, just update the name potentially
             const agentNameElement = this.typingIndicator.querySelector('strong');
             if (agentNameElement && agentNameElement.textContent !== agentName) {
                 agentNameElement.textContent = sanitizeInput(agentName);
             }
        }
     }

     hideTyping() {
        if (this.typingIndicator) {
            this.typingIndicator.style.display = 'none'; // Hide instead of removing
        }
     }

     // --- Status & Error Handling from WS ---
     handleStatusUpdate(data) {
         console.log("ChatApp: Status update received:", data);
         // Example: Update agent status indicators if they exist in the UI
         // Example: Display informational messages using showToast (from base.js)
         if (data.message) {
              showToast(data.message, 'info', 5000);
         }
     }

     handleError(data) {
         console.error("ChatApp: Error message received via WebSocket:", data);
         const errorMessage = data.message || data.error || 'An unknown error occurred on the server.';
         this.showError(`Server Error: ${errorMessage}`);
         // Could potentially add reasoning step for the error:
         // this.addReasoningStep(`Server error: ${errorMessage}`, 'error');
     }


    // --- Tool Initialization (Placeholder) ---
    initializeTools() {
        console.log("ChatApp: Initializing tool buttons (placeholder)...");
        // TODO: Fetch available tools from backend (e.g., via API call)
        // or use a predefined list based on agent capabilities.
        // Then, render buttons in the UI (e.g., below the message input).
        // Example structure for a tool button:
        /*
        const toolsContainer = document.getElementById('tool-buttons-container'); // Assume this exists
        if (toolsContainer) {
            const toolButton = document.createElement('button');
            toolButton.className = 'btn btn-sm btn-outline-secondary me-1';
            toolButton.innerHTML = '<i class="bi bi-search me-1"></i> Web Search';
            toolButton.onclick = () => {
                // Action when tool button is clicked (e.g., prefill input)
                if (this.messageInput) {
                    this.messageInput.value = 'Search the web for: ';
                    this.messageInput.focus();
                }
            };
            toolsContainer.appendChild(toolButton);
        }
        */
    }

} // End of ChatApp class

// Initialize the ChatApp only after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check for API_CONFIG again inside the listener for safety, though base.js should load first
    if (typeof API_CONFIG === 'undefined') {
        console.error("FATAL: API_CONFIG not found. DOM loaded, but base.js might be missing or failed.");
        alert("Configuration Error: Cannot initialize chat application.");
    } else {
         window.chatAppInstance = new ChatApp();
         console.log("ChatApp instance created after DOMContentLoaded.");
    }
});

// Example of how to access the instance if needed elsewhere (e.g., from console)
// let app = window.chatAppInstance;