// Safety and Guardrails Module
import { EventBus, EventTypes } from '../base.js';

// Safety classification levels
export const SafetyLevel = {
    SAFE: 'safe',
    WARNING: 'warning',
    UNSAFE: 'unsafe'
};

// Risk levels for different operations
export const RiskLevel = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high'
};

// Content categories that require special handling
const ContentCategories = {
    CODE_EXECUTION: 'code_execution',
    DATA_ACCESS: 'data_access',
    SYSTEM_OPERATION: 'system_operation',
    EXTERNAL_COMMUNICATION: 'external_communication'
};

// Patterns for detecting potentially unsafe content
const UnsafePatterns = {
    INJECTION: {
        pattern: /({{.*?}}|\${.*?}|<script>|eval\()/i,
        risk: RiskLevel.HIGH,
        category: ContentCategories.CODE_EXECUTION
    },
    SENSITIVE_DATA: {
        pattern: /\b(password|secret|key|token|credential)\b/i,
        risk: RiskLevel.HIGH,
        category: ContentCategories.DATA_ACCESS
    },
    SYSTEM_COMMANDS: {
        pattern: /\b(rm|sudo|chmod|chown|mv|cp|dd)\b/i,
        risk: RiskLevel.HIGH,
        category: ContentCategories.SYSTEM_OPERATION
    },
    DATABASE_OPERATIONS: {
        pattern: /\b(drop|delete|truncate|update|insert)\b/i,
        risk: RiskLevel.MEDIUM,
        category: ContentCategories.DATA_ACCESS
    },
    EXTERNAL_URLS: {
        pattern: /(https?:\/\/[^\s]+)/g,
        risk: RiskLevel.MEDIUM,
        category: ContentCategories.EXTERNAL_COMMUNICATION
    }
};

// Content moderation patterns
const ModerationPatterns = {
    HARMFUL_CONTENT: {
        pattern: /\b(hack|exploit|abuse|attack)\b/i,
        action: 'block'
    },
    INAPPROPRIATE_CONTENT: {
        pattern: /\b(nsfw|explicit|offensive)\b/i,
        action: 'block'
    },
    SUSPICIOUS_BEHAVIOR: {
        pattern: /\b(bypass|circumvent|evade)\b/i,
        action: 'review'
    }
};

class SafetyGuardrails {
    constructor() {
        this.violationCount = new Map();
        this.lastCheck = new Map();
        this.MAX_VIOLATIONS = 3;
        this.VIOLATION_RESET_TIME = 3600000; // 1 hour in milliseconds
    }

    // Main safety check function
    async checkSafety(content, context = {}) {
        try {
            // Reset violation count if enough time has passed
            this.resetViolationsIfNeeded(context.userId);

            // Perform layered safety checks
            const checks = await Promise.all([
                this.checkInputSafety(content),
                this.checkContentModeration(content),
                this.checkContextualSafety(content, context)
            ]);

            // Combine results
            const issues = checks.flatMap(check => 
                check.issues || []);

            if (issues.length > 0) {
                // Increment violation count
                this.incrementViolationCount(context.userId);

                // Check if user has exceeded violation limit
                if (this.hasExceededViolationLimit(context.userId)) {
                    return {
                        safe: false,
                        level: SafetyLevel.UNSAFE,
                        reason: 'Too many safety violations. User actions restricted.',
                        issues
                    };
                }

                // Determine overall safety level
                const highestRisk = this.getHighestRiskLevel(issues);
                return {
                    safe: false,
                    level: this.riskLevelToSafetyLevel(highestRisk),
                    reason: 'Safety check failed',
                    issues
                };
            }

            return {
                safe: true,
                level: SafetyLevel.SAFE,
                issues: []
            };
        } catch (error) {
            console.error('Error in safety check:', error);
            return {
                safe: false,
                level: SafetyLevel.UNSAFE,
                reason: 'Error performing safety check',
                error: error.message
            };
        }
    }

    // Check input against unsafe patterns
    async checkInputSafety(content) {
        const issues = [];

        for (const [name, check] of Object.entries(UnsafePatterns)) {
            if (check.pattern.test(content)) {
                issues.push({
                    type: name,
                    risk: check.risk,
                    category: check.category,
                    description: `Detected potentially unsafe pattern: ${name}`
                });
            }
        }

        return { issues };
    }

    // Check content against moderation rules
    async checkContentModeration(content) {
        const issues = [];

        for (const [type, rule] of Object.entries(ModerationPatterns)) {
            if (rule.pattern.test(content)) {
                issues.push({
                    type,
                    risk: rule.action === 'block' ? RiskLevel.HIGH : RiskLevel.MEDIUM,
                    action: rule.action,
                    description: `Content moderation flag: ${type}`
                });
            }
        }

        return { issues };
    }

    // Check contextual safety based on user history and current state
    async checkContextualSafety(content, context) {
        const issues = [];

        // Check rate limiting
        if (this.isRateLimited(context.userId)) {
            issues.push({
                type: 'RATE_LIMIT',
                risk: RiskLevel.MEDIUM,
                description: 'Too many requests in short time period'
            });
        }

        // Check for escalating risk patterns
        if (this.hasEscalatingRisk(context.userId)) {
            issues.push({
                type: 'ESCALATING_RISK',
                risk: RiskLevel.HIGH,
                description: 'Detected pattern of escalating risk in user behavior'
            });
        }

        return { issues };
    }

    // Validate tool usage safety
    async validateToolUsage(toolName, content, context = {}) {
        try {
            // Get tool configuration and risk level
            const toolConfig = await this.getToolConfiguration(toolName);
            if (!toolConfig) {
                return {
                    allowed: false,
                    reason: 'Tool not found or disabled'
                };
            }

            // Perform safety checks
            const safetyCheck = await this.checkSafety(content, context);
            if (!safetyCheck.safe) {
                return {
                    allowed: false,
                    reason: safetyCheck.reason,
                    issues: safetyCheck.issues
                };
            }

            // Additional tool-specific validation
            const toolValidation = await this.validateToolSpecificRules(toolName, content);
            if (!toolValidation.valid) {
                return {
                    allowed: false,
                    reason: toolValidation.reason
                };
            }

            // Determine if confirmation is needed based on risk level
            const needsConfirmation = toolConfig.riskLevel === RiskLevel.HIGH || 
                                    this.hasRecentHighRiskOperations(context.userId);

            return {
                allowed: true,
                requiresConfirmation: needsConfirmation,
                riskLevel: toolConfig.riskLevel
            };
        } catch (error) {
            console.error('Error validating tool usage:', error);
            return {
                allowed: false,
                reason: 'Error validating tool usage'
            };
        }
    }

    // Utility functions
    incrementViolationCount(userId) {
        const count = this.violationCount.get(userId) || 0;
        this.violationCount.set(userId, count + 1);
        this.lastCheck.set(userId, Date.now());
    }

    resetViolationsIfNeeded(userId) {
        const lastCheckTime = this.lastCheck.get(userId);
        if (lastCheckTime && (Date.now() - lastCheckTime > this.VIOLATION_RESET_TIME)) {
            this.violationCount.delete(userId);
            this.lastCheck.delete(userId);
        }
    }

    hasExceededViolationLimit(userId) {
        return (this.violationCount.get(userId) || 0) >= this.MAX_VIOLATIONS;
    }

    isRateLimited(userId) {
        // Implement rate limiting logic
        return false; // Placeholder
    }

    hasEscalatingRisk(userId) {
        // Implement escalating risk detection
        return false; // Placeholder
    }

    hasRecentHighRiskOperations(userId) {
        // Implement recent high risk operations check
        return false; // Placeholder
    }

    getHighestRiskLevel(issues) {
        const riskLevels = issues.map(issue => issue.risk);
        if (riskLevels.includes(RiskLevel.HIGH)) return RiskLevel.HIGH;
        if (riskLevels.includes(RiskLevel.MEDIUM)) return RiskLevel.MEDIUM;
        return RiskLevel.LOW;
    }

    riskLevelToSafetyLevel(riskLevel) {
        switch (riskLevel) {
            case RiskLevel.HIGH:
                return SafetyLevel.UNSAFE;
            case RiskLevel.MEDIUM:
                return SafetyLevel.WARNING;
            default:
                return SafetyLevel.SAFE;
        }
    }

    async getToolConfiguration(toolName) {
        // Implement tool configuration retrieval
        return {
            name: toolName,
            riskLevel: RiskLevel.MEDIUM, // Default risk level
            requiresConfirmation: false
        };
    }

    async validateToolSpecificRules(toolName, content) {
        // Implement tool-specific validation rules
        return {
            valid: true
        };
    }

    // Logging and monitoring
    logSafetyViolation(violation) {
        // Log violation for monitoring
        console.warn('Safety violation detected:', violation);
        
        // Emit event for monitoring
        EventBus.emit(EventTypes.ERROR_OCCURRED, {
            type: 'safety_violation',
            details: violation
        });
    }
}

// Export singleton instance
export const safetyGuardrails = new SafetyGuardrails();

// Export utility functions
export const checkMessageSafety = (content, context) => 
    safetyGuardrails.checkSafety(content, context);
export const validateToolUsage = (toolName, content, context) => 
    safetyGuardrails.validateToolUsage(toolName, content, context); 