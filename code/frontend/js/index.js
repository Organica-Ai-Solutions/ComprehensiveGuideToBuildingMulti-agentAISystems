// Only declare API_CONFIG if it doesn't already exist
if (typeof API_CONFIG === 'undefined') {
    // API Configuration
    const API_CONFIG = {
        BASE_URL: 'http://localhost:5001',  // Updated port to match backend
        ENDPOINTS: {
            AGENTS: '/api/agents',
            TASKS: '/api/tasks',
            METRICS: '/api/metrics'
        }
    };
}

// Update system metrics
function updateSystemMetrics() {
    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.METRICS}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('activeAgents').textContent = data.active_agents;
            document.getElementById('activeTasks').textContent = data.active_tasks;
            document.getElementById('systemLoad').textContent = `${data.system_load}%`;
            document.getElementById('responseTime').textContent = `${data.response_time}ms`;
            document.getElementById('successRate').textContent = `${data.success_rate}%`;
            document.getElementById('tasksCompleted').textContent = data.tasks_completed;
            document.getElementById('activeSessions').textContent = data.active_sessions;
        })
        .catch(error => console.error('Error fetching metrics:', error));
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Set up refresh buttons
    document.getElementById('refreshAgents').addEventListener('click', () => {
        AgentList.refresh();
    });

    document.getElementById('refreshTasks').addEventListener('click', () => {
        TaskList.refresh();
    });

    // Set up new task button
    document.getElementById('newTask').addEventListener('click', () => {
        // Implement new task creation logic
        console.log('New task button clicked');
    });

    // Initialize components
    AgentList.init();
    TaskList.init();

    // Update metrics initially and set up periodic updates
    updateSystemMetrics();
    setInterval(updateSystemMetrics, 30000); // Update every 30 seconds
});

// Theme toggling
document.getElementById('themeToggle').addEventListener('click', function() {
    document.body.classList.toggle('dark-mode');
    const icon = this.querySelector('i');
    if (icon.classList.contains('bi-moon-fill')) {
        icon.classList.replace('bi-moon-fill', 'bi-sun-fill');
    } else {
        icon.classList.replace('bi-sun-fill', 'bi-moon-fill');
    }
}); 