import { jest } from '@jest/globals';
import { safetyGuardrails } from '../safety/guardrails.js';
import { MetricsCollector } from '../metrics/collector.js';

// Mock dependencies
jest.mock('../metrics/collector.js');

describe('Safety Guardrails', () => {
    let guardrails;
    
    beforeEach(() => {
        guardrails = new safetyGuardrails();
        MetricsCollector.prototype.recordSafetyCheck = jest.fn();
    });

    describe('Code Safety Checks', () => {
        it('should detect dangerous system commands', async () => {
            const code = `
                const exec = require('child_process');
                exec.execSync('rm -rf /');
            `;

            const result = await guardrails.checkCodeSafety(code);
            expect(result.safe).toBe(false);
            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    type: 'dangerous_command',
                    severity: 'critical'
                })
            );
        });

        it('should detect unsafe file operations', async () => {
            const code = `
                const fs = require('fs');
                fs.unlinkSync('/important/file');
            `;

            const result = await guardrails.checkCodeSafety(code);
            expect(result.safe).toBe(false);
            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    type: 'unsafe_file_operation',
                    severity: 'high'
                })
            );
        });

        it('should allow safe code patterns', async () => {
            const code = `
                function add(a, b) {
                    return a + b;
                }
            `;

            const result = await guardrails.checkCodeSafety(code);
            expect(result.safe).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should detect potential infinite loops', async () => {
            const code = `
                while(true) {
                    console.log('infinite');
                }
            `;

            const result = await guardrails.checkCodeSafety(code);
            expect(result.safe).toBe(false);
            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    type: 'infinite_loop',
                    severity: 'medium'
                })
            );
        });
    });

    describe('Tool Usage Safety', () => {
        it('should validate tool permissions', async () => {
            const toolRequest = {
                name: 'systemCommand',
                args: ['shutdown'],
                requester: 'agent1'
            };

            const result = await guardrails.checkToolSafety(toolRequest);
            expect(result.safe).toBe(false);
            expect(result.reason).toContain('insufficient permissions');
        });

        it('should check tool argument safety', async () => {
            const toolRequest = {
                name: 'fileWrite',
                args: ['/etc/passwd', 'malicious content'],
                requester: 'agent1'
            };

            const result = await guardrails.checkToolSafety(toolRequest);
            expect(result.safe).toBe(false);
            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    type: 'unsafe_path',
                    severity: 'critical'
                })
            );
        });

        it('should allow safe tool usage', async () => {
            const toolRequest = {
                name: 'calculator',
                args: [1, 2, '+'],
                requester: 'agent1'
            };

            const result = await guardrails.checkToolSafety(toolRequest);
            expect(result.safe).toBe(true);
        });
    });

    describe('Resource Limits', () => {
        it('should enforce memory limits', async () => {
            const code = `
                const arr = new Array(1e9).fill(0);
            `;

            const result = await guardrails.checkResourceLimits(code);
            expect(result.safe).toBe(false);
            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    type: 'memory_limit',
                    severity: 'high'
                })
            );
        });

        it('should enforce CPU usage limits', async () => {
            const code = `
                for(let i = 0; i < 1e10; i++) {
                    Math.sqrt(i);
                }
            `;

            const result = await guardrails.checkResourceLimits(code);
            expect(result.safe).toBe(false);
            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    type: 'cpu_limit',
                    severity: 'medium'
                })
            );
        });
    });

    describe('Content Safety', () => {
        it('should detect harmful content', async () => {
            const content = 'This contains harmful instructions for creating malware';

            const result = await guardrails.checkContentSafety(content);
            expect(result.safe).toBe(false);
            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    type: 'harmful_content',
                    severity: 'high'
                })
            );
        });

        it('should allow safe content', async () => {
            const content = 'How to bake a chocolate cake';

            const result = await guardrails.checkContentSafety(content);
            expect(result.safe).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should detect potential PII', async () => {
            const content = 'My SSN is 123-45-6789';

            const result = await guardrails.checkContentSafety(content);
            expect(result.safe).toBe(false);
            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    type: 'pii_detected',
                    severity: 'high'
                })
            );
        });
    });

    describe('Metrics Integration', () => {
        it('should record safety check metrics', async () => {
            await guardrails.checkCodeSafety('console.log("hello")');
            
            expect(MetricsCollector.prototype.recordSafetyCheck)
                .toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: 'code',
                        result: 'pass'
                    })
                );
        });

        it('should record failed checks', async () => {
            await guardrails.checkCodeSafety('rm -rf /');
            
            expect(MetricsCollector.prototype.recordSafetyCheck)
                .toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: 'code',
                        result: 'fail',
                        issues: expect.any(Array)
                    })
                );
        });
    });
}); 