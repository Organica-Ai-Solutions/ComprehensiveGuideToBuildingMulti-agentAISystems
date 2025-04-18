// API Configuration
const API_CONFIG = {
    BASE_URL: 'http://127.0.0.1:8000',  // Backend API URL (IPv4)
    WS_URL: 'ws://127.0.0.1:8000',      // WebSocket URL (IPv4)
    ENDPOINTS: {
        AGENTS: '/api/agents',
        TOOLS: '/api/tools',
        METRICS: '/api/metrics',
        HEALTH: '/api/health',
        SECURITY: '/api/security/events',
        MESSAGES: '/api/messages',
        WEBSOCKET: '/ws'
    },
    REFRESH_INTERVAL: 5000,  // Refresh interval in milliseconds
    MAX_RETRIES: 3,          // Maximum number of retries for failed requests
    TIMEOUT: 5000,           // Request timeout in milliseconds
    DEFAULT_HEADERS: {       // Default headers for all requests
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
};

// Default fetch options that can be spread into fetch calls
const defaultFetchOptions = {
    headers: API_CONFIG.DEFAULT_HEADERS,
    mode: 'cors',
    cache: 'no-cache'
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