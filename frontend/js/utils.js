/**
 * Utility functions for the Video Proctoring System
 */

class Utils {
    /**
     * Format time in HH:MM:SS format
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted time string
     */
    static formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Generate unique ID
     * @returns {string} Unique identifier
     */
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Get current timestamp
     * @returns {string} ISO timestamp
     */
    static getTimestamp() {
        return new Date().toISOString();
    }

    /**
     * Show loading overlay
     * @param {string} message - Loading message
     */
    static showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const text = document.getElementById('loading-text');
        if (text) text.textContent = message;
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.style.display = 'flex';
        }
    }

    /**
     * Hide loading overlay
     */
    static hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }
    }

    /**
     * Show alert modal
     * @param {string} title - Alert title
     * @param {string} message - Alert message
     * @param {Function} callback - Callback function
     */
    static showAlert(title, message, callback = null) {
        const modal = document.getElementById('alert-modal');
        const titleEl = document.getElementById('alert-title');
        const messageEl = document.getElementById('alert-message');
        const okBtn = document.getElementById('alert-ok');
        const closeBtn = document.getElementById('close-alert');

        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;
        if (modal) modal.classList.add('active');

        const handleClose = () => {
            modal.classList.remove('active');
            if (callback) callback();
            okBtn.removeEventListener('click', handleClose);
            closeBtn.removeEventListener('click', handleClose);
        };

        okBtn.addEventListener('click', handleClose);
        closeBtn.addEventListener('click', handleClose);
    }

    /**
     * Update status indicator
     * @param {string} indicatorId - ID of the indicator element
     * @param {string} status - Status: 'active', 'error', or 'inactive'
     */
    static updateStatusIndicator(indicatorId, status) {
        const indicator = document.getElementById(indicatorId);
        if (!indicator) return;

        indicator.classList.remove('active', 'error');
        if (status === 'active' || status === 'error') {
            indicator.classList.add(status);
        }
    }

    /**
     * Add alert to the alerts panel
     * @param {string} type - Alert type: 'info', 'warning', 'danger'
     * @param {string} message - Alert message
     * @param {string} timestamp - Optional timestamp
     */
    static addAlert(type, message, timestamp = null) {
        const container = document.getElementById('alerts-container');
        if (!container) return;

        const alertElement = document.createElement('div');
        alertElement.className = `alert-item ${type}`;

        const time = timestamp || new Date().toLocaleTimeString();
        alertElement.innerHTML = `
            <i class="fas ${this.getAlertIcon(type)}"></i>
            <div>
                <div>${message}</div>
                <small>${time}</small>
            </div>
        `;

        container.insertBefore(alertElement, container.firstChild);

        // Remove old alerts if too many
        const alerts = container.querySelectorAll('.alert-item');
        if (alerts.length > 10) {
            alerts[alerts.length - 1].remove();
        }

        // Auto-remove info alerts after 5 seconds
        if (type === 'info') {
            setTimeout(() => {
                if (alertElement.parentNode) {
                    alertElement.remove();
                }
            }, 5000);
        }
    }

    /**
     * Get icon for alert type
     * @param {string} type - Alert type
     * @returns {string} Font Awesome icon class
     */
    static getAlertIcon(type) {
        const icons = {
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle',
            danger: 'fa-exclamation-circle'
        };
        return icons[type] || 'fa-info-circle';
    }

    /**
     * Update score display
     * @param {string} elementId - Element ID
     * @param {number} score - Score value (0-100)
     */
    static updateScore(elementId, score) {
        const element = document.getElementById(elementId);
        if (!element) return;

        element.textContent = `${Math.round(score)}%`;
        element.classList.remove('good', 'warning', 'danger');

        if (score >= 80) {
            element.classList.add('good');
        } else if (score >= 60) {
            element.classList.add('warning');
        } else {
            element.classList.add('danger');
        }
    }

    /**
     * Update count display
     * @param {string} elementId - Element ID
     * @param {number} count - Count value
     */
    static updateCount(elementId, count) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = count.toString();
        }
    }

    /**
     * Switch between phases
     * @param {string} phaseId - ID of the phase to show
     */
    static switchPhase(phaseId) {
        // Hide all phases
        const phases = document.querySelectorAll('.phase');
        phases.forEach(phase => {
            phase.classList.remove('active');
        });

        // Show target phase
        const targetPhase = document.getElementById(phaseId);
        if (targetPhase) {
            targetPhase.classList.add('active');
        }
    }

    /**
     * Check browser compatibility
     * @returns {Object} Compatibility check results
     */
    static checkBrowserCompatibility() {
        const results = {
            webrtc: false,
            mediaDevices: false,
            canvas: false,
            webgl: false,
            getUserMedia: false
        };

        // Check WebRTC support
        results.webrtc = !!(window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection);

        // Check MediaDevices API
        results.mediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

        // Check getUserMedia (legacy)
        results.getUserMedia = !!(navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia);

        // Check Canvas support
        results.canvas = !!document.createElement('canvas').getContext;

        // Check WebGL support
        try {
            const canvas = document.createElement('canvas');
            results.webgl = !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
            results.webgl = false;
        }

        return results;
    }

    /**
     * Request camera and microphone permissions
     * @returns {Promise<MediaStream>} Media stream
     */
    static async requestMediaPermissions() {
        try {
            const constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            return stream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw error;
        }
    }

    /**
     * Download data as file
     * @param {string} data - Data to download
     * @param {string} filename - File name
     * @param {string} type - MIME type
     */
    static downloadFile(data, filename, type = 'application/json') {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    }

    /**
     * Calculate distance between two points
     * @param {Object} point1 - First point {x, y}
     * @param {Object} point2 - Second point {x, y}
     * @returns {number} Distance
     */
    static calculateDistance(point1, point2) {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate angle between three points
     * @param {Object} point1 - First point
     * @param {Object} point2 - Center point
     * @param {Object} point3 - Third point
     * @returns {number} Angle in degrees
     */
    static calculateAngle(point1, point2, point3) {
        const vector1 = { x: point1.x - point2.x, y: point1.y - point2.y };
        const vector2 = { x: point3.x - point2.x, y: point3.y - point2.y };

        const dot = vector1.x * vector2.x + vector1.y * vector2.y;
        const mag1 = Math.sqrt(vector1.x * vector1.x + vector1.y * vector1.y);
        const mag2 = Math.sqrt(vector2.x * vector2.x + vector2.y * vector2.y);

        const cosAngle = dot / (mag1 * mag2);
        const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

        return angle * (180 / Math.PI);
    }

    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Deep clone object
     * @param {Object} obj - Object to clone
     * @returns {Object} Cloned object
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    }

    /**
     * Local storage helpers
     */
    static storage = {
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                console.error('Error saving to localStorage:', error);
            }
        },

        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.error('Error reading from localStorage:', error);
                return defaultValue;
            }
        },

        remove(key) {
            try {
                localStorage.removeItem(key);
            } catch (error) {
                console.error('Error removing from localStorage:', error);
            }
        },

        clear() {
            try {
                localStorage.clear();
            } catch (error) {
                console.error('Error clearing localStorage:', error);
            }
        }
    };
}

// Export for use in other modules
window.Utils = Utils;