/**
 * Interviewer Dashboard JavaScript
 * Handles real-time monitoring, data fetching, and UI management
 */

class InterviewerDashboard {
    constructor() {
        this.socket = null;
        this.currentSection = 'overview';
        this.autoRefresh = true;
        this.refreshInterval = null;
        this.apiBase = 'http://localhost:5000/api/v1';

        // Initialize dashboard
        this.init();
    }

    /**
     * Initialize the dashboard
     */
    async init() {
        try {
            console.log('Initializing Interviewer Dashboard...');

            // Set up event listeners
            this.setupEventListeners();

            // Initialize socket connection
            this.initializeSocket();

            // Load initial data
            await this.loadDashboardData();

            // Start auto-refresh
            this.startAutoRefresh();

            console.log('Dashboard initialized successfully');

        } catch (error) {
            console.error('Error initializing dashboard:', error);
            this.showError('Failed to initialize dashboard');
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.switchSection(section);
            });
        });

        // Refresh button
        const refreshBtn = document.getElementById('refresh-data');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadDashboardData();
            });
        }

        // Auto-refresh toggle
        const autoRefreshBtn = document.getElementById('auto-refresh-toggle');
        if (autoRefreshBtn) {
            autoRefreshBtn.addEventListener('click', () => {
                this.toggleAutoRefresh();
            });
        }

        // Filters
        const violationFilter = document.getElementById('violation-filter');
        if (violationFilter) {
            violationFilter.addEventListener('change', () => {
                this.loadViolations();
            });
        }

        const timeFilter = document.getElementById('time-filter');
        if (timeFilter) {
            timeFilter.addEventListener('change', () => {
                this.loadViolations();
            });
        }

        // Modal close
        const closeModal = document.getElementById('close-modal');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                this.closeModal();
            });
        }

        // Settings
        const saveSettings = document.getElementById('save-settings');
        if (saveSettings) {
            saveSettings.addEventListener('click', () => {
                this.saveSettings();
            });
        }
    }

    /**
     * Initialize socket connection
     */
    initializeSocket() {
        try {
            this.socket = io('http://localhost:5000');

            this.socket.on('connect', () => {
                console.log('Connected to server');
                this.socket.emit('join-as-interviewer', {
                    interviewerId: 'interviewer_1',
                    interviewerInfo: { name: 'Dashboard User' }
                });
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from server');
            });

            // Real-time event handlers
            this.socket.on('violation-alert', (data) => {
                this.handleViolationAlert(data);
            });

            this.socket.on('interview-started-notification', (data) => {
                this.handleInterviewStarted(data);
            });

            this.socket.on('interview-completed', (data) => {
                this.handleInterviewCompleted(data);
            });

            this.socket.on('candidate-joined', (data) => {
                this.handleCandidateJoined(data);
            });

            this.socket.on('candidate-disconnected', (data) => {
                this.handleCandidateDisconnected(data);
            });

        } catch (error) {
            console.warn('Socket connection not available:', error);
        }
    }

    /**
     * Switch dashboard sections
     */
    switchSection(section) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        // Hide all sections
        document.querySelectorAll('.dashboard-section').forEach(sec => {
            sec.classList.add('hidden');
        });

        // Show target section
        document.getElementById(`${section}-section`).classList.remove('hidden');

        this.currentSection = section;

        // Load section-specific data
        this.loadSectionData(section);
    }

    /**
     * Load section-specific data
     */
    async loadSectionData(section) {
        switch (section) {
            case 'overview':
                await this.loadDashboardData();
                break;
            case 'active-interviews':
                await this.loadActiveInterviews();
                break;
            case 'violations':
                await this.loadViolations();
                break;
            case 'reports':
                await this.loadReports();
                break;
            case 'analytics':
                await this.loadAnalytics();
                break;
        }
    }

    /**
     * Load dashboard overview data
     */
    async loadDashboardData() {
        try {
            const response = await fetch(`${this.apiBase}/dashboard/overview`);
            const data = await response.json();

            if (data.success) {
                this.updateOverviewStats(data.data);
                this.updateActiveInterviewsList(data.data.activeInterviews);
                this.updateRecentViolationsList(data.data.recentViolations);
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    /**
     * Update overview statistics
     */
    updateOverviewStats(data) {
        const { overview } = data;

        document.getElementById('active-count').textContent = overview.activeInterviews;
        document.getElementById('violations-count').textContent = overview.today.totalViolations;
        document.getElementById('avg-integrity').textContent = `${Math.round(overview.today.avgIntegrity || 0)}%`;
        document.getElementById('completed-count').textContent = overview.today.completed;

        // Update active badge
        const activeBadge = document.getElementById('active-badge');
        if (activeBadge) {
            activeBadge.textContent = `${overview.activeInterviews} Active`;
            activeBadge.className = `badge ${overview.activeInterviews > 0 ? 'warning' : 'success'}`;
        }
    }

    /**
     * Update active interviews list
     */
    updateActiveInterviewsList(interviews) {
        const container = document.getElementById('active-interviews-list');

        if (!interviews || interviews.length === 0) {
            container.innerHTML = '<p class="text-center">No active interviews</p>';
            return;
        }

        const html = interviews.map(interview => `
            <div class="interview-card ${this.getRiskClass(interview.analysis?.riskLevel)}">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h5>${interview.candidateInfo.name}</h5>
                        <p class="mb-1">${interview.candidateInfo.position}</p>
                        <small class="text-muted">Started: ${new Date(interview.sessionData.startTime).toLocaleTimeString()}</small>
                    </div>
                    <div class="text-right">
                        <span class="badge ${this.getScoreBadgeClass(interview.scores.integrityScore)}">
                            ${interview.scores.integrityScore}%
                        </span>
                        <div class="btn-group mt-2">
                            <button class="btn btn-sm btn-primary" onclick="dashboard.viewInterview('${interview.sessionId}')">
                                <i class="fas fa-eye"></i> Monitor
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    /**
     * Update recent violations list
     */
    updateRecentViolationsList(violations) {
        const container = document.getElementById('recent-violations-list');

        if (!violations || violations.length === 0) {
            container.innerHTML = '<p class="text-center">No recent violations</p>';
            return;
        }

        const html = violations.slice(0, 5).map(item => `
            <div class="violation-item ${item.violation.severity}">
                <div class="flex-grow-1">
                    <strong>${item.candidateName}</strong>
                    <p class="mb-1">${item.violation.message}</p>
                    <small class="text-muted">${new Date(item.violation.timestamp).toLocaleString()}</small>
                </div>
                <div class="ml-3">
                    <span class="badge ${this.getSeverityBadgeClass(item.violation.severity)}">
                        ${item.violation.severity.toUpperCase()}
                    </span>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    /**
     * Load detailed active interviews
     */
    async loadActiveInterviews() {
        try {
            const response = await fetch(`${this.apiBase}/dashboard/active-interviews`);
            const data = await response.json();

            if (data.success) {
                this.updateDetailedActiveInterviews(data.data.interviews);
            }
        } catch (error) {
            console.error('Error loading active interviews:', error);
        }
    }

    /**
     * Update detailed active interviews display
     */
    updateDetailedActiveInterviews(interviews) {
            const container = document.getElementById('detailed-active-interviews');

            if (!interviews || interviews.length === 0) {
                container.innerHTML = '<p class="text-center">No active interviews</p>';
                return;
            }

            const html = interviews.map(interview => `
            <div class="interview-card ${this.getRiskClass(interview.analysis?.riskLevel)}">
                <div class="row">
                    <div class="col-md-8">
                        <h5>${interview.candidateInfo.name}</h5>
                        <p><strong>Position:</strong> ${interview.candidateInfo.position}</p>
                        <p><strong>Duration:</strong> ${interview.formattedElapsedTime}</p>
                        <p><strong>Recent Violations:</strong> ${interview.recentViolationCount}</p>
                    </div>
                    <div class="col-md-4 text-right">
                        <div class="mb-2">
                            <span class="badge ${this.getScoreBadgeClass(interview.scores.integrityScore)}">
                                Integrity: ${interview.scores.integrityScore}%
                            </span>
                        </div>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-primary" onclick="dashboard.viewInterview('${interview.sessionId}')">
                                <i class="fas fa-eye"></i> Monitor
                            </button>
                            <button class="btn btn-sm btn-warning" onclick="dashboard.sendMessage('${interview.sessionId}')">
                                <i class="fas fa-comment"></i> Message
                            </button>
                        </div>
                    </div>
                </div>
                ${interview.lastViolation ? `
                    <div class="mt-3 p-2 bg-light rounded">
                        <small><strong>Last Violation:</strong> ${interview.lastViolation.message} 
                        (${new Date(interview.lastViolation.timestamp).toLocaleString()})</small>
                    </div>
                ` : ''}
            </div>
        `).join('');

        container.innerHTML = html;
    }

    /**
     * Load violations data
     */
    async loadViolations() {
        try {
            const severity = document.getElementById('violation-filter')?.value || '';
            const hours = document.getElementById('time-filter')?.value || '24';
            
            const params = new URLSearchParams();
            if (severity) params.append('severity', severity);
            params.append('hours', hours);
            params.append('limit', '50');

            const response = await fetch(`${this.apiBase}/dashboard/violations/recent?${params}`);
            const data = await response.json();

            if (data.success) {
                this.updateViolationsTable(data.data);
            }
        } catch (error) {
            console.error('Error loading violations:', error);
        }
    }

    /**
     * Update violations table
     */
    updateViolationsTable(data) {
        const container = document.getElementById('violations-table-container');
        
        if (!data.violations || data.violations.length === 0) {
            container.innerHTML = '<p class="text-center">No violations found</p>';
            return;
        }

        const html = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Candidate</th>
                        <th>Violation Type</th>
                        <th>Message</th>
                        <th>Severity</th>
                        <th>Time</th>
                        <th>Integrity Score</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.violations.map(item => `
                        <tr>
                            <td>
                                <strong>${item.candidateName}</strong><br>
                                <small class="text-muted">${item.candidateEmail || ''}</small>
                            </td>
                            <td>${item.violation.type.replace('_', ' ').toUpperCase()}</td>
                            <td>${item.violation.message}</td>
                            <td>
                                <span class="badge ${this.getSeverityBadgeClass(item.violation.severity)}">
                                    ${item.violation.severity.toUpperCase()}
                                </span>
                            </td>
                            <td>${new Date(item.violation.timestamp).toLocaleString()}</td>
                            <td>
                                <span class="badge ${this.getScoreBadgeClass(item.integrityScore)}">
                                    ${item.integrityScore}%
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="dashboard.viewInterview('${item.sessionId}')">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    /**
     * Load reports data
     */
    async loadReports() {
        // Implementation for reports section
        console.log('Loading reports...');
    }

    /**
     * Load analytics data
     */
    async loadAnalytics() {
        // Implementation for analytics section
        console.log('Loading analytics...');
    }

    /**
     * Handle real-time violation alert
     */
    handleViolationAlert(data) {
        console.log('Violation alert received:', data);
        
        // Show notification
        this.showNotification(`Violation detected: ${data.violation.message}`, 'warning');
        
        // Refresh data if on relevant section
        if (this.currentSection === 'overview' || this.currentSection === 'violations') {
            this.loadDashboardData();
        }
    }

    /**
     * Handle interview started notification
     */
    handleInterviewStarted(data) {
        console.log('Interview started:', data);
        this.showNotification(`Interview started: ${data.candidateName}`, 'info');
        this.loadDashboardData();
    }

    /**
     * Handle interview completed notification
     */
    handleInterviewCompleted(data) {
        console.log('Interview completed:', data);
        this.showNotification(`Interview completed: ${data.interview?.candidateInfo?.name}`, 'success');
        this.loadDashboardData();
    }

    /**
     * Handle candidate joined notification
     */
    handleCandidateJoined(data) {
        console.log('Candidate joined:', data);
        this.loadDashboardData();
    }

    /**
     * Handle candidate disconnected notification
     */
    handleCandidateDisconnected(data) {
        console.log('Candidate disconnected:', data);
        this.showNotification('Candidate disconnected unexpectedly', 'warning');
        this.loadDashboardData();
    }

    /**
     * View interview details
     */
    async viewInterview(sessionId) {
        try {
            const response = await fetch(`${this.apiBase}/interviews/${sessionId}`);
            const data = await response.json();

            if (data.success) {
                this.showInterviewModal(data.data);
            }
        } catch (error) {
            console.error('Error loading interview details:', error);
            this.showError('Failed to load interview details');
        }
    }

    /**
     * Show interview details modal
     */
    showInterviewModal(interview) {
        const modal = document.getElementById('interview-modal');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');

        title.textContent = `Interview: ${interview.candidateInfo.name}`;
        
        body.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h5>Candidate Information</h5>
                    <p><strong>Name:</strong> ${interview.candidateInfo.name}</p>
                    <p><strong>Email:</strong> ${interview.candidateInfo.email || 'N/A'}</p>
                    <p><strong>Position:</strong> ${interview.candidateInfo.position}</p>
                    <p><strong>Status:</strong> ${interview.sessionData.status}</p>
                </div>
                <div class="col-md-6">
                    <h5>Scores</h5>
                    <p><strong>Integrity Score:</strong> 
                        <span class="badge ${this.getScoreBadgeClass(interview.scores.integrityScore)}">
                            ${interview.scores.integrityScore}%
                        </span>
                    </p>
                    <p><strong>Focus Score:</strong> ${interview.scores.focusScore}%</p>
                    <p><strong>Overall Score:</strong> ${interview.scores.overallScore}%</p>
                </div>
            </div>
            
            <h5 class="mt-4">Recent Violations</h5>
            <div class="violations-list">
                ${interview.violations.slice(-5).map(violation => `
                    <div class="violation-item ${violation.severity} mb-2">
                        <strong>${violation.type.replace('_', ' ').toUpperCase()}:</strong> 
                        ${violation.message}
                        <br><small>${new Date(violation.timestamp).toLocaleString()}</small>
                    </div>
                `).join('')}
            </div>
            
            <div class="mt-4">
                <button class="btn btn-primary" onclick="dashboard.downloadReport('${interview.sessionId}')">
                    <i class="fas fa-download"></i> Download Report
                </button>
                <button class="btn btn-secondary" onclick="dashboard.closeModal()">
                    Close
                </button>
            </div>
        `;

        modal.style.display = 'flex';
    }

    /**
     * Close modal
     */
    closeModal() {
        const modal = document.getElementById('interview-modal');
        modal.style.display = 'none';
    }

    /**
     * Send message to candidate
     */
    sendMessage(sessionId) {
        const message = prompt('Enter message to send to candidate:');
        if (message && this.socket) {
            this.socket.emit('interviewer-message', {
                sessionId,
                message,
                interviewerName: 'Interviewer'
            });
            this.showNotification('Message sent to candidate', 'success');
        }
    }

    /**
     * Download report
     */
    async downloadReport(sessionId) {
        try {
            const response = await fetch(`${this.apiBase}/reports/${sessionId}/pdf`);
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `proctoring-report-${sessionId}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showNotification('Report downloaded successfully', 'success');
            } else {
                throw new Error('Failed to download report');
            }
        } catch (error) {
            console.error('Error downloading report:', error);
            this.showError('Failed to download report');
        }
    }

    /**
     * Toggle auto-refresh
     */
    toggleAutoRefresh() {
        this.autoRefresh = !this.autoRefresh;
        const button = document.getElementById('auto-refresh-toggle');
        
        if (button) {
            button.innerHTML = `<i class="fas fa-sync-alt"></i> Auto Refresh: ${this.autoRefresh ? 'ON' : 'OFF'}`;
        }

        if (this.autoRefresh) {
            this.startAutoRefresh();
        } else {
            this.stopAutoRefresh();
        }
    }

    /**
     * Start auto-refresh
     */
    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(() => {
            if (this.autoRefresh) {
                this.loadSectionData(this.currentSection);
            }
        }, 30000); // Refresh every 30 seconds
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Save settings
     */
    saveSettings() {
        const settings = {
            focusThreshold: document.getElementById('focus-threshold')?.value,
            noFaceThreshold: document.getElementById('no-face-threshold')?.value,
            eyeThreshold: document.getElementById('eye-threshold')?.value
        };

        // Save to localStorage for demo
        localStorage.setItem('proctoring-settings', JSON.stringify(settings));
        this.showNotification('Settings saved successfully', 'success');
    }

    /**
     * Utility methods
     */
    getRiskClass(riskLevel) {
        const riskClasses = {
            'low': 'low-risk',
            'medium': 'medium-risk',
            'high': 'high-risk',
            'critical': 'high-risk'
        };
        return riskClasses[riskLevel] || 'low-risk';
    }

    getScoreBadgeClass(score) {
        if (score >= 80) return 'success';
        if (score >= 60) return 'warning';
        return 'danger';
    }

    getSeverityBadgeClass(severity) {
        const classes = {
            'low': 'success',
            'medium': 'warning',
            'high': 'danger'
        };
        return classes[severity] || 'secondary';
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} notification`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            animation: slideIn 0.3s ease-out;
        `;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            ${message}
            <button type="button" class="close" onclick="this.parentElement.remove()">
                <span>&times;</span>
            </button>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    /**
     * Show error message
     */
    showError(message) {
        this.showNotification(message, 'danger');
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Interviewer Dashboard...');
    window.dashboard = new InterviewerDashboard();
});