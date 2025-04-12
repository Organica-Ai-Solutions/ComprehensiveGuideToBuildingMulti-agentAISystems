const TaskList = {
    container: null,
    tasks: [],

    init() {
        this.container = document.getElementById('taskList');
        this.refresh();
    },

    async refresh() {
        try {
            this.showLoading();
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TASKS}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.tasks = await response.json();
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
            case 'completed': return 'success';
            case 'in_progress': return 'primary';
            case 'failed': return 'danger';
            default: return 'secondary';
        }
    },

    render() {
        if (!this.tasks.length) {
            this.container.innerHTML = '<div class="text-center text-muted">No tasks found</div>';
            return;
        }

        this.container.innerHTML = this.tasks.map(task => `
            <div class="list-group-item list-group-item-action">
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">${task.input}</h6>
                    <small class="text-${this.getStatusColor(task.status)}">
                        ${task.status}
                    </small>
                </div>
                <p class="mb-1 small text-muted">
                    Agent: ${task.agent_id}
                </p>
                ${task.result ? `
                    <p class="mb-1 small">
                        Result: ${task.result}
                    </p>
                ` : ''}
                ${task.error ? `
                    <p class="mb-1 small text-danger">
                        Error: ${task.error}
                    </p>
                ` : ''}
                <small class="text-muted">
                    Created: ${new Date(task.created_at).toLocaleString()}
                </small>
            </div>
        `).join('');
    }
}; 