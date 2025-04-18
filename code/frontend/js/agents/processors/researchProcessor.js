import { BaseAgentProcessor } from './baseProcessor.js';
import { API_CONFIG } from '../../base.js';
import { AGENTS } from '../../config.js';

export class ResearchProcessor extends BaseAgentProcessor {
    constructor() {
        super(AGENTS.RESEARCH.id);
        this.relevanceThreshold = 0.6;
        this.maxSourcesPerQuery = 5;
    }

    async process(message, context) {
        // Analyze query for research parameters
        const queryParams = await this.analyzeQuery(message);

        // Gather relevant sources
        const sources = await this.gatherSources(queryParams);

        // Synthesize information
        const synthesis = await this.synthesizeInformation(sources, queryParams);

        // Format response
        return {
            text: synthesis.summary,
            sources: synthesis.sources,
            confidence: synthesis.confidence,
            metadata: {
                queryParams,
                sourceCount: sources.length,
                synthesisMethod: synthesis.method
            }
        };
    }

    async analyzeQuery(message) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/research/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: message })
            });
            
            if (!response.ok) throw new Error('Query analysis failed');
            
            return await response.json();
        } catch (error) {
            console.error('Error analyzing research query:', error);
            // Fallback to basic analysis
            return {
                topics: message.toLowerCase().split(' '),
                timeframe: 'recent',
                depth: 'standard'
            };
        }
    }

    async gatherSources(queryParams) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/research/sources`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(queryParams)
            });
            
            if (!response.ok) throw new Error('Source gathering failed');
            
            const sources = await response.json();
            
            // Filter sources by relevance
            return sources
                .filter(source => source.relevance >= this.relevanceThreshold)
                .slice(0, this.maxSourcesPerQuery);
        } catch (error) {
            console.error('Error gathering sources:', error);
            return [];
        }
    }

    async synthesizeInformation(sources, queryParams) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/research/synthesize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sources,
                    queryParams
                })
            });
            
            if (!response.ok) throw new Error('Information synthesis failed');
            
            return await response.json();
        } catch (error) {
            console.error('Error synthesizing information:', error);
            // Fallback to basic synthesis
            return {
                summary: 'Unable to synthesize information at this time.',
                confidence: 0.3,
                method: 'fallback',
                sources: sources.map(s => s.citation)
            };
        }
    }
} 