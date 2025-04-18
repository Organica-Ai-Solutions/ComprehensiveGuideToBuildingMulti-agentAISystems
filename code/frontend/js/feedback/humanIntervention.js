// Human Intervention and Feedback Module
import { API_CONFIG, EventBus, EventTypes } from '../base.js';
import { SafetyLevel } from '../safety/guardrails.js';

// Intervention types
export const InterventionType = {
    SAFETY_CHECK: 'safety_check',
    TOOL_USAGE: 'tool_usage',
    AGENT_HANDOFF: 'agent_handoff',
    CONTENT_REVIEW: 'content_review',
    ERROR_RESOLUTION: 'error_resolution'
};

// Feedback categories
export const FeedbackCategory = {
    ACCURACY: 'accuracy',
    SAFETY: 'safety',
    RELEVANCE: 'relevance',
    CLARITY: 'clarity',
    EFFICIENCY: 'efficiency'
};

class HumanInterventionManager {
    constructor() {
        this.pendingInterventions = new Map();
        this.feedbackHistory = new Map();
        this.escalationThresholds = new Map();
        this.interventionHandlers = new Map();
        this.CONFIDENCE_THRESHOLD = 0.8;
    }

    // Initialize intervention handlers
    initialize() {
        // Register default handlers
        this.registerInterventionHandler(
            InterventionType.SAFETY_CHECK,
            this.handleSafetyIntervention.bind(this)
        );
        
        this.registerInterventionHandler(
            InterventionType.TOOL_USAGE,
            this.handleToolUsageIntervention.bind(this)
        );
        
        this.registerInterventionHandler(
            InterventionType.AGENT_HANDOFF,
            this.handleHandoffIntervention.bind(this)
        );
        
        this.registerInterventionHandler(
            InterventionType.CONTENT_REVIEW,
            this.handleContentReviewIntervention.bind(this)
        );
        
        this.registerInterventionHandler(
            InterventionType.ERROR_RESOLUTION,
            this.handleErrorResolutionIntervention.bind(this)
        );

        // Set up event listeners
        this.setupEventListeners();
    }

    // Register custom intervention handler
    registerInterventionHandler(type, handler) {
        this.interventionHandlers.set(type, handler);
    }

    // Request human intervention
    async requestIntervention(type, data) {
        try {
            const interventionId = this.generateInterventionId();
            
            const intervention = {
                id: interventionId,
                type,
                data,
                status: 'pending',
                timestamp: new Date().toISOString(),
                priority: this.calculatePriority(type, data)
            };

            this.pendingInterventions.set(interventionId, intervention);

            // Emit intervention request event
            EventBus.emit(EventTypes.INTERVENTION_REQUESTED, intervention);

            // Handle intervention based on type
            const handler = this.interventionHandlers.get(type);
            if (handler) {
                return await handler(intervention);
            } else {
                throw new Error(`No handler registered for intervention type: ${type}`);
            }
        } catch (error) {
            console.error('Error requesting intervention:', error);
            throw error;
        }
    }

    // Handle different types of interventions
    async handleSafetyIntervention(intervention) {
        const { data } = intervention;
        
        // Update intervention status
        intervention.status = 'in_progress';
        
        // Create safety review UI
        this.showSafetyReviewUI(intervention);
        
        return new Promise((resolve) => {
            // Store resolve function to be called when human reviews
            intervention.resolve = resolve;
        });
    }

    async handleToolUsageIntervention(intervention) {
        const { data } = intervention;
        
        // Update intervention status
        intervention.status = 'in_progress';
        
        // Show tool usage confirmation UI
        this.showToolConfirmationUI(intervention);
        
        return new Promise((resolve) => {
            intervention.resolve = resolve;
        });
    }

    async handleHandoffIntervention(intervention) {
        const { data } = intervention;
        
        // Update intervention status
        intervention.status = 'in_progress';
        
        // Show handoff confirmation UI
        this.showHandoffConfirmationUI(intervention);
        
        return new Promise((resolve) => {
            intervention.resolve = resolve;
        });
    }

    async handleContentReviewIntervention(intervention) {
        const { data } = intervention;
        
        // Update intervention status
        intervention.status = 'in_progress';
        
        // Show content review UI
        this.showContentReviewUI(intervention);
        
        return new Promise((resolve) => {
            intervention.resolve = resolve;
        });
    }

    async handleErrorResolutionIntervention(intervention) {
        const { data } = intervention;
        
        // Update intervention status
        intervention.status = 'in_progress';
        
        // Show error resolution UI
        this.showErrorResolutionUI(intervention);
        
        return new Promise((resolve) => {
            intervention.resolve = resolve;
        });
    }

    // UI Components for interventions
    showSafetyReviewUI(intervention) {
        const container = document.createElement('div');
        container.className = 'intervention-container safety-review';
        container.innerHTML = `
            <div class="intervention-header">
                <h3>Safety Review Required</h3>
                <span class="priority-badge ${intervention.priority}">${intervention.priority}</span>
            </div>
            <div class="intervention-content">
                <p>Please review the following content for safety concerns:</p>
                <pre>${intervention.data.content}</pre>
                <div class="safety-issues">
                    ${this.formatSafetyIssues(intervention.data.issues)}
                </div>
            </div>
            <div class="intervention-actions">
                <button class="btn btn-danger" onclick="handleReject('${intervention.id}')">Reject</button>
                <button class="btn btn-warning" onclick="handleModify('${intervention.id}')">Modify</button>
                <button class="btn btn-success" onclick="handleApprove('${intervention.id}')">Approve</button>
            </div>
        `;

        this.showInterventionUI(container);
    }

    showToolConfirmationUI(intervention) {
        const container = document.createElement('div');
        container.className = 'intervention-container tool-confirmation';
        container.innerHTML = `
            <div class="intervention-header">
                <h3>Tool Usage Confirmation</h3>
                <span class="priority-badge ${intervention.priority}">${intervention.priority}</span>
            </div>
            <div class="intervention-content">
                <p>Please confirm the following tool usage:</p>
                <div class="tool-details">
                    <strong>Tool:</strong> ${intervention.data.tool.name}<br>
                    <strong>Action:</strong> ${intervention.data.action}<br>
                    <strong>Parameters:</strong>
                    <pre>${JSON.stringify(intervention.data.params, null, 2)}</pre>
                </div>
            </div>
            <div class="intervention-actions">
                <button class="btn btn-danger" onclick="handleReject('${intervention.id}')">Reject</button>
                <button class="btn btn-warning" onclick="handleModify('${intervention.id}')">Modify</button>
                <button class="btn btn-success" onclick="handleApprove('${intervention.id}')">Approve</button>
            </div>
        `;

        this.showInterventionUI(container);
    }

    // Feedback collection and processing
    async collectFeedback(type, data) {
        try {
            const feedback = {
                type,
                data,
                timestamp: new Date().toISOString()
            };

            // Store feedback
            if (!this.feedbackHistory.has(type)) {
                this.feedbackHistory.set(type, []);
            }
            this.feedbackHistory.get(type).push(feedback);

            // Process feedback
            await this.processFeedback(feedback);

            // Emit feedback event
            EventBus.emit(EventTypes.FEEDBACK_RECEIVED, feedback);

            return true;
        } catch (error) {
            console.error('Error collecting feedback:', error);
            return false;
        }
    }

    async processFeedback(feedback) {
        try {
            // Analyze feedback
            const analysis = await this.analyzeFeedback(feedback);

            // Update performance metrics
            this.updatePerformanceMetrics(analysis);

            // Adjust thresholds if needed
            this.adjustThresholds(analysis);

            return analysis;
        } catch (error) {
            console.error('Error processing feedback:', error);
            throw error;
        }
    }

    // Performance monitoring and improvement
    updatePerformanceMetrics(analysis) {
        // Update metrics based on feedback analysis
        const metrics = {
            timestamp: new Date().toISOString(),
            type: analysis.type,
            score: analysis.score,
            improvements: analysis.improvements
        };

        // Emit metrics update event
        EventBus.emit(EventTypes.METRICS_UPDATED, metrics);
    }

    adjustThresholds(analysis) {
        // Adjust intervention thresholds based on performance
        if (analysis.score < 0.6) {
            // Lower threshold to increase human oversight
            this.CONFIDENCE_THRESHOLD = Math.min(0.9, this.CONFIDENCE_THRESHOLD + 0.1);
        } else if (analysis.score > 0.8) {
            // Gradually increase threshold if performance is good
            this.CONFIDENCE_THRESHOLD = Math.max(0.7, this.CONFIDENCE_THRESHOLD - 0.05);
        }
    }

    // Utility functions
    generateInterventionId() {
        return `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    calculatePriority(type, data) {
        // Calculate priority based on type and data
        switch (type) {
            case InterventionType.SAFETY_CHECK:
                return data.level === SafetyLevel.UNSAFE ? 'high' : 'medium';
            case InterventionType.ERROR_RESOLUTION:
                return 'high';
            case InterventionType.TOOL_USAGE:
                return data.tool.riskLevel === 'high' ? 'high' : 'medium';
            default:
                return 'medium';
        }
    }

    formatSafetyIssues(issues) {
        return issues.map(issue => `
            <div class="safety-issue ${issue.level}">
                <strong>${issue.type}:</strong> ${issue.description}
            </div>
        `).join('');
    }

    showInterventionUI(container) {
        // Find or create intervention panel
        let panel = document.getElementById('intervention-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'intervention-panel';
            document.body.appendChild(panel);
        }

        // Clear existing content and add new intervention
        panel.innerHTML = '';
        panel.appendChild(container);
        panel.style.display = 'block';
    }

    setupEventListeners() {
        // Listen for intervention responses
        EventBus.on(EventTypes.INTERVENTION_RESPONSE, async (response) => {
            const intervention = this.pendingInterventions.get(response.interventionId);
            if (intervention && intervention.resolve) {
                intervention.resolve(response);
                this.pendingInterventions.delete(response.interventionId);
            }
        });
    }

    async analyzeFeedback(feedback) {
        // Implement feedback analysis logic
        return {
            type: feedback.type,
            score: 0.75, // Example score
            improvements: []
        };
    }
}

// Export singleton instance
export const humanIntervention = new HumanInterventionManager();

// Export utility functions
export const requestIntervention = (type, data) => 
    humanIntervention.requestIntervention(type, data);
export const collectFeedback = (type, data) => 
    humanIntervention.collectFeedback(type, data);

// Initialize manager
humanIntervention.initialize(); 