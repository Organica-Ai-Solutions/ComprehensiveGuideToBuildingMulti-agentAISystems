import { EventBus, EventTypes } from '../base.js';

class MetricsCollector {
    constructor() {
        this.metrics = {
            agents: new Map(),
            tools: new Map(),
            system: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                averageResponseTime: 0,
                safetyViolations: 0,
                interventions: 0
            }
        };

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Agent metrics
        EventBus.on(EventTypes.AGENT_PROCESSING_START, this.handleAgentStart.bind(this));
        EventBus.on(EventTypes.AGENT_PROCESSING_COMPLETE, this.handleAgentComplete.bind(this));
        
        // Tool metrics
        EventBus.on(EventTypes.TOOL_EXECUTION_START, this.handleToolStart.bind(this));
        EventBus.on(EventTypes.TOOL_EXECUTION_COMPLETE, this.handleToolComplete.bind(this));
        EventBus.on(EventTypes.TOOL_EXECUTION_ERROR, this.handleToolError.bind(this));
        
        // Safety metrics
        EventBus.on(EventTypes.ERROR_OCCURRED, this.handleError.bind(this));
        
        // Intervention metrics
        EventBus.on(EventTypes.INTERVENTION_REQUESTED, this.handleInterventionRequest.bind(this));
        EventBus.on(EventTypes.INTERVENTION_RESPONSE, this.handleInterventionResponse.bind(this));
    }

    // Agent metrics handlers
    handleAgentStart(event) {
        const { agentId } = event;
        if (!this.metrics.agents.has(agentId)) {
            this.metrics.agents.set(agentId, {
                totalProcessed: 0,
                successCount: 0,
                failureCount: 0,
                averageProcessingTime: 0,
                lastProcessingTime: null
            });
        }

        const agentMetrics = this.metrics.agents.get(agentId);
        agentMetrics.lastProcessingTime = Date.now();
    }

    handleAgentComplete(event) {
        const { agentId, result } = event;
        const agentMetrics = this.metrics.agents.get(agentId);
        const processingTime = Date.now() - agentMetrics.lastProcessingTime;

        agentMetrics.totalProcessed++;
        agentMetrics.successCount++;
        this.updateAverageTime(agentMetrics, processingTime);

        this.metrics.system.totalRequests++;
        this.metrics.system.successfulRequests++;
    }

    // Tool metrics handlers
    handleToolStart(event) {
        const { tool: toolName } = event;
        if (!this.metrics.tools.has(toolName)) {
            this.metrics.tools.set(toolName, {
                totalExecutions: 0,
                successCount: 0,
                failureCount: 0,
                averageExecutionTime: 0,
                lastExecutionTime: null,
                resourceUsage: {
                    averageCpu: 0,
                    averageMemory: 0,
                    peakCpu: 0,
                    peakMemory: 0
                }
            });
        }

        const toolMetrics = this.metrics.tools.get(toolName);
        toolMetrics.lastExecutionTime = Date.now();
    }

    handleToolComplete(event) {
        const { tool: toolName, executionTime, result } = event;
        const toolMetrics = this.metrics.tools.get(toolName);

        toolMetrics.totalExecutions++;
        toolMetrics.successCount++;
        this.updateAverageTime(toolMetrics, executionTime);

        // Update resource usage metrics if available
        if (result && result.resourceUsage) {
            this.updateResourceMetrics(toolMetrics.resourceUsage, result.resourceUsage);
        }
    }

    handleToolError(event) {
        const { tool: toolName } = event;
        const toolMetrics = this.metrics.tools.get(toolName);
        
        toolMetrics.totalExecutions++;
        toolMetrics.failureCount++;
        
        this.metrics.system.failedRequests++;
    }

    // Safety and intervention metrics handlers
    handleError(event) {
        if (event.type === 'safety_violation') {
            this.metrics.system.safetyViolations++;
        }
    }

    handleInterventionRequest(event) {
        this.metrics.system.interventions++;
    }

    handleInterventionResponse(event) {
        // Could track intervention response times and outcomes here
    }

    // Utility methods
    updateAverageTime(metrics, newTime) {
        const oldTotal = metrics.averageProcessingTime * (metrics.totalProcessed - 1);
        metrics.averageProcessingTime = (oldTotal + newTime) / metrics.totalProcessed;
    }

    updateResourceMetrics(metrics, usage) {
        // Update average CPU usage
        metrics.averageCpu = (metrics.averageCpu + usage.cpu) / 2;
        if (usage.cpu > metrics.peakCpu) {
            metrics.peakCpu = usage.cpu;
        }

        // Update average memory usage
        metrics.averageMemory = (metrics.averageMemory + usage.memory) / 2;
        if (usage.memory > metrics.peakMemory) {
            metrics.peakMemory = usage.memory;
        }
    }

    // Public methods for accessing metrics
    getSystemMetrics() {
        return {
            ...this.metrics.system,
            successRate: this.calculateSuccessRate(
                this.metrics.system.successfulRequests,
                this.metrics.system.totalRequests
            )
        };
    }

    getAgentMetrics(agentId) {
        const metrics = this.metrics.agents.get(agentId);
        if (!metrics) return null;

        return {
            ...metrics,
            successRate: this.calculateSuccessRate(
                metrics.successCount,
                metrics.totalProcessed
            )
        };
    }

    getToolMetrics(toolName) {
        const metrics = this.metrics.tools.get(toolName);
        if (!metrics) return null;

        return {
            ...metrics,
            successRate: this.calculateSuccessRate(
                metrics.successCount,
                metrics.totalExecutions
            )
        };
    }

    getAllMetrics() {
        return {
            system: this.getSystemMetrics(),
            agents: Object.fromEntries(
                Array.from(this.metrics.agents.entries()).map(([id, metrics]) => [
                    id,
                    this.getAgentMetrics(id)
                ])
            ),
            tools: Object.fromEntries(
                Array.from(this.metrics.tools.entries()).map(([name, metrics]) => [
                    name,
                    this.getToolMetrics(name)
                ])
            )
        };
    }

    calculateSuccessRate(successful, total) {
        if (total === 0) return 0;
        return (successful / total) * 100;
    }

    // Reset metrics
    resetMetrics() {
        this.metrics.agents.clear();
        this.metrics.tools.clear();
        this.metrics.system = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            safetyViolations: 0,
            interventions: 0
        };
    }
}

// Export singleton instance
const metricsCollector = new MetricsCollector();
export default metricsCollector; 