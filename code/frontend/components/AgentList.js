class AgentList {
    constructor() {
        this.container = document.getElementById('agentList');
        this.refreshButton = document.getElementById('refreshAgents');
        this.agents = [];
        
        this.init();
    }

    init() {
        this.refreshButton.addEventListener('click', () => this.refreshAgents());
        this.refreshAgents();
        
        // Auto-refresh every 30 seconds
        setInterval(() => this.refreshAgents(), 30000);
    }

    async refreshAgents() {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AGENTS}`);
            const agents = await response.json();
            this.agents = agents;
            this.render();
        } catch (error) {
            console.error('Error fetching agents:', error);
            this.showError();
        }
    }

    render() {
        if (!this.container) return;
        
        this.container.innerHTML = this.agents.map(agent => `
            <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-0">${agent.name}</h6>
                        <small class="text-muted">${agent.role || 'No role specified'}</small>
                    </div>
                    <div class="d-flex align-items-center">
                        <span class="status-badge ${agent.status.toLowerCase()}">${agent.status}</span>
                        <button class="btn btn-sm btn-link ms-2" onclick="agentList.viewDetails('${agent.id}')">
                            <i class="bi bi-info-circle"></i>
                        </button>
                    </div>
                </div>
                ${this.renderMetrics(agent)}
            </div>
        `).join('');
    }

    renderMetrics(agent) {
        if (!agent.metrics) return '';
        
        return `
            <div class="agent-metrics mt-2">
                <div class="row g-2">
                    <div class="col-6">
                        <small class="d-block text-muted">Success Rate</small>
                        <div class="progress" style="height: 5px;">
                            <div class="progress-bar bg-success" 
                                 style="width: ${agent.metrics.successRate}%" 
                                 role="progressbar"></div>
                        </div>
                    </div>
                    <div class="col-6">
                        <small class="d-block text-muted">Load</small>
                        <div class="progress" style="height: 5px;">
                            <div class="progress-bar bg-primary" 
                                 style="width: ${agent.metrics.load}%" 
                                 role="progressbar"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    showError() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="list-group-item text-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Error loading agents. Please try again.
            </div>
        `;
    }

    viewDetails(agentId) {
        const agent = this.agents.find(a => a.id === agentId);
        if (!agent) return;
        
        // You can implement a modal or redirect to agent details page
        console.log('View details for agent:', agent);
    }
}

// Initialize the agent list
const agentList = new AgentList(); 