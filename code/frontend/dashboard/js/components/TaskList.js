class TaskList {
    constructor() {
        // Get DOM elements
        this.taskList = document.getElementById('task-list');
        this.refreshButton = document.getElementById('refresh-tasks');
        this.newTaskButton = document.getElementById('new-task');

        // Initialize only if required elements exist
        if (this.taskList) {
            this.setupEventListeners();
            this.refreshTasks();
            
            // Set up periodic refresh
            setInterval(() => this.refreshTasks(), 30000);
        } else {
            console.warn('TaskList: Required DOM elements not found');
        }
    }

    setupEventListeners() {
        if (this.refreshButton) {
            this.refreshButton.addEventListener('click', () => this.refreshTasks());
        }
        if (this.newTaskButton) {
            this.newTaskButton.addEventListener('click', () => this.showNewTaskModal());
        }
    }

    async refreshTasks() {
        try {
            const response = await fetch(`${window.API_CONFIG.BASE_URL}${window.API_CONFIG.ENDPOINTS.TASKS}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const tasks = await response.json();
            this.render(tasks);
            this.updateMetrics(tasks);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            // Show error message in the UI
            if (this.taskList) {
                this.taskList.innerHTML = `
                    <div class="alert alert-danger" role="alert">
                        Failed to load tasks. Please try again later.
                    </div>
                `;
            }
        }
    }

    render(tasks) {
        if (!this.taskList) return;

        this.taskList.innerHTML = '';
        
        if (!tasks || tasks.length === 0) {
            this.taskList.innerHTML = `
                <div class="alert alert-info" role="alert">
                    No tasks available.
                </div>
            `;
            return;
        }

        tasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = `task-item ${this.getStatusClass(task.status)}`;
            taskElement.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <h6 class="mb-1">${task.title}</h6>
                    <span class="badge ${this.getStatusClass(task.status)}">${task.status}</span>
                </div>
                <p class="mb-1">${task.description}</p>
                <small class="text-muted">Created: ${this.formatDate(task.created_at)}</small>
            `;
            this.taskList.appendChild(taskElement);
        });
    }

    getStatusClass(status) {
        const statusClasses = {
            'completed': 'bg-success',
            'in_progress': 'bg-primary',
            'pending': 'bg-warning',
            'failed': 'bg-danger'
        };
        return statusClasses[status] || 'bg-secondary';
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleString();
    }

    updateMetrics(tasks) {
        if (!tasks) return;

        const completedTasks = tasks.filter(task => task.status === 'completed').length;
        const totalTasks = tasks.length;
        const successRate = totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0;

        // Update metrics in the UI if elements exist
        const completedElement = document.getElementById('completed-tasks');
        const successRateElement = document.getElementById('success-rate');

        if (completedElement) {
            completedElement.textContent = completedTasks;
        }
        if (successRateElement) {
            successRateElement.textContent = `${successRate}%`;
        }
    }

    showNewTaskModal() {
        // Implementation for showing new task modal
        console.log('Show new task modal - To be implemented');
    }
}

// Initialize TaskList when DOM is loaded and required scripts are available
document.addEventListener('DOMContentLoaded', () => {
    // Wait for API_CONFIG to be available
    if (window.API_CONFIG) {
        new TaskList();
    } else {
        console.error('TaskList: Required API_CONFIG not found');
    }
}); 