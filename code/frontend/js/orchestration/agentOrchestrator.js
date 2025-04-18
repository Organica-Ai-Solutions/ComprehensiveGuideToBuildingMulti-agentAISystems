import { API_CONFIG, EventBus, EventTypes } from '../base.js';
import { AGENTS, TOOLS } from '../config.js';
import { routeToAgent, validateToolUse, handoffToAgent } from '../agents/manager.js';
import { safetyGuardrails, SafetyLevel } from '../safety/guardrails.js';
import { humanIntervention, InterventionType } from '../feedback/humanIntervention.js';
import interventionPanel from '../intervention.js';

class AgentOrchestrator {
    constructor() {
        this.activeAgent = null;
        this.conversationContext = new Map();
        this.confidenceThreshold = 0.7;
        this.setupEventListeners();
    }

    async processUserMessage(message, context = {}) {
        try {
            // First, check message safety
            const safetyCheck = await safetyGuardrails.checkSafety(message, context);
            if (!safetyCheck.safe) {
                await this.handleSafetyViolation(safetyCheck, message);
                return {
                    success: false,
                    reason: safetyCheck.reason
                };
            }

            // Route message to appropriate agent
            const routing = await routeToAgent(message);
            
            // Check if we need human intervention based on confidence
            if (routing.confidence < this.confidenceThreshold) {
                const intervention = await this.requestRoutingIntervention(routing, message);
                if (!intervention.approved) {
                    return {
                        success: false,
                        reason: 'Routing rejected by human reviewer'
                    };
                }
                // Update routing based on human input
                Object.assign(routing, intervention.updates);
            }

            // Update active agent and context
            this.activeAgent = routing.agentId;
            this.updateConversationContext(routing.agentId, message);

            // Process message with selected agent
            const response = await this.processWithAgent(routing, message);

            return {
                success: true,
                agentId: routing.agentId,
                response
            };
        } catch (error) {
            console.error('Error in message processing:', error);
            return {
                success: false,
                reason: 'Internal processing error'
            };
        }
    }

    async handleToolRequest(toolName, params, context = {}) {
        try {
            // Validate tool usage
            const validation = await validateToolUse(toolName, params);
            if (!validation.allowed) {
                return {
                    success: false,
                    reason: validation.reason
                };
            }

            // Check if tool requires human confirmation
            if (validation.requiresConfirmation) {
                const intervention = await this.requestToolIntervention(toolName, params);
                if (!intervention.approved) {
                    return {
                        success: false,
                        reason: 'Tool usage rejected by human reviewer'
                    };
                }
                // Update params based on human modifications if any
                Object.assign(params, intervention.updates);
            }

            // Execute tool with safety wrapper
            return await this.executeToolSafely(toolName, params);
        } catch (error) {
            console.error('Error in tool request:', error);
            return {
                success: false,
                reason: 'Tool execution error'
            };
        }
    }

    async handleAgentHandoff(fromAgentId, toAgentId, message, context = {}) {
        try {
            // Validate handoff
            const handoffValidation = await this.validateHandoff(fromAgentId, toAgentId);
            if (!handoffValidation.valid) {
                return {
                    success: false,
                    reason: handoffValidation.reason
                };
            }

            // Request human intervention for high-risk handoffs
            if (handoffValidation.riskLevel === 'high') {
                const intervention = await this.requestHandoffIntervention(fromAgentId, toAgentId, message);
                if (!intervention.approved) {
                    return {
                        success: false,
                        reason: 'Handoff rejected by human reviewer'
                    };
                }
            }

            // Perform handoff
            const result = await handoffToAgent(fromAgentId, toAgentId, message, this.conversationContext.get(fromAgentId));
            
            // Update context and active agent
            this.activeAgent = toAgentId;
            this.updateConversationContext(toAgentId, message);

            return {
                success: true,
                handoffId: result.handoffId
            };
        } catch (error) {
            console.error('Error in agent handoff:', error);
            return {
                success: false,
                reason: 'Handoff execution error'
            };
        }
    }

    // Private methods for intervention handling
    async requestRoutingIntervention(routing, message) {
        return await humanIntervention.requestIntervention(InterventionType.AGENT_HANDOFF, {
            message,
            currentAgent: this.activeAgent,
            proposedAgent: routing.agentId,
            confidence: routing.confidence,
            reason: routing.reason
        });
    }

    async requestToolIntervention(toolName, params) {
        const tool = TOOLS[toolName];
        return await humanIntervention.requestIntervention(InterventionType.TOOL_USAGE, {
            tool: {
                name: toolName,
                ...tool
            },
            params,
            purpose: params.purpose || 'Not specified'
        });
    }

    async requestHandoffIntervention(fromAgentId, toAgentId, message) {
        return await humanIntervention.requestIntervention(InterventionType.AGENT_HANDOFF, {
            fromAgent: AGENTS[fromAgentId],
            toAgent: AGENTS[toAgentId],
            message,
            context: this.conversationContext.get(fromAgentId)
        });
    }

    async handleSafetyViolation(safetyCheck, message) {
        // Log violation
        console.warn('Safety violation detected:', safetyCheck);

        // Request human review for borderline cases
        if (safetyCheck.level === SafetyLevel.WARNING) {
            await humanIntervention.requestIntervention(InterventionType.SAFETY_CHECK, {
                message,
                issues: safetyCheck.issues,
                level: safetyCheck.level
            });
        }

        // Emit safety violation event
        EventBus.emit(EventTypes.ERROR_OCCURRED, {
            type: 'safety_violation',
            details: safetyCheck
        });
    }

    // Helper methods
    async validateHandoff(fromAgentId, toAgentId) {
        // Implement handoff validation logic
        const fromAgent = AGENTS[fromAgentId];
        const toAgent = AGENTS[toAgentId];

        if (!fromAgent || !toAgent) {
            return {
                valid: false,
                reason: 'Invalid agent ID'
            };
        }

        // Determine risk level based on agent capabilities
        const riskLevel = this.calculateHandoffRisk(fromAgent, toAgent);

        return {
            valid: true,
            riskLevel
        };
    }

    calculateHandoffRisk(fromAgent, toAgent) {
        // Implement risk calculation logic
        // For now, return 'medium' as default
        return 'medium';
    }

    async processWithAgent(routing, message) {
        // Implement agent processing logic
        // This would call the specific agent's processing function
        return {
            text: 'Agent response placeholder',
            agentId: routing.agentId
        };
    }

    updateConversationContext(agentId, message) {
        if (!this.conversationContext.has(agentId)) {
            this.conversationContext.set(agentId, []);
        }
        this.conversationContext.get(agentId).push({
            timestamp: new Date().toISOString(),
            message
        });
    }

    setupEventListeners() {
        EventBus.on(EventTypes.INTERVENTION_RESPONSE, this.handleInterventionResponse.bind(this));
        EventBus.on(EventTypes.ERROR_OCCURRED, this.handleError.bind(this));
    }

    async handleInterventionResponse(response) {
        // Handle intervention responses
        console.log('Intervention response received:', response);
    }

    handleError(error) {
        // Handle errors
        console.error('Error in orchestrator:', error);
    }

    async executeToolSafely(toolName, params) {
        const tool = TOOLS[toolName];
        if (!tool) {
            throw new Error(`Tool ${toolName} not found`);
        }

        // Create execution context
        const executionContext = {
            startTime: Date.now(),
            toolName,
            params,
            status: 'starting'
        };

        try {
            // Pre-execution safety checks
            await this.preExecutionCheck(tool, params);

            // Set up monitoring
            const monitor = this.setupToolMonitoring(executionContext);

            // Execute tool with timeout
            const result = await Promise.race([
                this.executeToolWithLogging(tool, params, executionContext),
                this.createTimeout(tool.timeout || 30000)
            ]);

            // Stop monitoring
            monitor.stop();

            // Post-execution validation
            await this.postExecutionValidation(tool, result);

            return {
                success: true,
                result,
                metadata: {
                    executionTime: Date.now() - executionContext.startTime,
                    resourceUsage: executionContext.resourceUsage
                }
            };
        } catch (error) {
            // Handle execution error
            await this.handleToolExecutionError(error, executionContext);
            throw error;
        } finally {
            // Cleanup
            await this.cleanupToolExecution(executionContext);
        }
    }

    async preExecutionCheck(tool, params) {
        // Validate resource limits
        const resourceCheck = await this.checkResourceLimits(tool);
        if (!resourceCheck.allowed) {
            throw new Error(`Resource limits exceeded: ${resourceCheck.reason}`);
        }

        // Validate parameters
        const paramValidation = await this.validateToolParameters(tool, params);
        if (!paramValidation.valid) {
            throw new Error(`Invalid parameters: ${paramValidation.reason}`);
        }

        // Check rate limits
        const rateLimit = await this.checkRateLimit(tool);
        if (!rateLimit.allowed) {
            throw new Error(`Rate limit exceeded: ${rateLimit.reason}`);
        }
    }

    setupToolMonitoring(context) {
        const monitor = {
            interval: null,
            stop: () => {
                if (monitor.interval) {
                    clearInterval(monitor.interval);
                    monitor.interval = null;
                }
            }
        };

        // Set up periodic monitoring
        monitor.interval = setInterval(() => {
            const usage = this.getResourceUsage();
            context.resourceUsage = usage;

            // Check if limits are exceeded
            if (this.isResourceLimitExceeded(usage)) {
                monitor.stop();
                throw new Error('Resource limits exceeded during execution');
            }
        }, 1000);

        return monitor;
    }

    async executeToolWithLogging(tool, params, context) {
        // Log execution start
        EventBus.emit(EventTypes.TOOL_EXECUTION_START, {
            tool: tool.name,
            params,
            timestamp: new Date().toISOString()
        });

        try {
            // Execute tool
            context.status = 'executing';
            const result = await tool.execute(params);

            // Log successful execution
            EventBus.emit(EventTypes.TOOL_EXECUTION_COMPLETE, {
                tool: tool.name,
                result,
                executionTime: Date.now() - context.startTime
            });

            return result;
        } catch (error) {
            // Log execution error
            EventBus.emit(EventTypes.TOOL_EXECUTION_ERROR, {
                tool: tool.name,
                error: error.message,
                executionTime: Date.now() - context.startTime
            });
            throw error;
        }
    }

    createTimeout(duration) {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Tool execution timed out after ${duration}ms`));
            }, duration);
        });
    }

    async postExecutionValidation(tool, result) {
        // Validate result format
        if (!this.isValidResultFormat(tool, result)) {
            throw new Error('Tool returned invalid result format');
        }

        // Check for security issues in result
        const securityCheck = await safetyGuardrails.checkSafety(result, {
            context: 'tool_output',
            toolName: tool.name
        });

        if (!securityCheck.safe) {
            throw new Error(`Security check failed: ${securityCheck.reason}`);
        }
    }

    async handleToolExecutionError(error, context) {
        // Log error details
        console.error('Tool execution error:', error);

        // Update execution context
        context.status = 'error';
        context.error = error;

        // Emit error event
        EventBus.emit(EventTypes.ERROR_OCCURRED, {
            type: 'tool_execution_error',
            toolName: context.toolName,
            error: error.message,
            executionContext: context
        });

        // Attempt recovery if possible
        await this.attemptToolRecovery(context);
    }

    async cleanupToolExecution(context) {
        // Release any held resources
        if (context.resourceUsage) {
            await this.releaseResources(context.resourceUsage);
        }

        // Clear any temporary data
        await this.clearTemporaryData(context);

        // Log cleanup completion
        EventBus.emit(EventTypes.TOOL_EXECUTION_CLEANUP, {
            toolName: context.toolName,
            timestamp: new Date().toISOString()
        });
    }

    // Helper methods for tool execution
    async checkResourceLimits(tool) {
        // Implement resource limit checking
        return { allowed: true };
    }

    async validateToolParameters(tool, params) {
        // Implement parameter validation
        return { valid: true };
    }

    async checkRateLimit(tool) {
        // Implement rate limiting
        return { allowed: true };
    }

    getResourceUsage() {
        // Implement resource usage monitoring
        return {
            memory: 0,
            cpu: 0,
            network: 0
        };
    }

    isResourceLimitExceeded(usage) {
        // Implement resource limit checking
        return false;
    }

    isValidResultFormat(tool, result) {
        // Implement result format validation
        return true;
    }

    async attemptToolRecovery(context) {
        // Implement recovery mechanisms
        console.log('Attempting tool recovery:', context);
    }

    async releaseResources(usage) {
        // Implement resource cleanup
        console.log('Releasing resources:', usage);
    }

    async clearTemporaryData(context) {
        // Implement temporary data cleanup
        console.log('Clearing temporary data:', context);
    }
}

// Export singleton instance
const agentOrchestrator = new AgentOrchestrator();
export default agentOrchestrator; 