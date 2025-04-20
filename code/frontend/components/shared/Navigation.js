// Shared Navigation Component
class Navigation {
    constructor() {
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.init();
    }

    init() {
        // Insert navigation HTML
        const nav = document.createElement('nav');
        nav.className = 'navbar navbar-expand-lg fixed-top';
        nav.innerHTML = `
            <div class="container-fluid px-4">
                <!-- Left section -->
                <div class="d-flex align-items-center">
                    <button class="btn btn-icon me-2 d-lg-none" id="menuToggle">
                        <i class="bi bi-list"></i>
                    </button>
                    <a class="navbar-brand d-flex align-items-center" href="/index.html">
                        <i class="bi bi-braces-asterisk me-2"></i>
                        <span class="brand-text">Multi-Agent System</span>
                    </a>
                    <div class="vertical-divider mx-3"></div>
                    <span class="nav-section-title" id="sectionTitle">Dashboard</span>
                </div>

                <!-- Center section - Ensure always displayed -->
                <div class="navbar-nav mx-auto d-flex">
                    <a class="nav-link" href="/dashboard/dashboard.html" data-section="Dashboard">
                        <i class="bi bi-speedometer2"></i>
                        <span>Dashboard</span>
                    </a>
                    <a class="nav-link" href="/chat/agent_chat.html" data-section="Chat">
                        <i class="bi bi-chat-dots"></i>
                        <span>Chat</span>
                    </a>
                    <a class="nav-link" href="/about.html" data-section="About">
                        <i class="bi bi-info-circle"></i>
                        <span>About</span>
                    </a>
                </div>

                <!-- Right section -->
                <div class="d-flex align-items-center gap-2">
                    <!-- Model selector -->
                    <div class="dropdown">
                        <button class="btn btn-outline-secondary dropdown-toggle d-flex align-items-center gap-2" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="bi bi-cpu"></i>
                            <span class="model-name">GPT-4</span>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><h6 class="dropdown-header">Select Model</h6></li>
                            <li><a class="dropdown-item active" href="#"><i class="bi bi-cpu"></i> GPT-4</a></li>
                            <li><a class="dropdown-item" href="#"><i class="bi bi-cpu"></i> GPT-3.5</a></li>
                            <li><a class="dropdown-item" href="#"><i class="bi bi-cpu"></i> Claude 3 Opus</a></li>
                            <li><a class="dropdown-item" href="#"><i class="bi bi-cpu"></i> Claude 3 Sonnet</a></li>
                            <li><a class="dropdown-item" href="#"><i class="bi bi-cpu"></i> Gemini Pro</a></li>
                            <li><a class="dropdown-item" href="#"><i class="bi bi-cpu"></i> Gemini Ultra</a></li>
                        </ul>
                    </div>

                    <!-- Theme toggle -->
                    <button class="btn btn-icon" id="themeToggle">
                        <i class="bi bi-sun-fill"></i>
                    </button>

                    <!-- Context panel toggle -->
                    <button class="btn btn-icon" id="toggleContext">
                        <i class="bi bi-layout-sidebar-reverse"></i>
                    </button>

                    <!-- User menu -->
                    <div class="dropdown">
                        <button class="btn btn-icon rounded-circle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="bi bi-person-circle"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><a class="dropdown-item" href="#"><i class="bi bi-person"></i> Profile</a></li>
                            <li><a class="dropdown-item" href="#"><i class="bi bi-gear"></i> Settings</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item" href="#"><i class="bi bi-box-arrow-right"></i> Sign Out</a></li>
                        </ul>
                    </div>
                </div>
            </div>
        `;

        // Insert navigation at the start of the body
        document.body.insertBefore(nav, document.body.firstChild);

        // Setup event listeners
        this.setupEventListeners();
        this.updateActiveSection();
        this.updateThemeIcon();
    }

    setupEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Mobile menu toggle
        const menuToggle = document.getElementById('menuToggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => this.toggleMobileMenu());
        }

        // Model selection
        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.currentTarget.closest('.dropdown').querySelector('.model-name')) {
                    const modelName = e.currentTarget.textContent.trim();
                    e.currentTarget.closest('.dropdown').querySelector('.model-name').textContent = modelName;
                    document.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                }
            });
        });
    }

    updateActiveSection() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-link');
        const sectionTitle = document.getElementById('sectionTitle');

        if (!currentPath || !navLinks.length) {
            console.warn('Navigation: Unable to update active section - missing path or navigation links');
            return;
        }

        let activeSection = '';
        navLinks.forEach(link => {
            if (!link || !link.getAttribute('href')) return;
            
            const href = link.getAttribute('href');
            const isActive = currentPath.includes(href.split('/').pop());
            link.classList.toggle('active', isActive);
            
            if (isActive) {
                activeSection = link.getAttribute('data-section') || '';
            }
        });

        if (sectionTitle && activeSection) {
            sectionTitle.textContent = activeSection;
        }
    }

    toggleTheme() {
        const html = document.documentElement;
        const themeIcon = document.querySelector('#themeToggle i');
        
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        html.setAttribute('data-bs-theme', this.currentTheme);
        localStorage.setItem('theme', this.currentTheme);
        
        this.updateThemeIcon();
    }

    updateThemeIcon() {
        const themeIcon = document.querySelector('#themeToggle i');
        if (themeIcon) {
            themeIcon.className = this.currentTheme === 'light' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
        }
    }

    toggleMobileMenu() {
        const navbarNav = document.querySelector('.navbar-nav');
        navbarNav.classList.toggle('show');
    }
}

// Initialize navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.navigation = new Navigation();
}); 