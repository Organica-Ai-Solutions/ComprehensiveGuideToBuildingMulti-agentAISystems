// API Configuration
const config = {
    API_BASE_URL: 'http://127.0.0.1:5002',
    WS_BASE_URL: 'ws://127.0.0.1:5002',
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

export default config; 