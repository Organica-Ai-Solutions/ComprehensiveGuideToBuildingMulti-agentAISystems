class InterventionPanel {
    constructor() {
        this.panel = document.getElementById('intervention-panel');
        this.title = document.getElementById('intervention-title');
        this.priorityBadge = document.getElementById('intervention-priority');
        this.description = document.getElementById('intervention-description');
        this.actionsContainer = document.getElementById('intervention-actions');
        
        // Section elements
        this.safetySection = document.getElementById('safety-review-section');
        this.toolSection = document.getElementById('tool-usage-section');
        this.feedbackSection = document.getElementById('feedback-section');
        
        // Templates
        this.safetyIssueTemplate = document.getElementById('safety-issue-template');
        this.actionButtonTemplate = document.getElementById('action-button-template');
        
        // Bind methods
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.handleAction = this.handleAction.bind(this);
    }

    /**
     * Show the intervention panel with the specified configuration
     * @param {Object} config - Configuration object for the intervention
     * @param {string} config.title - Title of the intervention
     * @param {string} config.priority - Priority level (high, medium, low)
     * @param {string} config.description - Description of the intervention
     * @param {Object[]} config.actions - Array of action objects
     * @param {Object} [config.safety] - Safety concerns configuration
     * @param {Object} [config.tool] - Tool usage configuration
     * @param {boolean} [config.requireFeedback] - Whether feedback is required
     */
    show(config) {
        // Set basic information
        this.title.textContent = config.title;
        this.description.textContent = config.description;
        this.priorityBadge.className = `priority-badge ${config.priority}`;
        this.priorityBadge.textContent = config.priority.toUpperCase();

        // Clear previous actions
        this.actionsContainer.innerHTML = '';

        // Add action buttons
        config.actions.forEach(action => {
            const button = this.actionButtonTemplate.content.cloneNode(true).querySelector('button');
            button.textContent = action.label;
            button.className = `btn ${action.type || 'default'}`;
            button.addEventListener('click', () => this.handleAction(action));
            this.actionsContainer.appendChild(button);
        });

        // Handle safety concerns
        if (config.safety) {
            this.safetySection.style.display = 'block';
            this.renderSafetyIssues(config.safety.issues);
        } else {
            this.safetySection.style.display = 'none';
        }

        // Handle tool usage details
        if (config.tool) {
            this.toolSection.style.display = 'block';
            document.getElementById('tool-name').textContent = config.tool.name;
            document.getElementById('tool-params').textContent = 
                JSON.stringify(config.tool.parameters, null, 2);
            document.getElementById('tool-purpose').textContent = config.tool.purpose;
        } else {
            this.toolSection.style.display = 'none';
        }

        // Handle feedback section
        this.feedbackSection.style.display = config.requireFeedback ? 'block' : 'none';

        // Show the panel
        this.panel.style.display = 'flex';
        this.panel.classList.add('active');
    }

    /**
     * Hide the intervention panel
     */
    hide() {
        this.panel.classList.remove('active');
        setTimeout(() => {
            this.panel.style.display = 'none';
            // Reset sections
            this.safetySection.style.display = 'none';
            this.toolSection.style.display = 'none';
            this.feedbackSection.style.display = 'none';
        }, 300); // Match the CSS transition duration
    }

    /**
     * Render safety issues in the safety section
     * @param {Object[]} issues - Array of safety issue objects
     */
    renderSafetyIssues(issues) {
        const container = document.getElementById('safety-issues-list');
        container.innerHTML = '';

        issues.forEach(issue => {
            const element = this.safetyIssueTemplate.content.cloneNode(true);
            const issueDiv = element.querySelector('.safety-issue');
            
            issueDiv.querySelector('.issue-title').textContent = issue.title;
            issueDiv.querySelector('.issue-description').textContent = issue.description;
            
            if (issue.recommendation) {
                issueDiv.querySelector('.issue-recommendation').textContent = 
                    `Recommendation: ${issue.recommendation}`;
            }

            issueDiv.classList.add(`severity-${issue.severity}`);
            container.appendChild(element);
        });
    }

    /**
     * Handle action button clicks
     * @param {Object} action - Action configuration object
     */
    async handleAction(action) {
        let feedback = null;
        
        // Collect feedback if required
        if (this.feedbackSection.style.display === 'block') {
            feedback = {
                accuracy: document.getElementById('accuracy-rating').value,
                safety: document.getElementById('safety-rating').value,
                notes: document.getElementById('feedback-notes').value
            };
        }

        try {
            // Execute the action
            if (action.handler) {
                await action.handler(feedback);
            }

            // Hide the panel after successful action
            this.hide();
        } catch (error) {
            console.error('Error handling intervention action:', error);
            // You might want to show an error message to the user here
        }
    }
}

// Create and export a singleton instance
const interventionPanel = new InterventionPanel();
export default interventionPanel;

// Example usage:
/*
interventionPanel.show({
    title: "Review Tool Usage",
    priority: "high",
    description: "The agent is requesting to use a potentially dangerous tool.",
    actions: [
        {
            label: "Approve",
            type: "primary",
            handler: async (feedback) => {
                // Handle approval with feedback
            }
        },
        {
            label: "Reject",
            type: "danger",
            handler: async (feedback) => {
                // Handle rejection with feedback
            }
        }
    ],
    tool: {
        name: "system_command",
        parameters: {
            command: "rm -rf /",
            isBackground: false
        },
        purpose: "Delete system files"
    },
    safety: {
        issues: [
            {
                title: "Destructive Operation",
                description: "This command will delete system files",
                severity: "high",
                recommendation: "Verify the command's scope and necessity"
            }
        ]
    },
    requireFeedback: true
});
*/ 