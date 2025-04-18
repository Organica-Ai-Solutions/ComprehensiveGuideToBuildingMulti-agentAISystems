// System Configuration

// API Configuration
window.API_CONFIG = {
    BASE_URL: 'http://localhost:8000/api',
    ENDPOINTS: {
        METRICS: '/metrics',
        TASKS: '/tasks',
        AGENTS: '/agents',
        TOOLS: '/tools',
        SECURITY: '/security',
        TOKENS: '/tokens'
    },
    REFRESH_INTERVALS: {
        METRICS: 60000,  // 1 minute
        TASKS: 30000,    // 30 seconds
        SECURITY: 45000, // 45 seconds
        TOKENS: 60000    // 1 minute
    }
};

// WebSocket Configuration
const WS_CONFIG = {
    BASE_URL: 'ws://localhost:8000',
    ENDPOINTS: {
        AGENT_CHAT: '/ws'
    }
};

// Theme Configuration
const THEME_CONFIG = {
    STORAGE_KEY: 'preferred_theme',
    DEFAULT: 'light'
};

// Agent Configuration
const AGENT_CONFIG = {
    TYPES: {
        RESEARCHER: 'researcher',
        CODER: 'coder',
        ASSISTANT: 'assistant'
    },
    DEFAULT: 'assistant'
};

// Agent configurations
const AGENTS = {
    RESEARCH: {
        id: "1",
        name: "Research Assistant",
        description: "Specialized in information gathering, literature review, and data analysis.",
        capabilities: ["web_search", "text_processing", "summarization"],
        defaultResponse: "As a Research Assistant, I can help you with: Literature Review, Data Analysis, Citation Management. How can I assist with your research?",
        riskLevel: "low"
    },
    CODE: {
        id: "2",
        name: "Code Helper",
        description: "Specialized in code analysis, debugging, and software development assistance.",
        capabilities: ["code_analysis", "debugging", "code_generation"],
        defaultResponse: "As a Code Helper, I can assist with: Code Analysis, Debugging, Best Practices. What coding challenge are you facing?",
        riskLevel: "medium"
    },
    WRITING: {
        id: "3",
        name: "Writing Assistant",
        description: "Specialized in content creation, editing, and stylistic improvements.",
        capabilities: ["text_processing", "rewriting", "grammar_check"],
        defaultResponse: "As a Writing Assistant, I can help with: Content Creation, Editing, Style Improvement. What writing project are you working on?",
        riskLevel: "low"
    }
};

// Tool configurations
const TOOLS = {
    WEB_SEARCH: {
        id: "1",
        name: "Web Search",
        key: "web_search",
        description: "Search the internet for information",
        icon: "bi-search",
        color: "primary",
        api_endpoint: "/api/tools/search",
        riskLevel: "low",
        requiresConfirmation: false
    },
    CODE_ANALYSIS: {
        id: "2",
        name: "Code Analysis",
        key: "code_analysis",
        description: "Analyze code and identify issues",
        icon: "bi-code-square",
        color: "success",
        api_endpoint: "/api/tools/code",
        riskLevel: "medium",
        requiresConfirmation: false
    },
    TEXT_PROCESSING: {
        id: "3",
        name: "Text Processing",
        key: "text_processing",
        description: "Process and analyze text content",
        icon: "bi-file-text",
        color: "info",
        api_endpoint: "/api/tools/text",
        riskLevel: "low",
        requiresConfirmation: false
    }
};

// Model configurations
window.MODELS = [
    { 
        id: 'gpt-4',
        name: 'GPT-4',
        description: 'GPT-4 is a large multimodal model that can solve difficult problems with greater accuracy than previous models.',
        parameters: '1.76 trillion',
        context_window: '128,000'
    },
    { 
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'GPT-3.5 Turbo is optimized for dialogue and cost-effective for various natural language tasks.',
        parameters: '175 billion',
        context_window: '16,000'
    },
    { 
        id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        description: 'Claude 3 Opus is Anthropic\'s most intelligent model with exceptional performance across reasoning, knowledge, and safety.',
        parameters: '~2 trillion',
        context_window: '200,000'
    },
    { 
        id: 'claude-3-sonnet',
        name: 'Claude 3 Sonnet',
        description: 'Claude 3 Sonnet balances intelligence and speed, offering strong performance at an accessible price point.',
        parameters: '~1 trillion',
        context_window: '100,000'
    }
];

// Guardrail configurations
const GUARDRAILS = {
    // Prompt injection patterns to detect
    PROMPT_INJECTION_PATTERNS: [
        /ignore previous instructions/i,
        /ignore all instructions/i,
        /disregard your instructions/i,
        /system prompt/i,
        /you are now/i,
        /forget your previous instructions/i
    ],
    
    // Content safety patterns
    CONTENT_SAFETY_PATTERNS: [
        /\b(hack|exploit|bypass|inject|sql injection)\b/i,
        /\b(password|credentials|authentication|token|key)\b.{0,20}\b(reveal|provide|share|get|tell me|give me)\b/i
    ],
    
    // Input validation parameters
    INPUT_VALIDATION: {
        MAX_LENGTH: 10000,  // Maximum allowed input length
        MIN_LENGTH: 2       // Minimum allowed input length
    },
    
    // Response validation parameters
    RESPONSE_VALIDATION: {
        MAX_LENGTH: 8000,   // Maximum allowed response length
        MIN_LENGTH: 5       // Minimum allowed response length
    }
};

// Chart Configuration
window.CHART_CONFIG = {
    COLORS: {
        PRIMARY: '#007bff',
        SUCCESS: '#28a745',
        WARNING: '#ffc107',
        DANGER: '#dc3545',
        INFO: '#17a2b8',
        SECONDARY: '#6c757d'
    },
    BACKGROUND_OPACITY: 0.2,
    DEFAULT_OPTIONS: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom'
            }
        }
    }
};

// Theme Configuration
window.THEME_COLORS = {
    light: {
        background: '#ffffff',
        text: '#212529',
        border: '#dee2e6',
        chart: {
            gridLines: '#e9ecef',
            text: '#495057'
        }
    },
    dark: {
        background: '#212529',
        text: '#f8f9fa',
        border: '#495057',
        chart: {
            gridLines: '#343a40',
            text: '#adb5bd'
        }
    }
};

// UI Configuration
window.UI_CONFIG = {
    ANIMATION_DURATION: 150,
    TOAST_DURATION: 5000,
    MAX_ITEMS_PER_PAGE: 10,
    DATE_FORMAT: {
        short: {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        },
        long: {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }
    }
}; 