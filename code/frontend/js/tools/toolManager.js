// Tool Management Module
import { API_CONFIG, EventBus, EventTypes } from '../base.js';
import { RiskLevel, safetyGuardrails } from '../safety/guardrails.js';

// Tool categories
export const ToolCategory = {
    SYSTEM: 'system',
    DATA: 'data',
    COMMUNICATION: 'communication',
    ANALYSIS: 'analysis'
};

// Tool states
export const ToolState = {
    AVAILABLE: 'available',
    IN_USE: 'in_use',
    DISABLED: 'disabled',
    REQUIRES_AUTH: 'requires_auth'
};

class ToolManager {
    constructor() {
        this.tools = new Map();
        this.toolUsageHistory = new Map();
        this.activeTools = new Set();
        this.toolConfigs = new Map();
    }

    // Initialize tools with configurations
    async initializeTools() {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOOLS}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const tools = await response.json();
            
            tools.forEach(tool => {
                this.registerTool(tool);
            });
            
            return true;
        } catch (error) {
            console.error('Error initializing tools:', error);
            return false;
        }
    }

    // Register a new tool
    registerTool(toolConfig) {
        const tool = {
            ...toolConfig,
            state: ToolState.AVAILABLE,
            usageCount: 0,
            lastUsed: null,
            riskLevel: this.determineRiskLevel(toolConfig)
        };

        this.tools.set(tool.id, tool);
        this.toolConfigs.set(tool.id, this.createToolConfiguration(tool));
        
        console.log(`Tool registered: ${tool.name}`);
    }

    // Request tool usage
    async requestToolUsage(toolId, params, context = {}) {
        try {
            const tool = this.tools.get(toolId);
            if (!tool) {
                throw new Error('Tool not found');
            }

            // Check tool state
            if (tool.state !== ToolState.AVAILABLE) {
                throw new Error(`Tool is ${tool.state}`);
            }

            // Validate tool usage
            const validationResult = await safetyGuardrails.validateToolUsage(
                tool.name,
                JSON.stringify(params),
                context
            );

            if (!validationResult.allowed) {
                this.logToolEvent({
                    toolId,
                    type: 'validation_failed',
                    reason: validationResult.reason,
                    params
                });
                
                throw new Error(validationResult.reason);
            }

            // Handle high-risk tools
            if (tool.riskLevel === RiskLevel.HIGH) {
                if (!context.confirmed) {
                    return {
                        needsConfirmation: true,
                        tool: tool.name,
                        riskLevel: tool.riskLevel,
                        message: 'This tool requires confirmation due to its high-risk nature.'
                    };
                }
            }

            // Update tool state
            tool.state = ToolState.IN_USE;
            this.activeTools.add(toolId);

            // Log tool usage start
            this.logToolUsage(toolId, params, context);

            // Execute tool
            const result = await this.executeTool(tool, params);

            // Update tool state and history
            tool.state = ToolState.AVAILABLE;
            tool.usageCount++;
            tool.lastUsed = new Date();
            this.activeTools.delete(toolId);

            // Log tool usage completion
            this.logToolCompletion(toolId, result);

            return result;
        } catch (error) {
            // Handle error and cleanup
            const tool = this.tools.get(toolId);
            if (tool) {
                tool.state = ToolState.AVAILABLE;
                this.activeTools.delete(toolId);
            }

            this.logToolError(toolId, error);
            throw error;
        }
    }

    // Execute tool operation
    async executeTool(tool, params) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${tool.api_endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(params)
            });

            if (!response.ok) {
                throw new Error(`Tool execution failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error executing tool ${tool.name}:`, error);
            throw error;
        }
    }

    // Tool usage logging and auditing
    logToolUsage(toolId, params, context) {
        const tool = this.tools.get(toolId);
        const usage = {
            timestamp: new Date().toISOString(),
            toolId,
            toolName: tool.name,
            params,
            userId: context.userId,
            status: 'started'
        };

        // Add to usage history
        if (!this.toolUsageHistory.has(toolId)) {
            this.toolUsageHistory.set(toolId, []);
        }
        this.toolUsageHistory.get(toolId).push(usage);

        // Emit event for monitoring
        EventBus.emit(EventTypes.TOOL_USAGE, usage);
    }

    logToolCompletion(toolId, result) {
        const usage = {
            timestamp: new Date().toISOString(),
            toolId,
            status: 'completed',
            result
        };

        // Update last usage record
        const history = this.toolUsageHistory.get(toolId);
        if (history && history.length > 0) {
            history[history.length - 1].completion = usage;
        }

        // Emit completion event
        EventBus.emit(EventTypes.TOOL_USAGE, usage);
    }

    logToolError(toolId, error) {
        const errorLog = {
            timestamp: new Date().toISOString(),
            toolId,
            error: error.message,
            stack: error.stack
        };

        // Update last usage record
        const history = this.toolUsageHistory.get(toolId);
        if (history && history.length > 0) {
            history[history.length - 1].error = errorLog;
        }

        // Emit error event
        EventBus.emit(EventTypes.ERROR_OCCURRED, {
            type: 'tool_error',
            details: errorLog
        });
    }

    logToolEvent(event) {
        console.log('Tool event:', event);
        EventBus.emit(EventTypes.TOOL_USAGE, event);
    }

    // Tool configuration and risk assessment
    createToolConfiguration(tool) {
        return {
            id: tool.id,
            name: tool.name,
            riskLevel: tool.riskLevel,
            requiresAuth: tool.requiresAuth || false,
            rateLimits: {
                maxRequests: 100,
                timeWindow: 3600 // 1 hour
            },
            timeout: 30000, // 30 seconds
            retryConfig: {
                maxRetries: 3,
                backoffFactor: 2
            }
        };
    }

    determineRiskLevel(tool) {
        // Determine risk level based on tool characteristics
        if (tool.systemAccess || tool.databaseAccess) {
            return RiskLevel.HIGH;
        }
        if (tool.networkAccess || tool.fileAccess) {
            return RiskLevel.MEDIUM;
        }
        return RiskLevel.LOW;
    }

    // Utility methods
    getToolById(toolId) {
        return this.tools.get(toolId);
    }

    getToolUsageHistory(toolId) {
        return this.toolUsageHistory.get(toolId) || [];
    }

    getActiveTools() {
        return Array.from(this.activeTools).map(id => this.getToolById(id));
    }

    isToolAvailable(toolId) {
        const tool = this.tools.get(toolId);
        return tool && tool.state === ToolState.AVAILABLE;
    }

    getToolConfiguration(toolId) {
        return this.toolConfigs.get(toolId);
    }
}

// Export singleton instance
export const toolManager = new ToolManager();

// Export utility functions
export const requestTool = (toolId, params, context) => 
    toolManager.requestToolUsage(toolId, params, context);
export const getToolHistory = (toolId) => 
    toolManager.getToolUsageHistory(toolId);
export const getActiveTools = () => 
    toolManager.getActiveTools(); 