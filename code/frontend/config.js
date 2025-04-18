// API Configuration
export const API_CONFIG = {
    baseUrl: 'http://localhost:8000',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    endpoints: {
        agents: '/api/agents',
        tools: '/api/tools',
        chat: '/api/agents/{agent_id}/chat',
        messages: '/api/agents/{agent_id}/messages',
        metrics: '/api/metrics',
        status: '/api/agents/{agent_id}'
    }
}; 