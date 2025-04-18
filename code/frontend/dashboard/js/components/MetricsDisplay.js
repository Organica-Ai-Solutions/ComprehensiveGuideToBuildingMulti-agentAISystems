class MetricsDisplay {
    constructor() {
        this.metrics = {};
        this.charts = {};
        this.setupCharts();
        this.refreshButton = document.getElementById('refreshMetrics');
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.refreshButton.addEventListener('click', () => this.refreshMetrics());
    }

    async refreshMetrics() {
        try {
            const response = await fetch('http://localhost:8000/api/metrics');
            this.metrics = await response.json();
            this.updateDisplays();
        } catch (error) {
            console.error('Failed to fetch metrics:', error);
            const errorAlert = document.getElementById('metricsError');
            if (errorAlert) {
                errorAlert.textContent = 'Failed to fetch metrics. Please try again.';
                errorAlert.classList.remove('d-none');
            }
        }
    }

    setupCharts() {
        // Set up agent performance chart
        const agentCtx = document.getElementById('agentPerformanceChart');
        if (agentCtx) {
            this.charts.agentPerformance = new Chart(agentCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Average Response Time (ms)',
                        data: [],
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        // Set up tool usage chart
        const toolCtx = document.getElementById('toolUsageChart');
        if (toolCtx) {
            this.charts.toolUsage = new Chart(toolCtx, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            'rgba(255, 99, 132, 0.5)',
                            'rgba(54, 162, 235, 0.5)',
                            'rgba(255, 206, 86, 0.5)',
                            'rgba(75, 192, 192, 0.5)',
                            'rgba(153, 102, 255, 0.5)'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'right'
                        }
                    }
                }
            });
        }
    }

    updateDisplays() {
        this.updateSystemMetrics();
        this.updateCharts();
        this.updateSafetyMetrics();
    }

    updateSystemMetrics() {
        const { system } = this.metrics;
        if (!system) return;

        // Update system metrics display
        const elements = {
            totalRequests: document.getElementById('totalRequests'),
            averageResponseTime: document.getElementById('averageResponseTime'),
            successRate: document.getElementById('systemSuccessRate'),
            activeAgents: document.getElementById('activeAgents')
        };

        if (elements.totalRequests) {
            elements.totalRequests.textContent = system.total_requests;
        }
        if (elements.averageResponseTime) {
            elements.averageResponseTime.textContent = `${system.avg_response_time.toFixed(2)}ms`;
        }
        if (elements.successRate) {
            elements.successRate.textContent = `${(system.success_rate * 100).toFixed(1)}%`;
        }
        if (elements.activeAgents) {
            elements.activeAgents.textContent = system.active_agents;
        }
    }

    updateCharts() {
        // Update agent performance chart
        if (this.charts.agentPerformance && this.metrics.agent_performance) {
            const agentData = this.metrics.agent_performance;
            this.charts.agentPerformance.data.labels = Object.keys(agentData);
            this.charts.agentPerformance.data.datasets[0].data = Object.values(agentData);
            this.charts.agentPerformance.update();
        }

        // Update tool usage chart
        if (this.charts.toolUsage && this.metrics.tool_usage) {
            const toolData = this.metrics.tool_usage;
            this.charts.toolUsage.data.labels = Object.keys(toolData);
            this.charts.toolUsage.data.datasets[0].data = Object.values(toolData);
            this.charts.toolUsage.update();
        }
    }

    updateSafetyMetrics() {
        const { safety } = this.metrics;
        if (!safety) return;

        const safetyScore = document.getElementById('safetyScore');
        const safetyIncidents = document.getElementById('safetyIncidents');
        
        if (safetyScore) {
            safetyScore.textContent = `${(safety.score * 100).toFixed(1)}%`;
            // Update color based on score
            const scoreClass = safety.score >= 0.9 ? 'text-success' : 
                             safety.score >= 0.7 ? 'text-warning' : 'text-danger';
            safetyScore.className = `h4 ${scoreClass}`;
        }
        
        if (safetyIncidents) {
            safetyIncidents.textContent = safety.incidents;
        }
    }
}

// Initialize the component
document.addEventListener('DOMContentLoaded', () => {
    const metricsDisplay = new MetricsDisplay();
    metricsDisplay.refreshMetrics(); // Initial load
    
    // Refresh metrics periodically
    setInterval(() => metricsDisplay.refreshMetrics(), 60000); // Every minute
}); 