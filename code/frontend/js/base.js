// Base configuration and shared utilities

// Determine protocol (http vs https) and corresponding WS protocol (ws vs wss)
const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const hostname = '127.0.0.1';  // Force IPv4 localhost
const port = '8000'; // Backend server port

// API Configuration
export const API_CONFIG = {
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
export const defaultFetchOptions = {
    mode: 'cors',
    cache: 'no-cache',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    },
    credentials: 'include'
};

// Generic API call function with retry logic
export async function apiCall(endpoint, options = {}) {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
                ...defaultFetchOptions,
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
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
export function generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
}

export function sanitizeInput(input) {
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Error handling
export class APIError extends Error {
    constructor(message, status, endpoint) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.endpoint = endpoint;
    }
}

// Event handling
export const EventTypes = {
    CONNECTION_STATUS: 'connection_status',
    MESSAGE_RECEIVED: 'message_received',
    ERROR_OCCURRED: 'error_occurred',
    AGENT_HANDOFF: 'agent_handoff',
    TOOL_USAGE: 'tool_usage'
};

// Event bus for communication
export const EventBus = {
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

// Theme Management
function initializeTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-bs-theme', theme);
    updateThemeToggle(theme);
}

function updateThemeToggle(theme) {
    const toggler = document.getElementById('theme-toggler');
    const label = document.getElementById('theme-label');
    if (toggler && label) {
        const icon = toggler.querySelector('i');
        if (theme === 'dark') {
            icon.className = 'bi bi-sun-fill';
            label.textContent = 'Light';
        } else {
            icon.className = 'bi bi-moon-stars-fill';
            label.textContent = 'Dark';
        }
    }
}

// Initialize theme on load
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    
    // Theme toggle handler
    const themeToggler = document.getElementById('theme-toggler');
    if (themeToggler) {
        themeToggler.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-bs-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-bs-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeToggle(newTheme);
        });
    }
}); 