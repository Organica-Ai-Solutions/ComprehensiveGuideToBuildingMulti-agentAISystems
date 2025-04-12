document.addEventListener('DOMContentLoaded', () => {
    setupRefreshButton();
    refreshAllData();
    
    // Auto refresh data every 30 seconds
    setInterval(refreshAllData, 30000);
});

// --- API Configuration ---
const API_CONFIG = {
    baseUrl: 'http://localhost:5001/api',
    headers: {
        'Content-Type': 'application/json',
        // Add API key if needed
        // 'X-API-Key': 'your-api-key'
    }
};

// --- Agent Fetching ---
async function fetchAgents() {
    const agentListDiv = document.getElementById('agent-list');
    const apiUrl = 'http://localhost:5001/api/agents'; 

    try {
        console.log(`Fetching agents from: ${apiUrl}`);
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const agents = await response.json();
        displayAgents(agents);
    } catch (error) {
        console.error('Error fetching agents:', error);
        agentListDiv.innerHTML = `
            <div class="alert alert-warning" role="alert">
                <i class="bi bi-exclamation-triangle"></i> Failed to load agents. Is the backend running at ${apiUrl}?
                <button class="btn btn-sm btn-outline-primary mt-2" onclick="fetchAgents()">
                    <i class="bi bi-arrow-clockwise"></i> Retry
                </button>
            </div>`;
    }
}

function displayAgents(agents) {
    const agentListDiv = document.getElementById('agent-list');
    agentListDiv.innerHTML = ''; // Clear loading message

    if (!agents || agents.length === 0) {
        agentListDiv.innerHTML = '<p>No agents found.</p>';
        return;
    }

    agents.forEach(agent => {
        const card = document.createElement('div');
        card.className = 'card agent-card';
        const badgeClass = getStatusBadgeClass(agent.status);
        
        // Create a capabilities string if agent has capabilities
        let capabilitiesHTML = '';
        
        // If API response doesn't include capabilities, create some based on agent role
        const capabilities = agent.capabilities || generateCapabilitiesFromRole(agent.role);
        
        if (capabilities && capabilities.length > 0) {
            capabilitiesHTML = `
                <div class="mt-2">
                    ${capabilities.map(cap => 
                        `<span class="badge bg-info me-1">${cap}</span>`
                    ).join('')}
                </div>
            `;
        }
        
        card.innerHTML = `
            <div class="card-body">
                <span class="badge ${badgeClass} float-end">${agent.status}</span>
                <h5 class="card-title"><i class="bi bi-person-gear"></i> ${agent.name}</h5>
                <h6 class="card-subtitle mb-2 text-muted">Role: ${agent.role}</h6>
                <p class="card-text small">Goal: ${agent.goal || "No specific goal assigned"}</p>
                ${capabilitiesHTML}
                <div class="text-end mt-2">
                    <a href="agent_chat.html?agent=${agent.id}" class="btn btn-sm btn-primary">
                        <i class="bi bi-chat-dots"></i> Chat
                    </a>
                </div>
            </div>
        `;
        agentListDiv.appendChild(card);
    });
}

// Generate capabilities based on agent role if not provided by API
function generateCapabilitiesFromRole(role) {
    const lowerRole = (role || '').toLowerCase();
    
    if (lowerRole.includes('research')) {
        return ['web_search', 'document_analyzer', 'text_summarizer'];
    } else if (lowerRole.includes('writer') || lowerRole.includes('technical')) {
        return ['document_analyzer', 'text_summarizer'];
    } else if (lowerRole.includes('code') || lowerRole.includes('developer')) {
        return ['code_executor', 'calculator'];
    } else {
        return ['document_analyzer']; // Default capability
    }
}

function getStatusBadgeClass(status) {
    switch (status?.toLowerCase()) {
        case 'working':
        case 'active':
        case 'running':
            return 'bg-success';
        case 'idle':
            return 'bg-secondary';
        case 'error':
        case 'failed':
            return 'bg-danger';
        default:
            return 'bg-info'; // Default for unknown statuses
    }
}

// --- Tool Fetching & Display ---
async function fetchTools() {
    const toolListDiv = document.getElementById('tool-list');
    const apiUrl = 'http://localhost:5001/api/tools'; 
    
    try {
        console.log(`Fetching tools from: ${apiUrl}`);
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const tools = await response.json();
        displayTools(tools);
    } catch (error) {
        console.error('Error fetching tools:', error);
        toolListDiv.innerHTML = `
            <div class="alert alert-warning" role="alert">
                <i class="bi bi-exclamation-triangle"></i> Failed to load tools.
            </div>`;
    }
}

function displayTools(tools) {
    const toolListDiv = document.getElementById('tool-list');
    toolListDiv.innerHTML = ''; // Clear existing content
    
    if (!tools || tools.length === 0) {
        toolListDiv.innerHTML = '<p>No tools available.</p>';
        return;
    }
    
    const ul = document.createElement('ul');
    ul.className = 'list-group list-group-flush';

    tools.forEach(tool => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center tool-item';
        
        // Determine usage class based on count
        let usageClass = 'usage-low';
        if (tool.usage_count > 30) {
            usageClass = 'usage-high';
        } else if (tool.usage_count > 20) {
            usageClass = 'usage-medium';
        }
        
        li.innerHTML = `
            <div>
                <i class="bi ${tool.icon || 'bi-gear'}"></i> <strong>${tool.name}</strong>
                <div class="small text-muted">${tool.description}</div>
            </div>
            <span class="badge rounded-pill ${usageClass}" title="Usage count">${tool.usage_count || 0}</span>
        `;
        ul.appendChild(li);
    });

    toolListDiv.appendChild(ul);
}

// --- Context/Memory Display ---
async function fetchAgentMemory() {
    const memoryDiv = document.getElementById('agent-memory');
    // In a real app, fetch from API
    // const apiUrl = `${API_CONFIG.baseUrl}/context/memory`; 
    
    try {
        // For now, use simulated data
        const memory = {
            context: "MCP System Status: All agents operational. Chapter drafting in progress.",
            recent_events: [
                { timestamp: "2023-06-15T10:32:12", description: "ResearchAgent found 3 new papers on ReAct paradigm" },
                { timestamp: "2023-06-15T11:05:44", description: "WriterAgent completed draft of Chapter 1 introduction" },
                { timestamp: "2023-06-15T11:30:01", description: "CodeAgent committed example implementation to repository" }
            ],
            key_facts: [
                "Book outline finalized with 6 chapters",
                "Chapter 1-3 drafts in progress",
                "LangChain and LangGraph selected for code examples"
            ]
        };

        displayAgentMemory(memory);
        updateTimestamp('memory-update-time');
    } catch (error) {
        console.error('Error fetching memory:', error);
        memoryDiv.innerHTML = `
            <div class="alert alert-warning" role="alert">
                <i class="bi bi-exclamation-triangle"></i> Failed to load memory data.
            </div>`;
    }
}

function displayAgentMemory(memory) {
    const memoryDiv = document.getElementById('agent-memory');
    memoryDiv.innerHTML = ''; // Clear existing content
    
    if (!memory) {
        memoryDiv.innerHTML = '<p>No memory data available.</p>';
        return;
    }
    
    // Display context
    if (memory.context) {
        const contextP = document.createElement('p');
        contextP.className = 'mb-3';
        contextP.innerHTML = `<strong>Context:</strong> ${memory.context}`;
        memoryDiv.appendChild(contextP);
    }
    
    // Display key facts if available
    if (memory.key_facts && memory.key_facts.length > 0) {
        const factsDiv = document.createElement('div');
        factsDiv.className = 'mb-3';
        factsDiv.innerHTML = '<strong>Key Facts:</strong>';
        
        const factsList = document.createElement('ul');
        factsList.className = 'mb-0 ps-3 mt-2';
        memory.key_facts.forEach(fact => {
            const li = document.createElement('li');
            li.className = 'mb-1';
            li.textContent = fact;
            factsList.appendChild(li);
        });
        
        factsDiv.appendChild(factsList);
        memoryDiv.appendChild(factsDiv);
    }
    
    // Display recent events if available
    if (memory.recent_events && memory.recent_events.length > 0) {
        const eventsDiv = document.createElement('div');
        eventsDiv.className = 'mt-3';
        eventsDiv.innerHTML = '<strong>Recent Events:</strong>';
        
        const eventsList = document.createElement('div');
        eventsList.className = 'mt-2';
        
        memory.recent_events.forEach(event => {
            const eventDiv = document.createElement('div');
            eventDiv.className = 'recent-event';
            
            const date = new Date(event.timestamp);
            const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            eventDiv.innerHTML = `
                <div>${event.description}</div>
                <small class="timestamp-text">${formattedTime}</small>
            `;
            
            eventsList.appendChild(eventDiv);
        });
        
        eventsDiv.appendChild(eventsList);
        memoryDiv.appendChild(eventsDiv);
    }
}

// --- Decision History / CoT Display ---
async function fetchDecisionHistory() {
    const decisionsDiv = document.getElementById('agent-decisions');
    // In a real app, fetch from API
    // const apiUrl = `${API_CONFIG.baseUrl}/agents/decisions`; 
    
    try {
        // For now, use simulated data
        const decisionHistory = {
            agent_name: "WriterAgent",
            task: "Draft Chapter 4 on ReAct paradigm",
            timestamp: "2023-06-15T14:25:00",
            thought_process: [
                "Task requires understanding of ReAct paradigm fundamentals",
                "Need to include examples of Thought-Action-Observation cycles",
                "Should compare with standard prompting approaches",
                "Need to explain benefits of explicit reasoning",
                "Should include code examples with LangChain integration",
                "Need to structure chapter with clear sections"
            ],
            actions_taken: [
                {
                    action: "retrieve_documents",
                    input: { query: "ReAct paradigm explanation" },
                    result: "Retrieved 3 documents with 95% relevance"
                },
                {
                    action: "analyze_examples",
                    input: { examples: ["web_search", "calculator"] },
                    result: "Example analysis complete, ready for incorporation"
                }
            ],
            final_decision: "Create chapter outline with 6 main sections and 3 code examples"
        };

        displayDecisionHistory(decisionHistory);
        updateTimestamp('decisions-update-time');
    } catch (error) {
        console.error('Error fetching decisions:', error);
        decisionsDiv.innerHTML = `
            <div class="alert alert-warning" role="alert">
                <i class="bi bi-exclamation-triangle"></i> Failed to load decision history.
            </div>`;
    }
}

function displayDecisionHistory(history) {
    const decisionsDiv = document.getElementById('agent-decisions');
    decisionsDiv.innerHTML = ''; // Clear existing content
    
    if (!history) {
        decisionsDiv.innerHTML = '<p>No decision history available.</p>';
        return;
    }
    
    // Create header
    const header = document.createElement('div');
    header.className = 'mb-3';
    
    const date = new Date(history.timestamp);
    const formattedTime = date.toLocaleString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        month: 'short',
        day: 'numeric'
    });
    
    header.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <strong>${history.agent_name}</strong>
            <span class="timestamp-text">${formattedTime}</span>
        </div>
        <div class="text-muted">Task: ${history.task}</div>
    `;
    decisionsDiv.appendChild(header);
    
    // Display thought process
    if (history.thought_process && history.thought_process.length > 0) {
        const thoughtsDiv = document.createElement('div');
        thoughtsDiv.className = 'mb-3';
        thoughtsDiv.innerHTML = '<strong>Reasoning Process:</strong>';
        
        const thoughtsList = document.createElement('ol');
        thoughtsList.className = 'mb-3 ps-3 mt-2';
        
        history.thought_process.forEach(thought => {
            const li = document.createElement('li');
            li.className = 'small mb-1';
            li.textContent = thought;
            thoughtsList.appendChild(li);
        });
        
        thoughtsDiv.appendChild(thoughtsList);
        decisionsDiv.appendChild(thoughtsDiv);
    }
    
    // Display actions if available
    if (history.actions_taken && history.actions_taken.length > 0) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'mb-3';
        actionsDiv.innerHTML = '<strong>Actions:</strong>';
        
        const actionsList = document.createElement('div');
        actionsList.className = 'mt-2 ms-2';
        
        history.actions_taken.forEach(action => {
            const actionDiv = document.createElement('div');
            actionDiv.className = 'mb-2 pb-2 border-bottom';
            
            // Format the input nicely
            let inputStr = '';
            if (typeof action.input === 'object') {
                inputStr = Object.entries(action.input)
                    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                    .join(', ');
            } else {
                inputStr = String(action.input);
            }
            
            actionDiv.innerHTML = `
                <div><span class="text-primary">${action.action}</span></div>
                <div class="small">Input: <span class="text-muted">${inputStr}</span></div>
                <div class="small">Result: <span class="text-success">${action.result}</span></div>
            `;
            
            actionsList.appendChild(actionDiv);
        });
        
        actionsDiv.appendChild(actionsList);
        decisionsDiv.appendChild(actionsDiv);
    }
    
    // Display final decision if available
    if (history.final_decision) {
        const finalDiv = document.createElement('div');
        finalDiv.className = 'mt-3 pt-2 border-top';
        finalDiv.innerHTML = `<strong>Final Decision:</strong><div class="mt-1 text-info">${history.final_decision}</div>`;
        decisionsDiv.appendChild(finalDiv);
    }
}

// --- Refresh Functionality ---
function setupRefreshButton() {
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            refreshButton.disabled = true;
            refreshButton.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i>';
            
            refreshAllData().finally(() => {
                setTimeout(() => {
                    refreshButton.disabled = false;
                    refreshButton.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
                }, 1000);
            });
        });
    }
}

async function refreshAllData() {
    // Update system status
    updateSystemStatus();
    
    // Fetch all data concurrently
    await Promise.all([
        fetchAgents(),
        fetchTools(),
        fetchAgentMemory(),
        fetchDecisionHistory()
    ]);
}

function updateSystemStatus() {
    const statusBadge = document.getElementById('system-status');
    if (!statusBadge) return;
    
    // Check if backend is reachable by pinging a simple endpoint
    fetch('http://localhost:5001/api/agents', { method: 'HEAD' })
        .then(response => {
            if (response.ok) {
                statusBadge.className = 'badge bg-success';
                statusBadge.innerHTML = '<i class="bi bi-broadcast"></i> System Online';
            } else {
                setSystemOffline(statusBadge);
            }
        })
        .catch(() => {
            setSystemOffline(statusBadge);
        });
}

function setSystemOffline(badge) {
    badge.className = 'badge bg-danger';
    badge.innerHTML = '<i class="bi bi-exclamation-triangle"></i> System Offline';
}

function updateTimestamp(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        const now = new Date();
        element.textContent = `Last updated: ${now.toLocaleTimeString()}`;
    }
} 