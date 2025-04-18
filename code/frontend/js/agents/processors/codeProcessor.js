import { BaseAgentProcessor } from './baseProcessor.js';
import { API_CONFIG } from '../../base.js';
import { AGENTS } from '../../config.js';
import { safetyGuardrails } from '../../safety/guardrails.js';

export class CodeProcessor extends BaseAgentProcessor {
    constructor() {
        super(AGENTS.CODE.id);
        this.supportedLanguages = new Set(['javascript', 'python', 'java', 'typescript', 'go']);
        this.maxCodeLength = 10000; // characters
    }

    async process(message, context) {
        // Analyze code request
        const analysis = await this.analyzeCodeRequest(message);

        // Validate code safety
        const safetyCheck = await this.validateCodeSafety(analysis);
        if (!safetyCheck.safe) {
            throw new Error(`Code safety check failed: ${safetyCheck.reason}`);
        }

        // Generate or modify code
        const codeResult = await this.handleCodeOperation(analysis, context);

        // Validate output
        const validation = await this.validateOutput(codeResult);
        if (!validation.valid) {
            throw new Error(`Code validation failed: ${validation.reason}`);
        }

        return {
            text: codeResult.explanation,
            code: codeResult.code,
            language: codeResult.language,
            confidence: codeResult.confidence,
            metadata: {
                operation: analysis.operation,
                complexity: codeResult.complexity,
                testCoverage: codeResult.testCoverage
            }
        };
    }

    async analyzeCodeRequest(message) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/code/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request: message })
            });
            
            if (!response.ok) throw new Error('Code request analysis failed');
            
            const analysis = await response.json();
            
            // Validate language support
            if (analysis.language && !this.supportedLanguages.has(analysis.language.toLowerCase())) {
                throw new Error(`Language ${analysis.language} is not supported`);
            }
            
            return analysis;
        } catch (error) {
            console.error('Error analyzing code request:', error);
            // Fallback to basic analysis
            return {
                operation: 'unknown',
                language: 'javascript',
                complexity: 'medium'
            };
        }
    }

    async validateCodeSafety(analysis) {
        // Check for dangerous operations
        const dangerousPatterns = [
            /rm\s+-rf/,
            /system\s*\(/,
            /exec\s*\(/,
            /eval\s*\(/,
            /(?<!\\)process\.exit\s*\(/
        ];

        const hasDangerousPattern = dangerousPatterns.some(pattern => 
            pattern.test(analysis.request || '')
        );

        if (hasDangerousPattern) {
            return {
                safe: false,
                reason: 'Request contains potentially dangerous operations'
            };
        }

        // Use guardrails for additional safety checks
        return await safetyGuardrails.checkSafety(analysis.request, {
            context: 'code_generation',
            language: analysis.language
        });
    }

    async handleCodeOperation(analysis, context) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/code/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    analysis,
                    context
                })
            });
            
            if (!response.ok) throw new Error('Code operation failed');
            
            const result = await response.json();
            
            // Check code length
            if (result.code.length > this.maxCodeLength) {
                throw new Error('Generated code exceeds maximum length');
            }
            
            return result;
        } catch (error) {
            console.error('Error handling code operation:', error);
            throw error;
        }
    }

    async validateOutput(result) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/code/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result)
            });
            
            if (!response.ok) throw new Error('Code validation failed');
            
            return await response.json();
        } catch (error) {
            console.error('Error validating code output:', error);
            // Fallback validation
            return {
                valid: result.code.length > 0 && result.code.length <= this.maxCodeLength,
                reason: error.message
            };
        }
    }
} 