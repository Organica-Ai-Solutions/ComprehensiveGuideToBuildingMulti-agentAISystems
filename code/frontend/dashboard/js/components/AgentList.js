class AgentList {
    constructor() {
        this.agents = [];
        this.container = document.getElementById('agentList');
        this.refreshButton = document.getElementById('refreshAgents');
        this.setupEventListeners();
        this.refreshAgents();
    }

    setupEventListeners() {
        this.refreshButton.addEventListener('click', () => this.refreshAgents());
        // Refresh every 30 seconds
        setInterval(() => this.refreshAgents(), 30000);
    }

    async refreshAgents() {
        try {
            const response = await fetch('http://localhost:8000/api/agents');
            if (!response.ok) throw new Error('Failed to fetch agents');
            
            this.agents = await response.json();
            this.render();
            this.updateSystemMetrics();
        } catch (error) {
            console.error('Error fetching agents:', error);
            this.container.innerHTML = `
                <div class="alert alert-danger">
                    Failed to load agents. Please try again.
                </div>
            `;
        }
    }

    render() {
        if (!this.agents.length) {
            this.container.innerHTML = `
                <div class="text-center text-muted p-3">
                    No agents available
                </div>
            `;
            return;
        }

        this.container.innerHTML = this.agents.map(agent => `
            <div class="agent-item">
                <i class="bi bi-robot agent-icon"></i>
                <div class="flex-grow-1">
                    <h6 class="mb-1">${agent.name}</h6>
                    <small class="text-muted">${agent.type}</small>
                </div>
                <span class="agent-status badge ${this.getStatusClass(agent.status)}">
                    ${agent.status}
                </span>
            </div>
        `).join('');
    }

    getStatusClass(status) {
        const statusClasses = {
            'online': 'bg-success',
            'offline': 'bg-danger',
            'busy': 'bg-warning',
            'idle': 'bg-info'
        };
        return statusClasses[status.toLowerCase()] || 'bg-secondary';
    }

    updateSystemMetrics() {
        const activeAgents = this.agents.filter(agent => agent.status.toLowerCase() === 'online').length;
        document.getElementById('activeAgents').textContent = activeAgents;
        
        // Update system load based on active agents
        const systemLoad = Math.min(Math.round((activeAgents / this.agents.length) * 100), 100);
        document.getElementById('systemLoad').textContent = `${systemLoad}%`;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AgentList();
}); 