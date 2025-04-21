// Base configuration and shared utilities

// Determine protocol (http vs https)
const protocol = window.location.protocol === 'https:' ? 'https' : 'http';

// Use configuration variables from config.js
// const wsProtocol = WS_PROTOCOL; // Already defined in config.js
const hostname = API_HOSTNAME;
const port = API_PORT;

// API Configuration
const API_CONFIG = {
    BASE_URL: `${protocol}://${hostname}:${port}`,
    WS_URL: `${WS_PROTOCOL}//${hostname}:${port}`,
    BACKEND_KEY: BACKEND_KEY, // Use global constant
    ENDPOINTS: {
        AGENTS: '/api/agents',
        MESSAGES: '/api/messages',
        TOOLS: '/api/tools',
        METRICS: '/api/metrics',
        HEALTH: '/api/health',
        SECURITY_EVENTS: '/api/security/events',
        CHAT: '/api/chat'
    },
    VERSION: '1.0.0'
};

// Server status tracking
let serverAvailable = false;
let serverHealthCheckAttempts = 0;
// const maxServerHealthCheckAttempts = ENV_CONFIG.MAX_HEALTH_CHECK_ATTEMPTS; // Assuming a default or remove if not needed
// const healthCheckInterval = ENV_CONFIG.HEALTH_CHECK_INTERVAL;
// const healthCheckTimeout = ENV_CONFIG.HEALTH_CHECK_TIMEOUT;
const maxServerHealthCheckAttempts = 5; // Default value
const healthCheckInterval = 5000; // Default value (5 seconds)
const healthCheckTimeout = 3000; // Default value (3 seconds)
let lastServerCheck = 0;
let isCheckingServer = false;
let serverStartupTimeout = null;
let lastBackendError = null;

// Check if we have network connectivity
async function checkNetworkConnectivity() {
    try {
        // Try to fetch a small resource from a reliable CDN
        const response = await fetch('https://www.google.com/favicon.ico', {
            mode: 'no-cors',
            cache: 'no-cache',
            timeout: 5000
        });
        return true;
    } catch (error) {
        console.error('Network connectivity check failed:', error);
        return false;
    }
}

// Try to start the server using the start script
async function tryStartServer() {
    try {
        showToast(`
            <div class="alert alert-info" role="alert">
                <i class="bi bi-arrow-clockwise me-2"></i>
                <strong>Starting Server</strong>
                <br>
                Running start script: <code>./start_servers.sh</code>
                <br>
                <small class="text-muted">This may take a few moments...</small>
            </div>
        `, 'info', 0);

        // Try to execute the start script
        const startResponse = await fetch('/start-server', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (startResponse.ok) {
            const logs = await startResponse.text();
            if (logs.includes('MCPMetrics') && logs.includes('not defined')) {
                showToast(`
                    <div class="alert alert-danger" role="alert">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        <strong>Backend Module Error</strong>
                        <br>
                        The MCPMetrics module is missing. Please check:
                        <ul class="mb-0 mt-2">
                            <li>Backend dependencies are installed correctly</li>
                            <li>MCPMetrics module is properly imported</li>
                            <li>Python environment is activated</li>
                        </ul>
                        <hr>
                        <small class="text-muted">Try running: <code>pip install -r requirements.txt</code></small>
                    </div>
                `, 'danger', 0);
                return false;
            }

            showToast(`
                <div class="alert alert-success" role="alert">
                    <i class="bi bi-check-circle me-2"></i>
                    Server startup initiated
                    <br>
                    <small class="text-muted">Waiting for server to become available...</small>
                </div>
            `, 'success', 5000);

            // Start checking for server availability
            startServerStartupCheck();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Failed to start server:', error);
        showToast(`
            <div class="alert alert-danger" role="alert">
                <i class="bi bi-exclamation-triangle me-2"></i>
                <strong>Server Start Failed</strong>
                <br>
                Could not start the server. Please check:
                <ul class="mb-0 mt-2">
                    <li>Backend dependencies are installed</li>
                    <li>No other process is using port ${port}</li>
                    <li>Server logs for detailed errors</li>
                </ul>
                <hr>
                <small class="text-muted">Try running these commands:</small>
                <br>
                <code>cd code/backend</code>
                <br>
                <code>pip install -r requirements.txt</code>
            </div>
        `, 'danger', 0);
        return false;
    }
}

// Start checking for server startup
function startServerStartupCheck() {
    if (serverStartupTimeout) {
        clearTimeout(serverStartupTimeout);
    }

    let startupAttempts = 0;
    const maxStartupAttempts = 10;
    const startupCheckInterval = 2000; // 2 seconds

    async function checkStartup() {
        startupAttempts++;
        const isAvailable = await checkServerHealth(true);
        
        if (isAvailable) {
            showToast(`
                <div class="alert alert-success" role="alert">
                    <i class="bi bi-check-circle me-2"></i>
                    Server is now available!
                </div>
            `, 'success', 5000);
            return;
        }

        if (startupAttempts < maxStartupAttempts) {
            serverStartupTimeout = setTimeout(checkStartup, startupCheckInterval);
        } else {
            showToast(`
                <div class="alert alert-danger" role="alert">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    <strong>Server Start Failed</strong>
                    <br>
                    Could not detect server after ${maxStartupAttempts} attempts.
                    <br>
                    <small class="text-muted">Please check the server logs for errors.</small>
                </div>
            `, 'danger', 0);
        }
    }

    checkStartup();
}

// Check server health with improved diagnostics
async function checkServerHealth(isStartupCheck = false) {
    if (isCheckingServer && !isStartupCheck) {
        console.log('Server health check already in progress, skipping...');
        return false;
    }
    
    isCheckingServer = true;
    try {
        // First check network connectivity
        const hasNetwork = await checkNetworkConnectivity();
        if (!hasNetwork) {
            throw new Error('No network connectivity');
        }

        // Try to get server logs if available
        try {
            const logsResponse = await fetch('/logs/backend.log');
            if (logsResponse.ok) {
                const logs = await logsResponse.text();
                if (logs.includes('MCPMetrics') && logs.includes('not defined')) {
                    lastBackendError = {
                        type: 'module_missing',
                        message: 'MCPMetrics module not found',
                        details: 'The required MCPMetrics module is missing or not properly imported.'
                    };
                }
            }
        } catch (error) {
            console.log('Could not fetch server logs:', error);
        }

        // Increment attempt counter if not a startup check
        if (!isStartupCheck) {
            serverHealthCheckAttempts++;
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), healthCheckTimeout);
        
        try {
            // Construct the URL correctly using the defined endpoint
            const healthUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.HEALTH}`; // Original correct line
            console.log(`Attempting health check at ${healthUrl}`);
            const response = await fetch(healthUrl, {
                method: 'GET',
                headers: {
                    // 'Content-Type': 'application/json', // Not usually needed for GET health check
                    'Accept': 'application/json'
                    // No API Key needed for health check based on backend logs
                },
                signal: controller.signal,
                cache: 'no-cache'
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                serverAvailable = true;
                lastServerCheck = Date.now();
                serverHealthCheckAttempts = 0;
                lastBackendError = null;
                console.log('Server health check: OK');
                EventBus.emit('server_status', { 
                    available: true,
                    port: port,
                    url: `${protocol}://${hostname}:${port}`
                });
                return true;
            }
            throw new Error(`Server responded with status: ${response.status}`);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            throw fetchError;
        }
    } catch (error) {
        serverAvailable = false;
        console.error('Server health check failed:', error);
        
        if (isStartupCheck) {
            return false;
        }

        let errorMessage;
        let errorDetails = null;
        
        if (lastBackendError?.type === 'module_missing') {
            errorMessage = lastBackendError.message;
            errorDetails = {
                type: 'backend_module',
                suggestion: lastBackendError.details,
                action: null,
                steps: [
                    'Install backend dependencies: <code>pip install -r requirements.txt</code>',
                    'Check MCPMetrics module is properly imported',
                    'Verify Python environment is activated'
                ]
            };
        } else if (error.message === 'No network connectivity') {
            errorMessage = 'No network connection available';
            errorDetails = {
                type: 'network',
                suggestion: 'Please check your internet connection'
            };
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = `Cannot reach server at ${hostname}:${port}`;
            errorDetails = {
                type: 'connection',
                suggestion: 'Click to start the server',
                action: tryStartServer
            };
        } else if (error.name === 'AbortError') {
            errorMessage = 'Server health check timed out';
            errorDetails = {
                type: 'timeout',
                suggestion: 'Server might be starting up or overloaded'
            };
        } else {
            errorMessage = error.message;
            errorDetails = {
                type: 'unknown',
                suggestion: 'Please check server logs for more details'
            };
        }
        
        try {
            if (serverHealthCheckAttempts >= maxServerHealthCheckAttempts) {
                showServerUnavailableMessage(true, errorDetails);
            } else {
                showServerUnavailableMessage(false, errorDetails);
            }
            
            EventBus.emit('server_status', { 
                available: false, 
                error: errorMessage,
                details: errorDetails,
                attempts: serverHealthCheckAttempts
            });
        } catch (displayError) {
            console.error('Failed to show server error message:', displayError);
        }
        
        return false;
    } finally {
        isCheckingServer = false;
    }
}

function showServerUnavailableMessage(showDetailedHelp = false, errorDetails = null) {
    try {
        let message = `
            <div class="alert alert-warning" role="alert">
                <i class="bi bi-exclamation-triangle me-2"></i>
                <strong>Server Connection Error</strong>
                <br>
                ${errorDetails?.type === 'network' ? 'No network connection available' : 
                  errorDetails?.type === 'backend_module' ? 'Backend module error' :
                  `Cannot connect to server at ${hostname}:${port}`}
        `;
        
        if (showDetailedHelp) {
            message += `
                <hr>
                <p class="mb-0">Troubleshooting steps:</p>
                <ol class="mb-0 mt-2">
            `;
            
            if (errorDetails?.type === 'network') {
                message += `
                    <li>Check your network connection
                        <br><small class="text-muted">Ensure you have internet connectivity</small>
                    </li>
                `;
            } else if (errorDetails?.type === 'backend_module') {
                message += `
                    <li>Install backend dependencies
                        <br><small class="text-muted">Run: <code>pip install -r requirements.txt</code></small>
                    </li>
                    <li>Check module imports
                        <br><small class="text-muted">${errorDetails.suggestion}</small>
                    </li>
                    <li>Verify environment
                        <br><small class="text-muted">Ensure Python environment is activated</small>
                    </li>
                `;
                if (errorDetails.steps) {
                    message += `
                        <hr>
                        <div class="mt-2">
                            <strong>Quick fix:</strong>
                            <ol class="mb-0 mt-1">
                                ${errorDetails.steps.map(step => `<li><small>${step}</small></li>`).join('')}
                            </ol>
                        </div>
                    `;
                }
            } else {
                message += `
                    <li>Start the server
                        <br><small class="text-muted">
                            ${errorDetails?.action ? '<a href="#" class="start-server-link">Click here</a> to start the server or ' : ''}
                            run: <code>./start_servers.sh</code>
                        </small>
                    </li>
                    <li>Check server logs for errors
                        <br><small class="text-muted">Look in the logs directory for details</small>
                    </li>
                `;
            }
            
            message += `</ol>`;
            
            if (errorDetails?.suggestion && !errorDetails.steps) {
                message += `
                    <hr>
                    <small class="text-muted">
                        ${errorDetails.suggestion}
                    </small>
                `;
            }
        } else {
            message += `
                <br>
                <small class="text-muted">
                    Attempting to reconnect... (Attempt ${serverHealthCheckAttempts} of ${maxServerHealthCheckAttempts})
                    ${errorDetails?.suggestion && !errorDetails.steps ? `<br>${errorDetails.suggestion}` : ''}
                </small>
            `;
        }
        
        message += '</div>';
        
        const toast = showToast(message, 'warning', showDetailedHelp ? 0 : 5000);
        
        // Add click handler for the start server link if it exists
        if (errorDetails?.action && toast) {
            const startLink = toast.querySelector('.start-server-link');
            if (startLink) {
                startLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    errorDetails.action();
                });
            }
        }
        
        return toast;
    } catch (error) {
        console.error('Failed to show server unavailable message:', error);
        // Fallback to console error
        console.error('Server Connection Error:', errorDetails?.type === 'network' ? 
            'No network connection available' : 
            `Cannot connect to server at ${hostname}:${port}`
        );
    }
}

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
async function apiCall(endpoint, apiConfig, options = {}) {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    const healthCheckRetries = 3; // Retries for the initial health check
    const healthCheckDelay = 500; // Delay between health check retries (ms)

    // Check server health if it's been more than 30 seconds since last check or if marked unavailable
    if (!serverAvailable || Date.now() - lastServerCheck > healthCheckInterval) {
        let serverOk = false;
        for (let i = 0; i < healthCheckRetries; i++) {
            console.log(`apiCall: Performing health check attempt ${i + 1}/${healthCheckRetries} for ${endpoint}`);
            serverOk = await checkServerHealth();
            if (serverOk) {
                console.log(`apiCall: Health check successful on attempt ${i + 1}`);
                break; // Exit loop if health check passes
            }
            if (i < healthCheckRetries - 1) {
                console.log(`apiCall: Health check failed, retrying in ${healthCheckDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, healthCheckDelay));
            }
        }

        if (!serverOk) {
            console.error(`apiCall: Health check failed after ${healthCheckRetries} attempts.`);
            throw new APIError(
                'Server is not available. Please ensure the backend server is running and responsive.',
                503,
                endpoint
            );
        }
        // If check passed, update status (already done inside checkServerHealth)
        // serverAvailable = true; // This is now set within checkServerHealth on success
        // lastServerCheck = Date.now(); // This is now set within checkServerHealth on success
    }

    if (!endpoint) {
        console.error("apiCall Error: Endpoint is required.");
        throw new Error('Endpoint is required for API calls');
    }

    // Ensure endpoint starts with /api/
    const normalizedEndpoint = endpoint.startsWith('/api/') ? endpoint : `/api/${endpoint.replace(/^\/+/, '')}`;
    const url = `${apiConfig.BASE_URL}${normalizedEndpoint}`;

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

            // Add Backend Access Key DIRECTLY to fetchOptions.headers
            console.log("apiCall: Checking apiConfig object:", apiConfig);
            if (apiConfig && apiConfig.BACKEND_KEY) {
                console.log("Adding X-API-Key with value:", apiConfig.BACKEND_KEY);
                fetchOptions.headers['X-API-Key'] = apiConfig.BACKEND_KEY;
            } else {
                console.log("Condition to add X-API-Key header was false (apiConfig or apiConfig.BACKEND_KEY missing).");
            }

            console.log("apiCall: Final fetch options:", JSON.stringify(fetchOptions, null, 2)); // Log final options
            
            const response = await fetch(url, fetchOptions);
            console.log(`apiCall: Received response for ${normalizedEndpoint}. Status: ${response.status}, OK: ${response.ok}`);

            // Clone the response before reading it
            const responseClone = response.clone();
            
            let data;
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                try {
                    data = await response.json();
                } catch (parseError) {
                    console.error(`apiCall: JSON parse error for ${url}`, parseError);
                    // Try to get text content from the cloned response
                    const text = await responseClone.text();
                    if (text.trim().startsWith('<!DOCTYPE') || text.includes('<html>')) {
                        serverAvailable = false;
                        throw new APIError(
                            'Server returned HTML instead of JSON. Please ensure the backend server is running.',
                            503,
                            normalizedEndpoint
                        );
                    }
                    throw new APIError(
                        'Invalid JSON response from server',
                        response.status,
                        normalizedEndpoint,
                        text
                    );
                }
        } else {
                // Handle non-JSON responses
                const text = await response.text();
                if (text.trim().startsWith('<!DOCTYPE') || text.includes('<html>')) {
                    serverAvailable = false;
                    throw new APIError(
                        'Server returned HTML instead of JSON. Please ensure the backend server is running.',
                        503,
                        normalizedEndpoint
                    );
                }
                try {
                    // Try to parse as JSON anyway in case Content-Type is wrong
                    data = JSON.parse(text);
                } catch (e) {
                    throw new APIError(
                        'Server returned non-JSON response',
                        response.status,
                        normalizedEndpoint,
                        text
                    );
                }
            }

            if (!response.ok) {
                throw new APIError(
                    data.detail || data.message || `HTTP error! status: ${response.status}`,
                    response.status,
                    normalizedEndpoint,
                    data
                );
            }

            // If we get here, the server is available
            serverAvailable = true;
            lastServerCheck = Date.now();

            console.log(`apiCall: Successfully processed response for ${normalizedEndpoint}`);
            return { data, status: response.status };

        } catch (error) {
            console.error(`apiCall: Attempt ${attempt} failed for ${normalizedEndpoint}. Error:`, error);

            if (error instanceof APIError) {
                // Don't retry server unavailable errors
                if (error.status === 503) {
                    handleApiError(error);
                    throw error;
                }
                // Don't retry client errors (4xx)
                if (error.status >= 400 && error.status < 500) {
                    handleApiError(error);
                    throw error;
                }
            }

            if (attempt === maxRetries) {
                console.error(`apiCall: Max retries (${maxRetries}) reached for ${normalizedEndpoint}`);
                handleApiError(error);
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
    constructor(message, status, endpoint, data = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.endpoint = endpoint;
        this.data = data;
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
function showToast(message, type = 'error', duration = 5000) {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
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
    
    // Initialize Bootstrap toast
    let bsToast;
    try {
        bsToast = new bootstrap.Toast(toast, {
            autohide: duration > 0,
            delay: duration
        });
        bsToast.show();
    } catch (error) {
        console.error('Failed to create Bootstrap toast:', error);
        // Fallback to basic toast if Bootstrap is not available
        toast.style.display = 'block';
        if (duration > 0) {
            setTimeout(() => {
                toast.remove();
            }, duration);
        }
    }
    
    // Remove toast after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
        try {
            toast.remove();
        } catch (error) {
            console.error('Error removing toast:', error);
        }
    });
    
    return toast;
}

// Improved error handling function
function handleApiError(error, context = '') {
    const errorMessage = error instanceof APIError
        ? `API Error (${error.status}): ${error.message}`
        : `Network Error: ${error.message}`;
    
    console.error(`${context} ${errorMessage}`, error);
    showToast(errorMessage, 'error');
    
    // Emit error event for global handling
    EventBus.emit(EventTypes.ERROR_OCCURRED, {
        error,
        context,
        timestamp: new Date().toISOString()
    });
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

// Initialize with a server health check and periodic checks
document.addEventListener('DOMContentLoaded', () => {
    // Initial check
    checkServerHealth().catch(console.error);
    
    // Periodic health checks
    setInterval(() => {
        if (!serverAvailable) {
            checkServerHealth().catch(console.error);
        }
    }, healthCheckInterval);
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

const API_BASE_URL = 'http://localhost:5000';
const WS_BASE_URL = 'ws://localhost:5000';

async function makeAPIRequest(endpoint, options = {}) {
    const baseUrl = API_CONFIG.BASE_URL;
    const url = `${baseUrl}/${endpoint}`.replace(/([^:]\/)\/+/g, "$1");
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_CONFIG.BACKEND_KEY
        }
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(url, finalOptions);
        
        if (!response.ok) {
            throw new APIError(
                `API request failed: ${response.status} ${response.statusText}`,
                response.status
            );
        }
        
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new APIError("Invalid response format: Expected JSON", response.status);
        }
        
        return await response.json();
    } catch (error) {
        if (error instanceof APIError) {
            throw error;
        }
        throw new APIError(`Network error: ${error.message}`, 0);
    }
} 