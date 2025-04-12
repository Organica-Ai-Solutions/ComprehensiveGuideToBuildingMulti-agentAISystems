document.addEventListener('DOMContentLoaded', () => {
    loadSelectedAgent();
    setupChat();
    setupAgentSelection();
    updateReasoningTraceVisibility();
    loadReasoningVisibilityPreference();
});

// --- API Configuration ---
const API_CONFIG = {
    baseUrl: 'http://localhost:8001/api',
    headers: {
        'Content-Type': 'application/json',
    }
};

// --- Get Agent ID from URL ---
function getAgentIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('agent') || '2'; // Default to agent ID 2 if not specified
}

// --- Load Selected Agent ---
async function loadSelectedAgent() {
    const agentId = getAgentIdFromURL();
    
    // Select the corresponding agent in the list
    const agentLinks = document.querySelectorAll('#agent-select-list a');
    agentLinks.forEach(link => {
        if (link.dataset.agentId === agentId) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    
    // Load agent info
    updateActiveAgentInfo(agentId);
    
    // Update welcome message agent name
    const welcomeAgentName = document.getElementById('welcome-agent-name');
    if (welcomeAgentName) {
        welcomeAgentName.textContent = document.getElementById('active-agent-name').textContent;
    }
}

// --- Chat Setup ---
function setupChat() {
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatContainer = document.getElementById('chat-container');
    const showReasoningChk = document.getElementById('show-reasoning');
    const typingIndicator = document.getElementById('typing-indicator');

    if (showReasoningChk) {
        showReasoningChk.addEventListener('change', updateReasoningTraceVisibility);
    }

    // Show typing indicator when user is typing
    if (messageInput && typingIndicator) {
        let typingTimer;
        messageInput.addEventListener('input', () => {
            typingIndicator.classList.remove('d-none');
            clearTimeout(typingTimer);
            
            if (messageInput.value.trim() === '') {
                typingIndicator.classList.add('d-none');
            } else {
                typingTimer = setTimeout(() => {
                    typingIndicator.classList.add('d-none');
                }, 3000);
            }
        });
        
        messageInput.addEventListener('blur', () => {
            setTimeout(() => {
                typingIndicator.classList.add('d-none');
            }, 1000);
        });
    }

    // Handle sending messages
    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (messageText === '') return;

        // Add user message to chat
        addUserMessage(messageText);
        
        // Clear input
        messageInput.value = '';
        
        // Hide typing indicator
        if (typingIndicator) {
            typingIndicator.classList.add('d-none');
        }
        
        // Show agent is thinking
        const thinkingId = addThinkingMessage();
        
        // Get active agent
        const activeAgentName = document.getElementById('active-agent-name').textContent;
        
        // Start ReAct process - this would call the backend API in a real implementation
        processReActCycle(messageText, activeAgentName, thinkingId);
    }

    // Handle send button click
    sendButton.addEventListener('click', sendMessage);
    
    // Handle enter key press
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });
}

// --- ReAct Cycle Processing ---
async function processReActCycle(userMessage, agentName, thinkingId) {
    try {
        // This simulates the ReAct processing cycle
        // In a real implementation, this would make API calls to the backend
        
        // 1. First thinking step
        const initialThought = generateInitialThought(userMessage);
        await sleep(1000); // Simulate thinking time
        
        // Update the reasoning trace
        updateReasoningTrace([initialThought]);
        
        // 2. Determine if we need to use a tool
        const toolAction = determineToolAction(userMessage);
        if (toolAction) {
            await sleep(800);
            // Add the tool selection to the reasoning trace
            updateReasoningTrace([
                initialThought,
                `I'll use the ${toolAction.tool} tool to ${toolAction.purpose}`
            ]);
            
            // 3. Execute tool action
            await sleep(1500);
            const observation = await simulateToolExecution(toolAction);
            
            // 4. Process observation
            await sleep(1000);
            const observationThought = `Analyzing result: ${observation.substring(0, 50)}${observation.length > 50 ? '...' : ''}`;
            
            // Update the reasoning trace with the observation analysis
            updateReasoningTrace([
                initialThought,
                `I'll use the ${toolAction.tool} tool to ${toolAction.purpose}`,
                observationThought,
                "Formulating response based on the retrieved information"
            ]);
        } else {
            // If no tool needed, just add reasoning about formulating direct response
            await sleep(1200);
            updateReasoningTrace([
                initialThought,
                "I have sufficient information to answer without using tools",
                "Formulating response based on my knowledge"
            ]);
        }
        
        // 5. Final response
        await sleep(1000);
        
        // Remove thinking message
        const thinkingElement = document.getElementById(thinkingId);
        if (thinkingElement) {
            thinkingElement.remove();
        }
        
        // Generate and add final response
        const response = await generateResponse(userMessage, toolAction);
        addAgentMessage(agentName, response);
    } catch (error) {
        console.error('Error in ReAct cycle:', error);
        
        // Remove thinking message
        const thinkingElement = document.getElementById(thinkingId);
        if (thinkingElement) {
            thinkingElement.remove();
        }
        
        // Add error message
        addAgentMessage(agentName, "I'm sorry, I encountered an error while processing your request. Please try again.");
        
        // Update reasoning trace with error
        updateReasoningTrace([
            "Encountered an error while processing the request",
            `Error: ${error.message}`,
            "Unable to complete the reasoning cycle"
        ]);
    }
}

function generateInitialThought(userMessage) {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('react')) {
        return "User is asking about the ReAct paradigm. I should explain the core concept and components.";
    } else if (lowerMessage.includes('outline')) {
        return "User wants an outline. I should provide a structured chapter outline with main sections.";
    } else if (lowerMessage.includes('compare')) {
        return "User is asking for a comparison. I should identify what needs to be compared and highlight key differences.";
    } else if (lowerMessage.includes('example')) {
        return "User wants examples. I should provide concrete examples that illustrate the concept clearly.";
    } else if (lowerMessage.includes('tool')) {
        return "User is asking about tools. I should explain what tools are available and how they're used in the ReAct paradigm.";
    } else {
        return `Analyzing user query: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`;
    }
}

function determineToolAction(userMessage) {
    const lowerMessage = userMessage.toLowerCase();
    
    // Determine if a tool should be used based on the message content
    if (lowerMessage.includes('search') || lowerMessage.includes('find') || lowerMessage.includes('information about')) {
        return {
            tool: 'web_search',
            purpose: 'find relevant information',
            input: lowerMessage.replace(/search|find|information about/gi, '').trim()
        };
    } else if (lowerMessage.includes('calculate') || lowerMessage.includes('computation') || lowerMessage.match(/[\d\+\-\*\/]/)) {
        return {
            tool: 'calculator',
            purpose: 'perform the calculation',
            input: lowerMessage.replace(/calculate|computation/gi, '').trim()
        };
    } else if (lowerMessage.includes('analyze') || lowerMessage.includes('document') || lowerMessage.includes('chapter')) {
        return {
            tool: 'document_analyzer',
            purpose: 'analyze the document content',
            input: 'chapter_04.md' // Example input
        };
    } else if (lowerMessage.includes('summarize') || lowerMessage.includes('summary')) {
        return {
            tool: 'text_summarizer',
            purpose: 'create a concise summary',
            input: lowerMessage.replace(/summarize|summary/gi, '').trim()
        };
    }
    
    // Return null if no tool is needed
    return null;
}

async function simulateToolExecution(toolAction) {
    // This would be a real API call in an actual implementation
    if (!toolAction) return '';
    
    switch (toolAction.tool) {
        case 'web_search':
            return `Search results for "${toolAction.input}": Found 3 relevant sources discussing ${toolAction.input}. The most recent paper by Smith et al. (2023) provides a comprehensive overview.`;
        
        case 'calculator':
            try {
                // Warning: eval is unsafe in production - this is just for demonstration
                const result = eval(toolAction.input);
                return `Calculation result: ${result}`;
            } catch (error) {
                return `Error in calculation: ${error.message}`;
            }
        
        case 'document_analyzer':
            return `Analysis of ${toolAction.input}: Document contains 163 lines explaining the ReAct paradigm, including code examples and visualizations. Key sections include Introduction, Bridging Reasoning and Action, and Implementation Examples.`;
        
        case 'text_summarizer':
            return `Summary of "${toolAction.input}": The content focuses on ${toolAction.input} as a key concept in AI agent development, highlighting its importance for complex reasoning tasks.`;
        
        default:
            return `Tool ${toolAction.tool} execution completed.`;
    }
}

async function generateResponse(userMessage, toolAction) {
    // Generate a response based on the user message and any tool actions
    const lowerMessage = userMessage.toLowerCase();
    let response = '';
    
    if (toolAction) {
        // If a tool was used, incorporate the tool results in the response
        switch (toolAction.tool) {
            case 'web_search':
                response = `Based on my search about "${toolAction.input}", I found that the most recent research by Smith et al. (2023) describes it as a fundamental concept in modern AI agent architectures. The paper specifically highlights how it enables more robust reasoning compared to traditional approaches.`;
                break;
                
            case 'calculator':
                try {
                    const result = eval(toolAction.input);
                    response = `I calculated ${toolAction.input} and got ${result}. This calculation is relevant because it demonstrates how a ReAct agent can use tools to extend its capabilities beyond just language processing.`;
                } catch (error) {
                    response = `I tried to calculate "${toolAction.input}" but encountered an error: ${error.message}. Could you please provide a valid arithmetic expression?`;
                }
                break;
                
            case 'document_analyzer':
                response = `I analyzed the Chapter 4 document on the ReAct paradigm. The document provides a detailed explanation of how ReAct works, with particular emphasis on the cycle of Thought → Action → Observation. There are code examples using LangChain that demonstrate practical implementation. Would you like me to focus on any particular section?`;
                break;
                
            case 'text_summarizer':
                response = `Here's a summary about "${toolAction.input}": It's a key concept in AI agent development that focuses on combining reasoning capabilities with action-taking. This approach allows agents to interact with their environment more effectively and solve complex problems through a structured process.`;
                break;
                
            default:
                response = `I used the ${toolAction.tool} tool and found relevant information that addresses your question about ${toolAction.input}.`;
        }
    } else {
        // Standard responses without tools
        if (lowerMessage.includes('react')) {
            response = "ReAct stands for Reasoning + Acting. It's a paradigm for AI agents that combines explicit reasoning steps with actions. The agent follows a cycle of:\n\n1. Thought: The agent reasons about the current situation and goal\n2. Action: Based on reasoning, the agent chooses and executes an action\n3. Observation: The agent observes the result of the action\n4. Updated Thought: The agent incorporates the observation into its reasoning\n\nThis cycle continues until the task is completed. The explicit reasoning helps make the agent's decision process transparent and improves its problem-solving capabilities.";
        } else if (lowerMessage.includes('outline')) {
            response = "Here's an outline for a comprehensive chapter on the ReAct paradigm:\n\n1. Introduction to ReAct\n   - Definition and origins\n   - Core principles\n\n2. The ReAct Loop\n   - Thought process\n   - Action selection and execution\n   - Observation processing\n   - Iteration and refinement\n\n3. Benefits and Advantages\n   - Improved reasoning\n   - Enhanced transparency\n   - Better tool utilization\n\n4. Implementation with LangChain/LangGraph\n   - Setting up tools\n   - Crafting effective prompts\n   - Handling the reasoning-action loop\n\n5. Advanced Techniques\n   - Error handling and recovery\n   - Memory and context management\n   - Multi-agent coordination\n\n6. Case Studies and Examples\n   - Complex reasoning tasks\n   - Information retrieval applications\n   - Decision-making scenarios\n\n7. Future Directions\n   - Research opportunities\n   - Emerging applications\n\nWould you like me to elaborate on any specific section?";
        } else if (lowerMessage.includes('compare')) {
            response = "Comparing ReAct with standard prompting approaches:\n\n**Standard Prompting**:\n- Single-step generation\n- Uses only model's internal knowledge\n- Lacks explicit reasoning steps\n- Limited tool use capabilities\n- Reasoning process is opaque\n\n**ReAct Paradigm**:\n- Multi-step reasoning and action cycles\n- Can access external information via tools\n- Explicit thought process is visible\n- Strong tool integration\n- Self-correcting through observation feedback\n\nThe key advantage of ReAct is how it makes the agent's reasoning explicit and allows it to interact with its environment through tools, leading to more robust problem-solving.";
        } else if (lowerMessage.includes('tool')) {
            response = "In the ReAct paradigm, tools are external functions that agents can use to enhance their capabilities. Common tools include:\n\n1. **Search tools**: Allow agents to find information on the web\n2. **Calculators**: Enable precise mathematical operations\n3. **Document analyzers**: Help process and understand document content\n4. **APIs**: Provide access to external services and data\n5. **Code executors**: Run code snippets for computational tasks\n\nTools are crucial because they extend the agent beyond its internal knowledge, allowing it to gather new information and perform specialized tasks. The ReAct loop handles tool use through its Action and Observation steps - the agent decides which tool to use in the Action step and processes the results in the Observation step.";
        } else {
            response = "I'm a ReAct-based agent that can help with your multi-agent AI systems book project. I can explain concepts, draft content, provide examples, and answer questions about AI agent architectures. Is there a specific aspect of the ReAct paradigm or another topic you'd like to explore?";
        }
    }
    
    return response;
}

// --- Add Messages to Chat ---
function addUserMessage(message) {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';
    messageDiv.innerHTML = `
        <div class="message-content">${message}</div>
        <small class="message-timestamp">${timestamp}</small>
    `;
    document.getElementById('chat-container').appendChild(messageDiv);
    scrollChatToBottom();
}

function addThinkingMessage() {
    const activeAgentName = document.getElementById('active-agent-name').textContent;
    const thinkingId = 'thinking-' + Date.now();
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message agent-message';
    messageDiv.id = thinkingId;
    messageDiv.innerHTML = `
        <div class="message-sender">${activeAgentName}</div>
        <div class="message-content thinking">
            <i class="bi bi-arrow-repeat spin"></i> Thinking...
        </div>
    `;
    document.getElementById('chat-container').appendChild(messageDiv);
    scrollChatToBottom();
    return thinkingId;
}

function addAgentMessage(agentName, message) {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message agent-message';
    messageDiv.innerHTML = `
        <div class="message-sender">${agentName}</div>
        <div class="message-content">${formatMessage(message)}</div>
        <small class="message-timestamp">${timestamp}</small>
    `;
    document.getElementById('chat-container').appendChild(messageDiv);
    scrollChatToBottom();
}

function formatMessage(message) {
    // Convert line breaks to HTML
    let formatted = message.replace(/\n/g, '<br>');
    
    // Convert markdown-style bold
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert markdown-style italic
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convert markdown-style code
    formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Convert markdown-style numbered lists
    if (formatted.match(/\d+\.\s.*?<br>/)) {
        const listItems = formatted.match(/\d+\.\s.*?(<br>|$)/g);
        if (listItems) {
            const listItemsHtml = listItems.map(item => 
                `<li>${item.replace(/\d+\.\s/, '').replace(/<br>$/, '')}</li>`
            ).join('');
            const pattern = listItems.join('|').replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1');
            formatted = formatted.replace(new RegExp(pattern, 'g'), '');
            formatted = formatted + '<ol>' + listItemsHtml + '</ol>';
        }
    }
    
    // Convert markdown-style bullet lists
    if (formatted.includes('<br>- ')) {
        const parts = formatted.split('<br>- ');
        const firstPart = parts.shift();
        const listItems = parts.map(item => `<li>${item}</li>`).join('');
        formatted = firstPart + '<ul>' + listItems + '</ul>';
    }
    
    return formatted;
}

function scrollChatToBottom() {
    const chatContainer = document.getElementById('chat-container');
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// --- Update Reasoning Trace ---
function updateReasoningTrace(steps) {
    const reasoningTraceDiv = document.querySelector('.card-body ol');
    if (!reasoningTraceDiv) return;
    
    reasoningTraceDiv.innerHTML = '';
    
    steps.forEach(step => {
        const li = document.createElement('li');
        li.className = 'small';
        li.textContent = step;
        reasoningTraceDiv.appendChild(li);
    });
}

function updateReasoningTraceVisibility() {
    const checkbox = document.getElementById('show-reasoning');
    if (!checkbox) return;
    
    const reasoningSection = document.getElementById('reasoning-trace-section');
    if (!reasoningSection) return;
    
    if (checkbox.checked) {
        reasoningSection.style.display = 'block';
    } else {
        reasoningSection.style.display = 'none';
    }
    
    // Save preference to localStorage
    localStorage.setItem('show_reasoning', checkbox.checked ? 'true' : 'false');
}

// Load reasoning visibility preference
function loadReasoningVisibilityPreference() {
    const checkbox = document.getElementById('show-reasoning');
    if (!checkbox) return;
    
    const savedPreference = localStorage.getItem('show_reasoning');
    if (savedPreference !== null) {
        checkbox.checked = savedPreference === 'true';
        updateReasoningTraceVisibility();
    }
}

// --- Agent Selection ---
function setupAgentSelection() {
    const agentLinks = document.querySelectorAll('#agent-select-list a');
    
    agentLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all links
            agentLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            link.classList.add('active');
            
            // Get agent ID
            const agentId = link.dataset.agentId;
            
            // Update active agent info
            updateActiveAgentInfo(agentId);
            
            // Update URL without reload
            const url = new URL(window.location);
            url.searchParams.set('agent', agentId);
            window.history.pushState({}, '', url);
        });
    });
}

function updateActiveAgentInfo(agentId) {
    const agentData = {
        '1': {
            name: 'Research Agent',
            role: 'Researcher',
            goal: 'Find and analyze information on AI concepts and implementations',
            status: 'Idle',
            capabilities: ['web_search', 'document_analyzer', 'text_summarizer']
        },
        '2': {
            name: 'Writer Agent',
            role: 'Technical Writer',
            goal: 'Draft and refine book chapters with clear explanations',
            status: 'Working',
            capabilities: ['document_analyzer', 'text_summarizer']
        },
        '3': {
            name: 'Code Agent',
            role: 'Developer',
            goal: 'Create and explain code examples that demonstrate concepts',
            status: 'Idle',
            capabilities: ['code_executor', 'calculator']
        }
    };
    
    const agent = agentData[agentId];
    if (!agent) return;
    
    document.getElementById('active-agent-name').textContent = agent.name;
    document.getElementById('active-agent-role').textContent = agent.role;
    document.getElementById('active-agent-goal').textContent = agent.goal;
    
    // Update capabilities if element exists
    const capabilitiesElement = document.getElementById('active-agent-capabilities');
    if (capabilitiesElement && agent.capabilities) {
        capabilitiesElement.innerHTML = '';
        agent.capabilities.forEach(cap => {
            const badge = document.createElement('span');
            badge.className = 'badge bg-info me-1';
            badge.textContent = cap;
            capabilitiesElement.appendChild(badge);
        });
    }
    
    const statusBadge = document.getElementById('active-agent-status');
    statusBadge.textContent = agent.status;
    
    // Update badge color
    statusBadge.className = 'badge';
    if (agent.status === 'Working') {
        statusBadge.classList.add('bg-success');
    } else if (agent.status === 'Idle') {
        statusBadge.classList.add('bg-secondary');
    } else {
        statusBadge.classList.add('bg-info');
    }
}

// --- Utility Functions ---
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
} 