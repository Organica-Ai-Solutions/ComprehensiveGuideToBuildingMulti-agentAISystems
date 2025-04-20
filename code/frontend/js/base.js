// Base configuration and shared utilities

// Determine protocol (http vs https) and corresponding WS protocol (ws vs wss)
const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const hostname = '127.0.0.1';  // Force IPv4 localhost
const port = '5000'; // Backend server port

// API Configuration
const API_CONFIG = {
    BASE_URL: `${protocol}://${hostname}:${port}`,
    WS_URL: `${wsProtocol}://${hostname}:${port}`,
    ENDPOINTS: {
        AGENTS: '/api/agents',
        MESSAGES: '/api/messages',
        TOOLS: '/api/tools',
        METRICS: '/api/metrics',
        HEALTH: '/api/health',
        SECURITY: '/api/security/events',
        CHAT: '/api/chat'  // Add chat endpoint
    },
    VERSION: '1.0.0'
};

// Default fetch options with proper CORS settings
const defaultFetchOptions = {
    mode: 'cors',
    cache: 'no-cache',
    credentials: 'include',  // Enable credentials for CORS
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
};

// Make configurations and utilities globally available
window.API_CONFIG = API_CONFIG;
window.defaultFetchOptions = defaultFetchOptions;

// Generic API call function with enhanced error handling
async function apiCall(endpoint, options = {}) {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    if (!endpoint) {
        console.error("apiCall Error: Endpoint is required.");
        throw new Error('Endpoint is required for API calls');
    }

    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    const url = `${window.API_CONFIG.BASE_URL}${normalizedEndpoint}`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`apiCall: Attempt ${attempt} for ${normalizedEndpoint}`);
        try {
            // Merge options with defaults
            const fetchOptions = {
                ...defaultFetchOptions,
                ...options,
                headers: {
                    ...defaultFetchOptions.headers,
                    ...(options.headers || {})
                }
            };

            console.log(`apiCall: Fetching URL: ${url}`);
            
            const response = await fetch(url, fetchOptions);
            console.log(`apiCall: Received response for ${normalizedEndpoint}. Status: ${response.status}, OK: ${response.ok}`);

            // Check for non-JSON response
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error(`apiCall: Received non-JSON response: ${text}`);
                throw new APIError(
                    'Server returned invalid response format',
                    response.status,
                    normalizedEndpoint
                );
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new APIError(
                    errorData.detail || errorData.message || `HTTP error! status: ${response.status}`,
                    response.status,
                    normalizedEndpoint
                );
            }

            const data = await response.json();
            console.log(`apiCall: Successfully parsed JSON response for ${normalizedEndpoint}`);
            return { data };

        } catch (error) {
            console.error(`apiCall: Attempt ${attempt} failed for ${normalizedEndpoint}. Error:`, error);

            if (error instanceof APIError) {
                if (error.status >= 400 && error.status < 500) {
                    throw error; // Don't retry client errors
                }
            }

            if (attempt === maxRetries) {
                console.error(`apiCall: Max retries (${maxRetries}) reached for ${normalizedEndpoint}`);
                throw error;
            }

            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.log(`apiCall: Retrying ${normalizedEndpoint} in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
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

// Make utilities globally available
window.showToast = showToast;
window.apiCall = apiCall;
window.generateId = generateId;
window.formatTimestamp = formatTimestamp;
window.sanitizeInput = sanitizeInput;
window.EventTypes = EventTypes;
window.EventBus = EventBus;

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

// Utility function for showing alerts
function showToast(message, type = 'error') {
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Remove toast after it's hidden
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    document.body.appendChild(container);
    return container;
}

// Utility function for handling API errors
function handleApiError(error, context = '') {
    console.error(`${context} Error:`, error);
    showToast(`Failed to ${context.toLowerCase()}: ${error.message}`);
}

// Theme management
const ThemeManager = {
    init() {
        const savedTheme = localStorage.getItem(window.THEME_CONFIG.STORAGE_KEY) || window.THEME_CONFIG.DEFAULT;
        this.setTheme(savedTheme);
    },

    setTheme(theme) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem(window.THEME_CONFIG.STORAGE_KEY, theme);
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
window.showToast = showToast;
window.apiCall = apiCall;
window.generateId = generateId;
window.formatTimestamp = formatTimestamp;
window.sanitizeInput = sanitizeInput;

const API_BASE_URL = 'http://127.0.0.1:5000'; 