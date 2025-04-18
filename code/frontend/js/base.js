// Base configuration and shared utilities

// Determine protocol (http vs https) and corresponding WS protocol (ws vs wss)
const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const hostname = '127.0.0.1';  // Force IPv4 localhost
const port = '8000'; // Backend server port

// API Configuration
const API_CONFIG = {
    BASE_URL: `${protocol}://${hostname}:${port}`,
    WS_URL: `${wsProtocol}://${hostname}:${port}`,
    ENDPOINTS: {
        AGENTS: '/api/agents',
        MESSAGES: '/api/messages',
        TOOLS: '/api/tools',
        METRICS: '/api/metrics',
        HEALTH: '/api/health'
    },
    VERSION: '1.0.0'
};

// Default fetch options
const defaultFetchOptions = {
    mode: 'cors',
    cache: 'no-cache',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    },
    credentials: 'include'
};

// Make configurations and utilities globally available
window.API_CONFIG = API_CONFIG;
window.defaultFetchOptions = defaultFetchOptions;

// Generic API call function with retry logic
async function apiCall(endpoint, options = {}) {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(`${window.API_CONFIG.BASE_URL}${endpoint}`, {
                ...defaultFetchOptions,
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API call attempt ${attempt} failed:`, error);

            if (attempt === maxRetries) {
                throw error;
            }

            // Exponential backoff
            await new Promise(resolve => 
                setTimeout(resolve, baseDelay * Math.pow(2, attempt - 1))
            );
        }
    }
}

// Utility functions
function generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
}

function sanitizeInput(input) {
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Error handling
class APIError extends Error {
    constructor(message, status, endpoint) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.endpoint = endpoint;
    }
}

// Event handling
const EventTypes = {
    CONNECTION_STATUS: 'connection_status',
    MESSAGE_RECEIVED: 'message_received',
    ERROR_OCCURRED: 'error_occurred',
    AGENT_HANDOFF: 'agent_handoff',
    TOOL_USAGE: 'tool_usage'
};

// Event bus for communication
const EventBus = {
    listeners: new Map(),

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    },

    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    },

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }
};

// Theme configuration
const THEME_CONFIG = {
    STORAGE_KEY: 'theme',
    DEFAULT: 'light'
};

// Utility functions for date formatting
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Utility function for number formatting
function formatNumber(number) {
    return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1
    }).format(number);
}

// Utility function for making API requests
async function makeApiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API request failed:', error);
        return { success: false, error: error.message };
    }
}

// Utility function for showing alerts
function showAlert(message, type = 'danger') {
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) return;

    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.role = 'alert';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    alertContainer.appendChild(alert);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 150);
    }, 5000);
}

// Utility function for handling API errors
function handleApiError(error, context = '') {
    console.error(`${context} Error:`, error);
    showAlert(`Failed to ${context.toLowerCase()}: ${error.message}`);
}

// Theme management
const ThemeManager = {
    init() {
        const savedTheme = localStorage.getItem(THEME_CONFIG.STORAGE_KEY) || THEME_CONFIG.DEFAULT;
        this.setTheme(savedTheme);
    },

    setTheme(theme) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem(THEME_CONFIG.STORAGE_KEY, theme);
    },

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-bs-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        return newTheme;
    }
};

// Initialize theme based on stored preference
document.addEventListener('DOMContentLoaded', () => {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-bs-theme', theme);
});

// Make everything available globally
window.APIError = APIError;
window.EventTypes = EventTypes;
window.EventBus = EventBus;
window.defaultFetchOptions = defaultFetchOptions;
window.apiCall = apiCall;
window.generateId = generateId;
window.formatTimestamp = formatTimestamp;
window.sanitizeInput = sanitizeInput; 