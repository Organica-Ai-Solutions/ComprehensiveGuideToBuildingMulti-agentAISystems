// API Configuration
const API_CONFIG = {
    // Determine the base URL dynamically based on the current host
    BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5001' 
        : `http://${window.location.hostname}:5001`,
    
    // Use the same host for WebSocket connections
    WS_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'ws://localhost:5001' 
        : `ws://${window.location.hostname}:5001`,
    
    ENDPOINTS: {
        AGENTS: '/api/agents',
        TASKS: '/api/tasks',
        TOOLS: '/api/tools',
        MESSAGES: '/api/messages',
        MCP: '/api/mcp/status',
        METRICS: '/api/metrics'
    }
};

// Handle navigation and theme
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Load Navbar --- 
    const navbarContainer = document.getElementById('navbar-container');
    if (navbarContainer) {
        fetch('navbar.html') // Assumes navbar.html is in the same directory as the page loading it
            .then(response => response.text())
            .then(data => {
                navbarContainer.innerHTML = data;
                // Initialize theme toggler and set active nav link AFTER navbar is loaded
                initializeThemeToggler(); 
                setActiveNavLink(); 
            })
            .catch(error => console.error('Error loading navbar:', error));
    } else {
        // If no navbar container, initialize theme directly
        initializeThemeToggler();
    }

    // --- Update Navigation Link Extensions ---
    // Update all navigation links to include .html extension (run regardless of navbar load)
    document.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        // Check if it's a relative link, doesn't end with .html, doesn't start with #, and isn't javascript:
        if (href && !href.endsWith('.html') && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('javascript:')) {
             // Check if it's just a filename (no path)
             if (!href.includes('/') && href.length > 0) {
                link.setAttribute('href', href + '.html');
             }
             // Handle cases like 'index' -> 'index.html'
             else if (href === 'index') {
                 link.setAttribute('href', 'index.html');
             }
        }
    });

    // --- Set Active Navigation Link --- (Called after navbar load)
    function setActiveNavLink() {
        const currentPath = window.location.pathname.split('/').pop(); // Get filename e.g., index.html
        document.querySelectorAll('#navbar-container .nav-link, #navbar-container .navbar-brand').forEach(link => {
            const linkPath = (link.getAttribute('href') || '').split('/').pop(); 
            
            if (linkPath === currentPath || (currentPath === '' && linkPath === 'index.html')) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');
            } else {
                link.classList.remove('active');
                link.removeAttribute('aria-current');
            }
        });
    }

    // --- Theme Toggler Logic --- (Called after navbar load or directly)
    function initializeThemeToggler() {
        const themeToggler = document.getElementById('theme-toggler');
        const html = document.documentElement;
        
        if (themeToggler) {
            // Check for saved theme preference
            const savedTheme = localStorage.getItem('theme') || 'light'; // Default to light
            html.setAttribute('data-bs-theme', savedTheme);
            updateThemeButton(savedTheme === 'dark');
            
            themeToggler.addEventListener('click', () => {
                const isDark = html.getAttribute('data-bs-theme') === 'dark';
                const newTheme = isDark ? 'light' : 'dark';
                
                html.setAttribute('data-bs-theme', newTheme);
                localStorage.setItem('theme', newTheme);
                updateThemeButton(!isDark);
            });
        }
        // Ensure theme is applied even if toggler isn't found (e.g., no navbar)
        else {
             const savedTheme = localStorage.getItem('theme') || 'light';
             html.setAttribute('data-bs-theme', savedTheme);
        }
    }
        
    function updateThemeButton(isDark) {
        const themeToggler = document.getElementById('theme-toggler');
        if (themeToggler) {
            themeToggler.innerHTML = isDark ? 
                '<i class="bi bi-sun-fill"></i> <span id="theme-label">Light</span>' : // Icon shows opposite action
                '<i class="bi bi-moon-stars-fill"></i> <span id="theme-label">Dark</span>';
        }
    }
}); 