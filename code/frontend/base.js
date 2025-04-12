// --- Theme Toggler ---
function setupThemeToggler() {
    const themeToggler = document.getElementById('theme-toggler');
    if (!themeToggler) return;
    
    const htmlElement = document.documentElement;

    // Check initial preference
    const currentTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    htmlElement.setAttribute('data-bs-theme', currentTheme);
    updateTogglerUI(currentTheme);

    themeToggler.addEventListener('click', () => {
        const newTheme = htmlElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
        htmlElement.setAttribute('data-bs-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateTogglerUI(newTheme);
    });

    function updateTogglerUI(theme) {
        if (theme === 'dark') {
            themeToggler.innerHTML = '<i class="bi bi-sun-fill"></i> <span id="theme-label">Light</span>';
        } else {
            themeToggler.innerHTML = '<i class="bi bi-moon-stars-fill"></i> <span id="theme-label">Dark</span>';
        }
    }
}

// --- Navigation Enhancement ---
function setupNavigation() {
    // Get current page path
    const currentPath = window.location.pathname;
    console.log('Current path:', currentPath);
    
    // Update navigation links and handle active states
    document.querySelectorAll('nav a, .card a').forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;

        // Add .html extension if needed
        if (!href.endsWith('.html') && !href.startsWith('http')) {
            const newHref = href.endsWith('/') ? 'index.html' : href + '.html';
            link.setAttribute('href', newHref);
            console.log('Updated link:', href, '->', newHref);
        }

        // Set active state
        const linkPath = link.getAttribute('href');
        if (currentPath.endsWith(linkPath) || 
            (currentPath === '/' && linkPath === 'index.html') ||
            (currentPath.endsWith('/') && linkPath === 'index.html')) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
            console.log('Set active:', linkPath);
        }

        // Handle navigation
        link.addEventListener('click', function(e) {
            if (!this.getAttribute('href').startsWith('http')) {
                e.preventDefault();
                const targetHref = this.getAttribute('href');
                console.log('Navigating to:', targetHref);
                window.location.href = targetHref;
            }
        });
    });
}

// Initialize all base functionality
document.addEventListener('DOMContentLoaded', () => {
    setupThemeToggler();
    setupNavigation();
}); 