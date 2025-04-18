import { EventBus, EventTypes } from '../../base.js';

export class BaseAgentProcessor {
    constructor(agentId) {
        this.agentId = agentId;
        this.metrics = {
            totalProcessed: 0,
            successCount: 0,
            failureCount: 0,
            averageProcessingTime: 0
        };
    }

    async processMessage(message, context = {}) {
        const startTime = Date.now();
        try {
            // Pre-processing hooks
            await this.beforeProcess(message, context);

            // Core processing logic - to be implemented by specific agents
            const result = await this.process(message, context);

            // Post-processing hooks
            const finalResult = await this.afterProcess(result, context);

            // Update metrics
            this.updateMetrics(true, Date.now() - startTime);

            return finalResult;
        } catch (error) {
            // Update failure metrics
            this.updateMetrics(false, Date.now() - startTime);
            throw error;
        }
    }

    // Abstract method to be implemented by specific agents
    async process(message, context) {
        throw new Error('process() must be implemented by specific agent processor');
    }

    // Pre-processing hook
    async beforeProcess(message, context) {
        // Log processing start
        console.log(`[${this.agentId}] Starting message processing`);
        
        // Emit processing start event
        EventBus.emit(EventTypes.AGENT_PROCESSING_START, {
            agentId: this.agentId,
            message,
            timestamp: new Date().toISOString()
        });
    }

    // Post-processing hook
    async afterProcess(result, context) {
        // Log processing completion
        console.log(`[${this.agentId}] Completed message processing`);
        
        // Emit processing complete event
        EventBus.emit(EventTypes.AGENT_PROCESSING_COMPLETE, {
            agentId: this.agentId,
            result,
            timestamp: new Date().toISOString()
        });

        return result;
    }

    // Metrics management
    updateMetrics(success, processingTime) {
        this.metrics.totalProcessed++;
        if (success) {
            this.metrics.successCount++;
        } else {
            this.metrics.failureCount++;
        }

        // Update average processing time
        const oldTotal = this.metrics.averageProcessingTime * (this.metrics.totalProcessed - 1);
        this.metrics.averageProcessingTime = (oldTotal + processingTime) / this.metrics.totalProcessed;

        // Emit metrics update event
        EventBus.emit(EventTypes.METRICS_UPDATED, {
            agentId: this.agentId,
            metrics: this.metrics
        });
    }

    getMetrics() {
        return {
            ...this.metrics,
            successRate: this.metrics.totalProcessed > 0 
                ? (this.metrics.successCount / this.metrics.totalProcessed) * 100 
                : 0
        };
    }
} 