import { jest } from '@jest/globals';
import agentOrchestrator from '../orchestration/agentOrchestrator.js';
import { AGENTS, TOOLS } from '../config.js';
import { safetyGuardrails } from '../safety/guardrails.js';
import { humanIntervention } from '../feedback/humanIntervention.js';

// Mock dependencies
jest.mock('../safety/guardrails.js');
jest.mock('../feedback/humanIntervention.js');

describe('AgentOrchestrator', () => {
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Setup default mock implementations
        safetyGuardrails.checkSafety.mockResolvedValue({ safe: true });
        humanIntervention.requestIntervention.mockResolvedValue({ 
            approved: true, 
            updates: {} 
        });
    });

    describe('processUserMessage', () => {
        it('should process a message successfully with high confidence', async () => {
            const message = 'Write a function to calculate fibonacci';
            const mockRouting = {
                agentId: AGENTS.CODE.id,
                confidence: 0.9,
                reason: 'Code-related query'
            };

            // Mock successful processing
            const mockResponse = {
                text: 'Here is the fibonacci function...',
                code: 'function fibonacci(n) {...}',
                confidence: 0.9
            };

            // Setup mocks
            jest.spyOn(agentOrchestrator, 'processWithAgent')
                .mockResolvedValue(mockResponse);

            const result = await agentOrchestrator.processUserMessage(message);

            expect(result.success).toBe(true);
            expect(result.agentId).toBe(AGENTS.CODE.id);
            expect(result.response).toBe(mockResponse);
        });

        it('should handle safety violations', async () => {
            const message = 'rm -rf /';
            safetyGuardrails.checkSafety.mockResolvedValue({ 
                safe: false,
                reason: 'Dangerous system command detected'
            });

            const result = await agentOrchestrator.processUserMessage(message);

            expect(result.success).toBe(false);
            expect(result.reason).toBe('Dangerous system command detected');
        });

        it('should request human intervention for low confidence routing', async () => {
            const message = 'ambiguous request';
            const mockRouting = {
                agentId: AGENTS.RESEARCH.id,
                confidence: 0.5,
                reason: 'Unclear intent'
            };

            const result = await agentOrchestrator.processUserMessage(message);

            expect(humanIntervention.requestIntervention).toHaveBeenCalled();
        });
    });

    describe('handleToolRequest', () => {
        it('should execute a tool safely', async () => {
            const toolName = 'calculator';
            const params = { operation: 'add', numbers: [1, 2] };

            // Mock successful tool validation and execution
            jest.spyOn(agentOrchestrator, 'executeToolSafely')
                .mockResolvedValue({
                    success: true,
                    result: 3
                });

            const result = await agentOrchestrator.handleToolRequest(toolName, params);

            expect(result.success).toBe(true);
            expect(result.result).toBe(3);
        });

        it('should handle tool validation failures', async () => {
            const toolName = 'dangerousTool';
            const params = { command: 'rm -rf /' };

            const result = await agentOrchestrator.handleToolRequest(toolName, params);

            expect(result.success).toBe(false);
            expect(result.reason).toContain('validation');
        });

        it('should request human intervention for high-risk tools', async () => {
            const toolName = 'systemCommand';
            const params = { command: 'ls -la' };

            const result = await agentOrchestrator.handleToolRequest(toolName, params);

            expect(humanIntervention.requestIntervention).toHaveBeenCalled();
        });
    });

    describe('handleAgentHandoff', () => {
        it('should perform successful handoff between agents', async () => {
            const fromAgentId = AGENTS.RESEARCH.id;
            const toAgentId = AGENTS.CODE.id;
            const message = 'Implement this algorithm';

            const result = await agentOrchestrator.handleAgentHandoff(
                fromAgentId, 
                toAgentId, 
                message
            );

            expect(result.success).toBe(true);
            expect(result.handoffId).toBeDefined();
        });

        it('should validate handoff compatibility', async () => {
            const fromAgentId = 'invalidAgent';
            const toAgentId = AGENTS.CODE.id;
            const message = 'Test message';

            const result = await agentOrchestrator.handleAgentHandoff(
                fromAgentId, 
                toAgentId, 
                message
            );

            expect(result.success).toBe(false);
            expect(result.reason).toContain('Invalid agent ID');
        });
    });

    describe('executeToolSafely', () => {
        it('should monitor resource usage during execution', async () => {
            const toolName = 'longRunningTool';
            const params = { duration: 5000 };

            jest.spyOn(agentOrchestrator, 'getResourceUsage')
                .mockReturnValue({
                    memory: 100,
                    cpu: 50,
                    network: 20
                });

            const result = await agentOrchestrator.executeToolSafely(toolName, params);

            expect(result.metadata.resourceUsage).toBeDefined();
            expect(result.metadata.executionTime).toBeGreaterThan(0);
        });

        it('should handle timeouts gracefully', async () => {
            const toolName = 'slowTool';
            const params = { operation: 'heavy_computation' };

            // Mock a tool that takes too long
            jest.spyOn(agentOrchestrator, 'executeToolWithLogging')
                .mockImplementation(() => new Promise(resolve => 
                    setTimeout(resolve, 35000)
                ));

            await expect(
                agentOrchestrator.executeToolSafely(toolName, params)
            ).rejects.toThrow('timeout');
        });
    });
}); 