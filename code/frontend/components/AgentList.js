const AgentList = {
    container: null,
    agents: [],

    init() {
        this.container = document.getElementById('agentList');
        this.refresh();
    },

    async refresh() {
        try {
            this.showLoading();
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AGENTS}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.agents = await response.json();
            this.render();
        } catch (err) {
            this.showError(err instanceof Error ? err.message : 'An error occurred');
        }
    },

    showLoading() {
        this.container.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;
    },

    showError(message) {
        this.container.innerHTML = `
            <div class="alert alert-danger" role="alert">
                ${message}
            </div>
        `;
    },

    getStatusColor(status) {
        switch (status) {
            case 'idle': return 'success';
            case 'working': return 'primary';
            case 'error': return 'danger';
            default: return 'secondary';
        }
    },

    render() {
        if (!this.agents.length) {
            this.container.innerHTML = '<div class="text-center text-muted">No agents found</div>';
            return;
        }

        this.container.innerHTML = this.agents.map(agent => `
            <div class="list-group-item list-group-item-action">
                <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1">${agent.name}</h5>
                    <small class="text-${this.getStatusColor(agent.status)}">
                        ${agent.status}
                    </small>
                </div>
                <p class="mb-1">
                    <strong>Role:</strong> ${agent.role}
                </p>
                <p class="mb-1">
                    <strong>Goal:</strong> ${agent.goal}
                </p>
                <div class="mb-1">
                    <strong>Capabilities:</strong>
                    <div class="d-flex flex-wrap gap-1 mt-1">
                        ${agent.capabilities.map(capability => `
                            <span class="badge bg-info">${capability}</span>
                        `).join('')}
                    </div>
                </div>
                <small class="text-muted">
                    Created: ${new Date(agent.created_at).toLocaleString()}
                </small>
            </div>
        `).join('');
    }
}; 