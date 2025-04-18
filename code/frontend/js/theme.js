class ThemeManager {
    constructor() {
        this.storageKey = 'preferred-theme';
        this.defaultTheme = 'light';
        this.currentTheme = this.loadTheme();
        this.setupEventListeners();
        this.applyTheme(this.currentTheme);
    }

    loadTheme() {
        return localStorage.getItem(this.storageKey) || this.defaultTheme;
    }

    saveTheme(theme) {
        localStorage.setItem(this.storageKey, theme);
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
    }

    applyTheme(theme) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
        
        // Update CSS variables
        const colors = THEME_COLORS[theme];
        Object.entries(colors).forEach(([property, value]) => {
            if (typeof value === 'object') {
                Object.entries(value).forEach(([subProperty, subValue]) => {
                    document.documentElement.style.setProperty(
                        `--${property}-${subProperty}`,
                        subValue
                    );
                });
            } else {
                document.documentElement.style.setProperty(
                    `--${property}`,
                    value
                );
            }
        });

        // Update charts if they exist
        this.updateCharts(theme);
        this.saveTheme(theme);
    }

    updateCharts(theme) {
        if (window.Chart && Chart.instances) {
            Chart.instances.forEach(chart => {
                const options = chart.options;
                options.plugins.legend.labels.color = THEME_COLORS[theme].chart.text;
                options.scales.x.grid.color = THEME_COLORS[theme].chart.gridLines;
                options.scales.x.ticks.color = THEME_COLORS[theme].chart.text;
                options.scales.y.grid.color = THEME_COLORS[theme].chart.gridLines;
                options.scales.y.ticks.color = THEME_COLORS[theme].chart.text;
                chart.update();
            });
        }
    }

    setupEventListeners() {
        // Listen for theme toggle button clicks
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener(
            'change',
            e => {
                if (!localStorage.getItem(this.storageKey)) {
                    this.applyTheme(e.matches ? 'dark' : 'light');
                }
            }
        );
    }
}

// Initialize theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
}); 