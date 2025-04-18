import { jest } from '@jest/globals';
import { ResearchProcessor } from '../agents/processors/researchProcessor.js';
import { CodeProcessor } from '../agents/processors/codeProcessor.js';
import { API_CONFIG } from '../base.js';
import { safetyGuardrails } from '../safety/guardrails.js';

// Mock dependencies
jest.mock('../safety/guardrails.js');
global.fetch = jest.fn();

describe('Agent Processors', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        fetch.mockClear();
    });

    describe('ResearchProcessor', () => {
        let processor;

        beforeEach(() => {
            processor = new ResearchProcessor();
        });

        it('should process research queries successfully', async () => {
            const message = 'Tell me about quantum computing';
            const mockQueryAnalysis = {
                topics: ['quantum computing'],
                timeframe: 'all',
                depth: 'comprehensive'
            };
            const mockSources = [
                { id: 1, title: 'Quantum Basics', relevance: 0.9 },
                { id: 2, title: 'Advanced Quantum', relevance: 0.8 }
            ];
            const mockSynthesis = {
                summary: 'Quantum computing uses quantum mechanics...',
                confidence: 0.85,
                method: 'comprehensive',
                sources: ['Quantum Basics', 'Advanced Quantum']
            };

            // Mock API responses
            fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockQueryAnalysis)
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockSources)
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockSynthesis)
                });

            const result = await processor.process(message);

            expect(result.text).toBe(mockSynthesis.summary);
            expect(result.confidence).toBe(mockSynthesis.confidence);
            expect(result.sources).toEqual(mockSynthesis.sources);
        });

        it('should handle API failures gracefully', async () => {
            const message = 'Research topic';
            fetch.mockRejectedValue(new Error('API Error'));

            const result = await processor.process(message);

            expect(result.confidence).toBeLessThan(0.5);
            expect(result.sources).toEqual([]);
        });

        it('should filter sources by relevance threshold', async () => {
            const mockSources = [
                { id: 1, relevance: 0.9, citation: 'Good Source' },
                { id: 2, relevance: 0.3, citation: 'Poor Source' }
            ];

            fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({})
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockSources)
                });

            const sources = await processor.gatherSources({});
            expect(sources.length).toBe(1);
            expect(sources[0].citation).toBe('Good Source');
        });
    });

    describe('CodeProcessor', () => {
        let processor;

        beforeEach(() => {
            processor = new CodeProcessor();
            safetyGuardrails.checkSafety.mockResolvedValue({ safe: true });
        });

        it('should process code requests successfully', async () => {
            const message = 'Write a sorting function';
            const mockAnalysis = {
                operation: 'generate',
                language: 'javascript',
                complexity: 'medium'
            };
            const mockCodeResult = {
                code: 'function sort(arr) { return arr.sort(); }',
                explanation: 'This is a simple sorting function',
                language: 'javascript',
                confidence: 0.9,
                complexity: 'low',
                testCoverage: 100
            };

            fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockAnalysis)
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockCodeResult)
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ valid: true })
                });

            const result = await processor.process(message);

            expect(result.code).toBe(mockCodeResult.code);
            expect(result.confidence).toBe(mockCodeResult.confidence);
            expect(result.language).toBe('javascript');
        });

        it('should detect unsafe code patterns', async () => {
            const message = 'Delete all files';
            const mockAnalysis = {
                operation: 'generate',
                language: 'javascript',
                request: 'rm -rf /'
            };

            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockAnalysis)
            });

            await expect(processor.process(message)).rejects.toThrow('safety check failed');
        });

        it('should validate code length limits', async () => {
            const message = 'Generate a large function';
            const mockCodeResult = {
                code: 'a'.repeat(15000), // Exceeds maxCodeLength
                language: 'javascript'
            };

            fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({})
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockCodeResult)
                });

            await expect(processor.process(message)).rejects.toThrow('exceeds maximum length');
        });

        it('should handle unsupported languages', async () => {
            const mockAnalysis = {
                language: 'brainfuck'
            };

            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockAnalysis)
            });

            await expect(processor.analyzeCodeRequest(''))
                .rejects.toThrow('not supported');
        });
    });
}); 