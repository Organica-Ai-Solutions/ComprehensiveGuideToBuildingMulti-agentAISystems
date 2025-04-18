class TaskList {
    constructor() {
        this.container = document.getElementById('taskList');
        this.refreshButton = document.getElementById('refreshTasks');
        this.newTaskButton = document.getElementById('newTask');
        this.tasks = [];
        
        this.init();
    }

    init() {
        this.refreshButton.addEventListener('click', () => this.refreshTasks());
        this.newTaskButton.addEventListener('click', () => this.showNewTaskModal());
        this.refreshTasks();
        
        // Auto-refresh every 30 seconds
        setInterval(() => this.refreshTasks(), 30000);
    }

    async refreshTasks() {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TASKS}`);
            const tasks = await response.json();
            this.tasks = tasks;
            this.render();
        } catch (error) {
            console.error('Error fetching tasks:', error);
            this.showError();
        }
    }

    render() {
        if (!this.container) return;
        
        if (this.tasks.length === 0) {
            this.container.innerHTML = `
                <div class="list-group-item text-center text-muted">
                    <i class="bi bi-inbox me-2"></i>
                    No tasks available
                </div>
            `;
            return;
        }
        
        this.container.innerHTML = this.tasks.map(task => `
            <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-0">${task.name}</h6>
                        <small class="text-muted">${task.description || 'No description'}</small>
                    </div>
                    <div class="d-flex align-items-center">
                        <span class="badge ${this.getStatusBadgeClass(task.status)}">
                            ${task.status}
                        </span>
                        <div class="dropdown ms-2">
                            <button class="btn btn-sm btn-link" data-bs-toggle="dropdown">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li>
                                    <a class="dropdown-item" href="#" onclick="taskList.viewDetails('${task.id}')">
                                        <i class="bi bi-info-circle me-2"></i>Details
                                    </a>
                                </li>
                                ${task.status !== 'completed' ? `
                                    <li>
                                        <a class="dropdown-item" href="#" onclick="taskList.cancelTask('${task.id}')">
                                            <i class="bi bi-x-circle me-2"></i>Cancel
                                        </a>
                                    </li>
                                ` : ''}
                            </ul>
                        </div>
                    </div>
                </div>
                ${this.renderProgress(task)}
            </div>
        `).join('');
    }

    renderProgress(task) {
        if (!task.progress && task.progress !== 0) return '';
        
        return `
            <div class="progress mt-2" style="height: 5px;">
                <div class="progress-bar ${this.getProgressBarClass(task.status)}" 
                     role="progressbar" 
                     style="width: ${task.progress}%" 
                     aria-valuenow="${task.progress}" 
                     aria-valuemin="0" 
                     aria-valuemax="100">
                </div>
            </div>
        `;
    }

    getStatusBadgeClass(status) {
        const classes = {
            'pending': 'bg-warning',
            'in_progress': 'bg-primary',
            'completed': 'bg-success',
            'failed': 'bg-danger',
            'cancelled': 'bg-secondary'
        };
        return classes[status] || 'bg-secondary';
    }

    getProgressBarClass(status) {
        const classes = {
            'pending': 'bg-warning',
            'in_progress': 'bg-primary',
            'completed': 'bg-success',
            'failed': 'bg-danger',
            'cancelled': 'bg-secondary'
        };
        return classes[status] || 'bg-primary';
    }

    showError() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="list-group-item text-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Error loading tasks. Please try again.
            </div>
        `;
    }

    showNewTaskModal() {
        // Implement new task modal
        console.log('Show new task modal');
    }

    async viewDetails(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        // Implement task details view
        console.log('View details for task:', task);
    }

    async cancelTask(taskId) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TASKS}/${taskId}/cancel`, {
                method: 'POST'
            });
            
            if (response.ok) {
                await this.refreshTasks();
            } else {
                throw new Error('Failed to cancel task');
            }
        } catch (error) {
            console.error('Error cancelling task:', error);
            // Show error notification
        }
    }
}

// Initialize the task list
const taskList = new TaskList(); 