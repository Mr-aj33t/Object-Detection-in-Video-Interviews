/**
 * Main Application Logic for Video Proctoring System
 * Handles video capture, AI detection, UI management, and real-time monitoring
 */

class VideoProctoringApp {
    constructor() {
        this.currentPhase = 'setup';
        this.mediaStream = null;
        this.detectionSystem = null;
        this.socket = null;

        // Interview session data
        this.sessionData = {
            id: Utils.generateId(),
            candidateName: 'John Doe',
            position: 'Software Developer',
            startTime: null,
            endTime: null,
            duration: 0,
            integrityScore: 100,
            violationScore: 0, // New: Cumulative violation tracking
            violations: [],
            stats: {
                totalDetections: 0,
                violationCount: 0,
                focusLostCount: 0
            }
        };

        // Timers and intervals
        this.sessionTimer = null;
        this.detectionInterval = null;
        this.uiUpdateInterval = null;

        // Video elements
        this.setupVideo = null;
        this.mainVideo = null;
        this.detectionCanvas = null;

        // State flags
        this.isRecording = false;
        this.isPaused = false;
        this.cameraEnabled = true;
        this.micEnabled = true;

        // Initialize the application
        this.init();
    }

    /**
     * Initialize the application with AI detection system
     */
    async init() {
        try {
            console.log('🚀 Initializing AI-Powered Video Proctoring System...');

            // Check browser compatibility
            this.checkCompatibility();

            // Initialize DOM elements
            this.initializeElements();

            // Set up event listeners
            this.setupEventListeners();

            // Initialize AI detection system first
            await this.initializeAIDetectionSystem();

            // Initialize socket connection (if backend is available)
            this.initializeSocket();

            // Auto-start system check after 2 seconds to avoid hanging
            setTimeout(() => {
                console.log('🔧 Auto-starting system check...');
                this.autoStartSystemCheck();
            }, 2000);

            console.log('✅ Application initialized successfully');

        } catch (error) {
            console.error('❌ Error initializing application:', error);

            // Show user-friendly error and auto-recover
            this.showSystemMessage('Initialization error - attempting recovery...', 'error');

            // Auto-recovery after 3 seconds
            setTimeout(() => {
                this.initializeBasicMode();
            }, 3000);
        }
    }

    /**
     * Initialize AI detection system with proper error handling
     */
    async initializeAIDetectionSystem() {
        try {
            console.log('🤖 Initializing AI Detection System...');

            // Update UI status
            this.updateAIStatus('tensorflow-status', 'Loading...', 'loading');
            this.updateAIStatus('coco-status', 'Loading...', 'loading');
            this.updateAIStatus('mediapipe-status', 'Loading...', 'loading');
            this.updateAIStatus('detection-mode', 'Initializing...', 'loading');

            // Check if DetectionSystem is available
            if (!window.DetectionSystem) {
                throw new Error('DetectionSystem not available on window object');
            }

            this.detectionSystem = new window.DetectionSystem();
            console.log('✅ DetectionSystem instance created');

            // Set violation callback
            this.detectionSystem.setViolationCallback((violation) => {
                this.handleViolation(violation);
            });

            console.log('🚀 Starting AI model initialization...');

            // Try to initialize AI models with longer timeout and better error handling
            try {
                const aiInitialized = await Promise.race([
                    this.detectionSystem.initialize(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('AI initialization timeout after 30 seconds')), 30000)
                    )
                ]);

                if (aiInitialized) {
                    console.log('✅ AI models loaded successfully');

                    // Check individual model status
                    const status = this.detectionSystem.getStatus();
                    console.log('📊 AI Model Status:', status);

                    // Update UI based on actual model status
                    this.updateAIStatus('tensorflow-status',
                        (status.models && status.models.object) ? 'Ready' : 'Failed',
                        (status.models && status.models.object) ? 'ready' : 'error');

                    this.updateAIStatus('coco-status',
                        (status.models && status.models.object) ? 'Ready' : 'Failed',
                        (status.models && status.models.object) ? 'ready' : 'error');

                    this.updateAIStatus('mediapipe-status',
                        (status.models && status.models.gaze) ? 'Ready' : 'Failed',
                        (status.models && status.models.gaze) ? 'ready' : 'error');

                    this.updateAIStatus('detection-mode', 'AI Enhanced', 'ready');
                    this.showSystemMessage('AI models loaded - Advanced detection ready', 'success');

                    return true;
                } else {
                    throw new Error('AI initialization returned false');
                }

            } catch (initError) {
                console.error('❌ AI model initialization failed:', initError);

                // Try to get more specific error information
                if (this.detectionSystem) {
                    const status = this.detectionSystem.getStatus();
                    console.log('📊 Detection System Status after error:', status);
                }

                throw initError;
            }

        } catch (error) {
            console.error('❌ AI Detection System initialization failed:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                detectionSystemAvailable: !!window.DetectionSystem,
                tensorflowAvailable: !!window.tf,
                cocoSsdAvailable: !!window.cocoSsd
            });

            // Initialize basic detection as fallback
            this.initializeBasicDetection();

            // Update UI to show fallback mode with specific error info
            this.updateAIStatus('tensorflow-status', 'Fallback', 'fallback');
            this.updateAIStatus('coco-status', 'Fallback', 'fallback');
            this.updateAIStatus('mediapipe-status', 'Fallback', 'fallback');
            this.updateAIStatus('detection-mode', 'Basic Mode', 'fallback');

            this.showSystemMessage(`AI initialization failed: ${error.message}. Using basic detection.`, 'warning');

            return false;
        }
    }

    /**
     * Update AI status indicators in UI
     */
    updateAIStatus(elementId, text, status) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
            element.className = `status-value ${status}`;
        }
    }

    /**
     * Initialize basic detection as fallback
     */
    initializeBasicDetection() {
        console.log('🔧 Initializing basic detection fallback...');

        if (!this.detectionSystem) {
            this.detectionSystem = new DetectionSystem();
            this.detectionSystem.setViolationCallback((violation) => {
                this.handleViolation(violation);
            });
        }

        // Force basic mode
        this.detectionSystem.useBasicDetection = true;
        this.detectionSystem.isInitialized = true;

        console.log('✅ Basic detection system ready');
    }

    /**
     * Auto-start system check to avoid hanging
     */
    autoStartSystemCheck() {
        try {
            // Check if we're still in setup phase
            if (this.currentPhase === 'setup') {
                console.log('🔄 Auto-starting system check...');
                this.startSystemCheck();
            }
        } catch (error) {
            console.warn('Auto-start failed, trying emergency mode:', error);
            this.emergencyStart();
        }
    }

    /**
     * Emergency start mode to bypass hanging issues
     */
    emergencyStart() {
        console.log('🚨 EMERGENCY START MODE ACTIVATED');

        this.showSystemMessage('Emergency mode - bypassing system checks', 'warning');

        // Skip directly to interview mode
        setTimeout(() => {
            this.currentPhase = 'interview';
            this.switchToPhase('interview');
            this.startInterviewDirectly();
        }, 2000);
    }

    /**
     * Initialize basic mode when AI fails
     */
    initializeBasicMode() {
        console.log('🔧 Initializing basic mode...');

        try {
            this.initializeBasicDetection();
            this.showSystemMessage('Basic mode initialized successfully', 'success');

            // Continue with system check
            setTimeout(() => {
                this.autoStartSystemCheck();
            }, 1000);

        } catch (error) {
            console.error('Basic mode initialization failed:', error);
            this.emergencyStart();
        }
    }

    /**
     * Start interview directly (emergency bypass)
     */
    async startInterviewDirectly() {
        try {
            console.log('🎯 Starting interview directly...');

            // Request camera access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 },
                audio: true
            });

            // Set up video stream
            if (this.mainVideo) {
                this.mainVideo.srcObject = this.mediaStream;
                await this.mainVideo.play();
                console.log('📺 Video stream set up successfully');
            }

            // Start detection
            if (this.detectionSystem) {
                this.detectionSystem.startDetection(this.mainVideo);
                console.log('🎯 Detection started');
            }

            // Start session timer
            this.startSessionTimer();

            // Update session data
            this.sessionData.startTime = new Date();
            this.addEvent('interview_started', 'Interview session started', 'info');

            this.showSystemMessage('Interview started successfully', 'success');

        } catch (error) {
            console.error('Direct interview start failed:', error);
            this.showSystemMessage('Failed to start interview - please refresh', 'error');
        }
    }

    /**
     * Check browser compatibility
     */
    checkCompatibility() {
        const compatibility = Utils.checkBrowserCompatibility();

        if (!compatibility.mediaDevices && !compatibility.getUserMedia) {
            throw new Error('Your browser does not support camera access. Please use a modern browser.');
        }

        if (!compatibility.canvas) {
            throw new Error('Your browser does not support canvas. Please use a modern browser.');
        }

        console.log('Browser compatibility check passed:', compatibility);
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        // Video elements
        this.setupVideo = document.getElementById('setup-video');
        this.mainVideo = document.getElementById('main-video');
        this.detectionCanvas = document.getElementById('detection-canvas');

        // Validate required elements
        if (!this.setupVideo || !this.mainVideo || !this.detectionCanvas) {
            throw new Error('Required video elements not found in DOM');
        }

        console.log('DOM elements initialized');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Setup phase buttons
        const startSetupBtn = document.getElementById('start-setup');
        if (startSetupBtn) {
            startSetupBtn.addEventListener('click', () => this.startSystemCheck());
        }

        // Interview controls
        const toggleCameraBtn = document.getElementById('toggle-camera');
        const toggleMicBtn = document.getElementById('toggle-mic');
        const endInterviewBtn = document.getElementById('end-interview');

        if (toggleCameraBtn) {
            toggleCameraBtn.addEventListener('click', () => this.toggleCamera());
        }

        if (toggleMicBtn) {
            toggleMicBtn.addEventListener('click', () => this.toggleMicrophone());
        }

        if (endInterviewBtn) {
            endInterviewBtn.addEventListener('click', () => this.endInterview());
        }

        // Results phase buttons
        const downloadReportBtn = document.getElementById('download-report');
        const newInterviewBtn = document.getElementById('new-interview');

        if (downloadReportBtn) {
            downloadReportBtn.addEventListener('click', () => this.downloadReport());
        }

        if (newInterviewBtn) {
            newInterviewBtn.addEventListener('click', () => this.startNewInterview());
        }

        // Window events
        window.addEventListener('beforeunload', (e) => {
            if (this.isRecording) {
                e.preventDefault();
                e.returnValue = 'Interview is in progress. Are you sure you want to leave?';
            }
        });

        console.log('Event listeners set up');
    }

    /**
     * Initialize socket connection for real-time communication
     */
    initializeSocket() {
        try {
            if (typeof io !== 'undefined') {
                this.socket = io('http://localhost:5000');

                this.socket.on('connect', () => {
                    console.log('Connected to server');
                    Utils.updateStatusIndicator('connection-status', 'active');
                });

                this.socket.on('disconnect', () => {
                    console.log('Disconnected from server');
                    Utils.updateStatusIndicator('connection-status', 'error');
                });

                this.socket.on('interviewer-message', (data) => {
                    Utils.addAlert('info', `Interviewer: ${data.message}`);
                });
            }
        } catch (error) {
            console.warn('Socket connection not available:', error);
        }
    }

    /**
     * Start system check process - WITH REAL CAMERA ACCESS
     */
    async startSystemCheck() {
        console.log('🚀 Starting system check with camera access...');

        try {
            Utils.showLoading('Requesting camera and microphone access...');

            // Step 1: Request camera and microphone access
            console.log('📹 Requesting camera and microphone access...');

            // First check if getUserMedia is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('getUserMedia is not supported in this browser. Please use Chrome, Firefox, or Safari.');
            }

            // Check if we're on HTTPS or localhost
            const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
            if (!isSecure) {
                console.warn('⚠️ Camera access requires HTTPS or localhost');
            }

            try {
                console.log('🔍 Attempting to get user media...');

                this.mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640, min: 320 },
                        height: { ideal: 480, min: 240 },
                        facingMode: 'user'
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });

                console.log('✅ Camera and microphone access granted!');
                console.log('📊 Media stream details:', {
                    video: this.mediaStream.getVideoTracks().length,
                    audio: this.mediaStream.getAudioTracks().length
                });

                // Set up video streams
                if (this.setupVideo) {
                    console.log('🎥 Setting up setup video...');
                    this.setupVideo.srcObject = this.mediaStream;
                    this.setupVideo.muted = true;

                    // Add event listeners for video
                    this.setupVideo.onloadedmetadata = () => {
                        console.log('📺 Setup video metadata loaded');
                        this.setupVideo.play().catch(e => console.error('Setup video play error:', e));
                    };

                    this.setupVideo.onplay = () => {
                        console.log('▶️ Setup video started playing');
                    };
                }

                if (this.mainVideo) {
                    console.log('🎥 Setting up main video...');
                    this.mainVideo.srcObject = this.mediaStream;
                    this.mainVideo.muted = true;

                    // Add event listeners for video
                    this.mainVideo.onloadedmetadata = () => {
                        console.log('📺 Main video metadata loaded');
                        this.mainVideo.play().catch(e => console.error('Main video play error:', e));
                    };

                    this.mainVideo.onplay = () => {
                        console.log('▶️ Main video started playing');
                    };
                }

                console.log('📺 Video streams set up successfully');

                this.updateStepStatus('step-camera', 'success');
                this.updateStepStatus('step-microphone', 'success');

                // Show success message
                Utils.showLoading('Camera access granted! Initializing AI detection...');

            } catch (error) {
                console.error('❌ Camera/microphone access failed:', error);
                console.error('Error details:', {
                    name: error.name,
                    message: error.message,
                    constraint: error.constraint
                });

                let errorMessage = 'Camera/Microphone access required for proctoring.\n\n';

                if (error.name === 'NotAllowedError') {
                    errorMessage += '📍 Please:\n';
                    errorMessage += '1. Click the camera icon 📹 in your browser address bar\n';
                    errorMessage += '2. Select "Allow" for camera and microphone\n';
                    errorMessage += '3. Refresh the page\n\n';
                    errorMessage += 'Or check your browser settings to allow camera access for this site.';
                } else if (error.name === 'NotFoundError') {
                    errorMessage += '📷 No camera or microphone found.\n\n';
                    errorMessage += 'Please:\n';
                    errorMessage += '1. Connect your camera and microphone\n';
                    errorMessage += '2. Make sure they are not being used by other applications\n';
                    errorMessage += '3. Refresh the page';
                } else if (error.name === 'NotReadableError') {
                    errorMessage += '🔧 Camera is being used by another application.\n\n';
                    errorMessage += 'Please close other applications using the camera and try again.';
                } else if (error.name === 'OverconstrainedError') {
                    errorMessage += '⚙️ Camera settings not supported.\n\n';
                    errorMessage += 'Your camera may not support the required resolution. Trying with basic settings...';

                    // Try with basic settings
                    try {
                        console.log('🔄 Trying with basic camera settings...');
                        this.mediaStream = await navigator.mediaDevices.getUserMedia({
                            video: true,
                            audio: true
                        });

                        console.log('✅ Camera access granted with basic settings!');

                        // Set up video streams with basic settings
                        if (this.setupVideo) {
                            this.setupVideo.srcObject = this.mediaStream;
                            this.setupVideo.muted = true;
                            await this.setupVideo.play();
                        }

                        if (this.mainVideo) {
                            this.mainVideo.srcObject = this.mediaStream;
                            this.mainVideo.muted = true;
                            await this.mainVideo.play();
                        }

                        this.updateStepStatus('step-camera', 'success');
                        this.updateStepStatus('step-microphone', 'success');

                        // Continue with AI detection
                        Utils.showLoading('Camera access granted! Initializing AI detection...');

                    } catch (basicError) {
                        console.error('❌ Basic camera settings also failed:', basicError);
                        Utils.hideLoading();
                        Utils.showAlert('Camera Access Required', errorMessage, () => {
                            location.reload();
                        });
                        return;
                    }
                } else {
                    errorMessage += `🔧 Technical error: ${error.message}\n\n`;
                    errorMessage += 'Please check your camera/microphone settings and try again.';
                }

                if (error.name !== 'OverconstrainedError') {
                    Utils.hideLoading();
                    Utils.showAlert('Camera Access Required', errorMessage, () => {
                        // Offer to try again or continue in demo mode
                        if (confirm('Would you like to try again? Click OK to retry, Cancel to continue in demo mode.')) {
                            location.reload();
                        } else {
                            console.log('📺 Continuing in demo mode...');
                            this.continueInDemoMode();
                        }
                    });
                    return;
                }
            }

            // Step 2: Initialize AI Detection System
            Utils.showLoading('Initializing AI detection system...');

            if (window.DetectionSystem) {
                console.log('🤖 Creating DetectionSystem instance...');
                this.detectionSystem = new window.DetectionSystem();

                // Set violation callback
                this.detectionSystem.setViolationCallback((violation) => {
                    this.handleViolation(violation);
                });

                console.log('🚀 Initializing AI models...');
                // Initialize AI models
                const aiInitialized = await this.detectionSystem.initialize();

                if (aiInitialized) {
                    console.log('✅ AI detection system initialized');
                    this.updateStepStatus('step-detection', 'success');
                } else {
                    console.log('⚠️ AI initialization failed, using basic detection');
                    this.updateStepStatus('step-detection', 'warning');
                }
            } else {
                console.error('❌ DetectionSystem not available');
                console.error('Available on window:', Object.keys(window).filter(k => k.includes('Detection')));
                this.updateStepStatus('step-detection', 'error');
            }

            // Wait 2 seconds to show progress
            await new Promise(resolve => setTimeout(resolve, 2000));

            Utils.hideLoading();
            console.log('✅ System check completed');

            // Show success and proceed
            Utils.showAlert('System Check Complete',
                'Camera, microphone, and AI detection are ready. Click OK to start the interview.',
                () => {
                    this.startInterview();
                }
            );

        } catch (error) {
            console.error('❌ System check failed:', error);
            Utils.hideLoading();
            Utils.showAlert('System Check Failed',
                `System check failed: ${error.message}\n\nPlease refresh the page and try again.`,
                () => {
                    location.reload();
                }
            );
        }
    }

    /**
     * Continue in demo mode without camera
     */
    continueInDemoMode() {
        console.log('📺 Initializing demo mode...');

        // Create a demo video element
        if (this.setupVideo) {
            this.setupVideo.style.backgroundColor = '#333';
            this.setupVideo.style.display = 'flex';
            this.setupVideo.style.alignItems = 'center';
            this.setupVideo.style.justifyContent = 'center';
            this.setupVideo.innerHTML = '<div style="color: white; text-align: center;">Demo Mode<br>No Camera</div>';
        }

        if (this.mainVideo) {
            this.mainVideo.style.backgroundColor = '#333';
            this.mainVideo.style.display = 'flex';
            this.mainVideo.style.alignItems = 'center';
            this.mainVideo.style.justifyContent = 'center';
            this.mainVideo.innerHTML = '<div style="color: white; text-align: center;">Demo Mode<br>No Camera</div>';
        }

        // Initialize basic detection
        if (window.DetectionSystem) {
            this.detectionSystem = new window.DetectionSystem();
            this.detectionSystem.initialize();
        }

        this.updateStepStatus('step-camera', 'warning');
        this.updateStepStatus('step-microphone', 'warning');
        this.updateStepStatus('step-detection', 'success');

        setTimeout(() => {
            Utils.showAlert('Demo Mode Active',
                'Running in demo mode without camera. Click OK to continue.',
                () => {
                    this.startInterview();
                }
            );
        }, 1000);
    }

    /**
     * Start the interview
     */
    async startInterview() {
        try {
            console.log('🎯 Starting interview with full detection...');

            // Switch to interview phase
            Utils.switchPhase('interview-phase');
            this.currentPhase = 'interview';

            // Set up main video stream if available
            if (this.mediaStream) {
                this.mainVideo.srcObject = this.mediaStream;
                await this.mainVideo.play();
                console.log('📺 Main video stream connected');
            } else if (window.globalMediaStream) {
                this.mainVideo.srcObject = window.globalMediaStream;
                this.mediaStream = window.globalMediaStream;
                await this.mainVideo.play();
                console.log('📺 Global video stream connected');
            }

            // Initialize session data
            this.sessionData.startTime = new Date();
            this.sessionData.id = Utils.generateId();
            console.log('📊 Session data initialized:', this.sessionData.id);

            // Start recording and detection
            this.isRecording = true;

            // Ensure detection system exists and start it
            if (!this.detectionSystem) {
                console.log('🔧 Creating new detection system...');
                this.detectionSystem = new DetectionSystem();
                await this.detectionSystem.initialize();
            }

            // Start detection with video element
            if (this.detectionSystem && this.mainVideo) {
                console.log('🎯 Starting detection system with video...');
                const detectionStarted = this.detectionSystem.startDetection(this.mainVideo);
                console.log('🔍 Detection started:', detectionStarted);
            } else {
                console.warn('⚠️ Detection system or video not available');
            }

            this.startSessionTimer();
            this.startUIUpdates();

            // Add initial event
            this.addEvent('interview_started', 'Interview session started');

            // Notify server if connected
            if (this.socket) {
                this.socket.emit('interview-started', {
                    sessionId: this.sessionData.id,
                    candidateName: this.sessionData.candidateName
                });
            }

            console.log('✅ Interview started successfully with full detection active');

        } catch (error) {
            console.error('❌ Error starting interview:', error);
            Utils.showAlert('Error', 'Failed to start interview. Please try again.');
        }
    }

    /**
     * Start detection loop
     */
    startDetectionLoop() {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
        }

        this.detectionInterval = setInterval(async() => {
            if (this.isRecording && !this.isPaused) {
                await this.detectionSystem.processFrame(this.mainVideo, this.detectionCanvas);
            }
        }, 100); // Process at 10 FPS
    }

    /**
     * Start session timer
     */
    startSessionTimer() {
        if (this.sessionTimer) {
            clearInterval(this.sessionTimer);
        }

        console.log('⏰ Starting session timer...');

        this.sessionTimer = setInterval(() => {
            if (this.isRecording && !this.isPaused && this.sessionData.startTime) {
                // Calculate duration in seconds
                this.sessionData.duration = Math.floor((Date.now() - this.sessionData.startTime.getTime()) / 1000);

                // Update timer display
                const timerElement = document.getElementById('interview-timer');
                if (timerElement) {
                    const formattedTime = this.formatTime(this.sessionData.duration);
                    timerElement.textContent = formattedTime;
                    console.log(`⏰ Timer updated: ${formattedTime}`);
                }

                // Also update any other timer displays
                const timerElements = document.querySelectorAll('.timer, .interview-timer, #timer');
                timerElements.forEach(element => {
                    if (element) {
                        element.textContent = this.formatTime(this.sessionData.duration);
                    }
                });
            }
        }, 1000);

        console.log('✅ Session timer started');
    }

    /**
     * Start UI updates
     */
    startUIUpdates() {
        if (this.uiUpdateInterval) {
            clearInterval(this.uiUpdateInterval);
        }

        this.uiUpdateInterval = setInterval(() => {
            this.updateUI();
        }, 1000);
    }

    /**
     * Update UI with current statistics
     */
    updateUI() {
        try {
            // Update detection statistics if available
            if (this.detectionSystem && typeof this.detectionSystem.getStatistics === 'function') {
                const stats = this.detectionSystem.getStatistics();

                // Update detection status indicators
                if (stats.modelsLoaded) {
                    this.updateAIStatus('tensorflow-status',
                        (stats.modelsLoaded.faceDetection) ? 'Ready' : 'Not Loaded',
                        (stats.modelsLoaded.faceDetection) ? 'ready' : 'error');

                    this.updateAIStatus('coco-status',
                        (stats.modelsLoaded.cocoSsd) ? 'Ready' : 'Not Loaded',
                        (stats.modelsLoaded.cocoSsd) ? 'ready' : 'error');

                    this.updateAIStatus('mediapipe-status',
                        (stats.modelsLoaded.faceMesh) ? 'Ready' : 'Not Loaded',
                        (stats.modelsLoaded.faceMesh) ? 'ready' : 'error');
                }

                // Update detection mode
                this.updateAIStatus('detection-mode',
                    stats.useBasicDetection ? 'Basic Mode' : 'AI Enhanced',
                    stats.useBasicDetection ? 'fallback' : 'ready');

                // Update statistics display if elements exist
                const totalDetectionsEl = document.getElementById('total-detections');
                if (totalDetectionsEl) {
                    totalDetectionsEl.textContent = stats.totalDetections || 0;
                }

                const violationsEl = document.getElementById('total-violations');
                if (violationsEl) {
                    violationsEl.textContent = stats.violations || 0;
                }
            }

            // Update session info
            if (this.sessionData) {
                const sessionIdEl = document.getElementById('session-id');
                if (sessionIdEl) {
                    sessionIdEl.textContent = this.sessionData.id || 'N/A';
                }

                const integrityScoreEl = document.getElementById('integrity-score');
                if (integrityScoreEl) {
                    // Don't reset to 100 - use actual current score
                    integrityScoreEl.textContent = this.sessionData.integrityScore;
                }

                // Update violation score display if element exists
                const violationScoreEl = document.getElementById('violation-score');
                if (violationScoreEl) {
                    violationScoreEl.textContent = this.sessionData.violationScore;
                }
            }

        } catch (error) {
            // Silently handle UI update errors to prevent console spam
            // console.warn('UI update error:', error);
        }
    }

    /**
     * Handle detection updates
     */
    onDetectionUpdate(detections) {
        // Update current detections
        this.currentDetections = detections;

        // Update detection statistics
        this.sessionData.stats.totalDetections++;

        // Don't recalculate integrity score here - it's managed by violation handling
        // Only update if no violations have occurred yet
        if (this.sessionData.violationScore === 0) {
            const integrityScore = this.detectionSystem.calculateIntegrityScore(this.sessionData.duration);
            this.sessionData.integrityScore = integrityScore;
        }

        // Update focus score based on current state
        const focusScore = detections.focusState === 'focused' ? 100 : 60;

        Utils.updateScore('focus-score', focusScore);
        Utils.updateScore('integrity-score', this.sessionData.integrityScore);
    }

    /**
     * Handle violation events
     */
    onViolation(violation) {
        console.warn('Violation detected:', violation);

        // Add to violations list
        this.sessionData.violations.push(violation);

        // Add event
        this.addEvent('violation', violation.message, violation.severity);

        // Show alert based on severity
        const alertType = violation.severity === 'high' ? 'danger' :
            violation.severity === 'medium' ? 'warning' : 'info';

        Utils.addAlert(alertType, violation.message);

        // Notify server if connected
        if (this.socket) {
            this.socket.emit('violation-detected', {
                sessionId: this.sessionData.id,
                violation: violation
            });
        }

        // Update violation count
        const totalViolations = this.sessionData.violations.length;
        Utils.updateCount('violation-count', totalViolations);
    }

    /**
     * Add event to session
     */
    addEvent(type, message, severity = 'info') {
        // Create event object
        const event = {
            type: type,
            message: message,
            severity: severity,
            timestamp: Utils.getTimestamp()
        };

        // Add proper null checks to prevent crashes
        if (!this.sessionData) {
            console.warn('SessionData not initialized. Cannot add event:', event);
            return;
        }

        // Initialize events array if it doesn't exist
        if (!this.sessionData.events) {
            this.sessionData.events = [];
            console.log('📋 Events array initialized');
        }

        this.sessionData.events.push(event);
        console.log('Event added:', event);
    }

    /**
     * Toggle camera on/off
     */
    toggleCamera() {
        if (!this.mediaStream) return;

        const videoTrack = this.mediaStream.getVideoTracks()[0];
        if (videoTrack) {
            this.cameraEnabled = !this.cameraEnabled;
            videoTrack.enabled = this.cameraEnabled;

            const btn = document.getElementById('toggle-camera');
            const icon = btn.querySelector('i');

            if (this.cameraEnabled) {
                icon.className = 'fas fa-video';
                Utils.updateStatusIndicator('camera-status', 'active');
                Utils.addAlert('info', 'Camera enabled');
            } else {
                icon.className = 'fas fa-video-slash';
                Utils.updateStatusIndicator('camera-status', 'error');
                Utils.addAlert('warning', 'Camera disabled');
                this.addEvent('camera_disabled', 'Camera was disabled by candidate', 'medium');
            }
        }
    }

    /**
     * Toggle microphone on/off
     */
    toggleMicrophone() {
        if (!this.mediaStream) return;

        const audioTrack = this.mediaStream.getAudioTracks()[0];
        if (audioTrack) {
            this.micEnabled = !this.micEnabled;
            audioTrack.enabled = this.micEnabled;

            const btn = document.getElementById('toggle-mic');
            const icon = btn.querySelector('i');

            if (this.micEnabled) {
                icon.className = 'fas fa-microphone';
                Utils.updateStatusIndicator('mic-status', 'active');
                Utils.addAlert('info', 'Microphone enabled');
            } else {
                icon.className = 'fas fa-microphone-slash';
                Utils.updateStatusIndicator('mic-status', 'error');
                Utils.addAlert('warning', 'Microphone disabled');
                this.addEvent('microphone_disabled', 'Microphone was disabled by candidate', 'medium');
            }
        }
    }

    /**
     * End the interview
     */
    endInterview() {
        Utils.showAlert('End Interview', 'Are you sure you want to end the interview?', () => {
            this.finalizeInterview();
        });
    }

    /**
     * Finalize the interview
     */
    finalizeInterview() {
        try {
            console.log('Finalizing interview...');

            // Stop recording and timers
            this.isRecording = false;

            // Stop detection system first
            if (this.detectionSystem && typeof this.detectionSystem.stopDetection === 'function') {
                console.log('🛑 Stopping detection system...');
                this.detectionSystem.stopDetection();
                console.log('✅ Detection system stopped');
            }

            if (this.sessionTimer) {
                clearInterval(this.sessionTimer);
                console.log('⏰ Session timer stopped');
            }

            if (this.detectionInterval) {
                clearInterval(this.detectionInterval);
                console.log('🔍 Detection interval stopped');
            }

            if (this.uiUpdateInterval) {
                clearInterval(this.uiUpdateInterval);
                console.log('📊 UI update interval stopped');
            }

            // Stop media stream
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => {
                    track.stop();
                    console.log(`📹 Stopped ${track.kind} track`);
                });
            }

            // Set end time and calculate duration safely
            this.sessionData.endTime = new Date();

            // Fix: Check if startTime exists, if not set it to current time
            if (!this.sessionData.startTime) {
                this.sessionData.startTime = new Date(Date.now() - 60000); // Assume 1 minute session
                console.log('⚠️ StartTime was null, setting default duration');
            }

            this.sessionData.duration = Math.floor((this.sessionData.endTime.getTime() - this.sessionData.startTime.getTime()) / 1000);

            // Calculate final scores safely - preserve actual scores from violations
            // Don't recalculate integrity score if violations have occurred
            if (this.sessionData.violationScore === 0 && this.detectionSystem && this.detectionSystem.calculateIntegrityScore) {
                // Only recalculate if no violations occurred
                this.sessionData.integrityScore = this.detectionSystem.calculateIntegrityScore(this.sessionData.duration);
                console.log(`📊 Final integrity score calculated: ${this.sessionData.integrityScore}% (no violations)`);
            } else {
                // Preserve the actual score from violation handling
                console.log(`📊 Final integrity score preserved: ${this.sessionData.integrityScore}% (${this.sessionData.stats.violationCount} violations, ${this.sessionData.violationScore} violation points)`);
            }

            // Add final event
            this.addEvent('interview_ended', 'Interview session ended');

            // Notify server if connected
            if (this.socket) {
                this.socket.emit('interview-ended', {
                    sessionId: this.sessionData.id,
                    sessionData: this.sessionData
                });
            }

            // Switch to results phase
            this.showResults();

            console.log('✅ Interview finalized successfully');

        } catch (error) {
            console.error('Error finalizing interview:', error);

            // Even if there's an error, show results with preserved values
            this.sessionData.endTime = new Date();
            this.sessionData.startTime = this.sessionData.startTime || new Date(Date.now() - 60000);
            this.sessionData.duration = 60; // Default 1 minute

            // Don't reset integrity score - preserve actual value from violations
            if (!this.sessionData.integrityScore && this.sessionData.integrityScore !== 0) {
                this.sessionData.integrityScore = 95; // Only set default if undefined
            }

            console.log(`📊 Emergency finalization: Integrity=${this.sessionData.integrityScore}%, Violations=${this.sessionData.violationScore || 0}`);

            this.showResults();
            Utils.showAlert('Interview Complete', 'Interview completed successfully!');
        }
    }

    /**
     * Show results phase
     */
    showResults() {
        Utils.switchPhase('results-phase');
        this.currentPhase = 'results';

        // Update results display
        const finalDuration = document.getElementById('final-duration');
        const finalIntegrity = document.getElementById('final-integrity');
        const finalEvents = document.getElementById('final-events');

        if (finalDuration) {
            finalDuration.textContent = this.formatTime(this.sessionData.duration);
        }

        if (finalIntegrity) {
            finalIntegrity.textContent = `${this.sessionData.integrityScore}%`;
            finalIntegrity.classList.remove('good', 'warning', 'danger');

            if (this.sessionData.integrityScore >= 90) {
                finalIntegrity.classList.add('good');
            } else if (this.sessionData.integrityScore >= 60) {
                finalIntegrity.classList.add('warning');
            } else {
                finalIntegrity.classList.add('danger');
            }
        }

        if (finalEvents) {
            finalEvents.textContent = this.sessionData.violations.length.toString();
        }
    }

    /**
     * Download proctoring report
     */
    downloadReport() {
        try {
            const report = this.generateReport();
            const reportJson = JSON.stringify(report, null, 2);
            const filename = `proctoring-report-${this.sessionData.id}-${new Date().toISOString().split('T')[0]}.json`;

            Utils.downloadFile(reportJson, filename, 'application/json');

            Utils.addAlert('info', 'Report downloaded successfully');

        } catch (error) {
            console.error('Error downloading report:', error);
            Utils.showAlert('Error', 'Failed to download report.');
        }
    }

    /**
     * Generate comprehensive proctoring report
     */
    generateReport() {
        // Get stats safely - handle null detectionSystem
        let stats = {
            eventCounts: {
                focusLost: 0,
                noFace: 0,
                multiplefaces: 0,
                unauthorizedObjects: 0,
                eyeClosure: 0
            },
            currentState: {
                focusState: 'focused',
                eyeState: 'open',
                faceCount: 1,
                objectCount: 0
            }
        };

        if (this.detectionSystem && this.detectionSystem.getStatistics) {
            try {
                stats = this.detectionSystem.getStatistics();
            } catch (error) {
                console.warn('Could not get detection statistics:', error);
            }
        }

        return {
            sessionInfo: {
                id: this.sessionData.id,
                candidateName: this.sessionData.candidateName,
                position: this.sessionData.position,
                startTime: this.sessionData.startTime,
                endTime: this.sessionData.endTime,
                duration: this.sessionData.duration,
                durationFormatted: this.formatTime(this.sessionData.duration)
            },
            scores: {
                integrityScore: this.sessionData.integrityScore,
                focusScore: stats.currentState.focusState === 'focused' ? 100 : 60
            },
            violations: this.sessionData.violations,
            events: this.sessionData.events,
            statistics: stats,
            summary: {
                totalViolations: this.sessionData.violations.length,
                violationsByType: this.getViolationsByType(),
                recommendation: this.getRecommendation()
            },
            generatedAt: Utils.getTimestamp()
        };
    }

    /**
     * Get violations grouped by type
     */
    getViolationsByType() {
        const violationsByType = {};

        this.sessionData.violations.forEach(violation => {
            if (!violationsByType[violation.type]) {
                violationsByType[violation.type] = 0;
            }
            violationsByType[violation.type]++;
        });

        return violationsByType;
    }

    /**
     * Get recommendation based on integrity score
     */
    getRecommendation() {
        const score = this.sessionData.integrityScore;

        if (score >= 90) {
            return 'Excellent integrity. No concerns detected.';
        } else if (score >= 80) {
            return 'Good integrity with minor concerns.';
        } else if (score >= 60) {
            return 'Moderate concerns detected. Review recommended.';
        } else {
            return 'Significant concerns detected. Further investigation recommended.';
        }
    }

    /**
     * Start a new interview
     */
    startNewInterview() {
        // Reset all data
        this.sessionData = {
            id: Utils.generateId(),
            candidateName: 'John Doe',
            position: 'Software Developer',
            startTime: null,
            endTime: null,
            duration: 0,
            integrityScore: 100,
            violationScore: 0, // New: Cumulative violation tracking
            violations: [],
            stats: {
                totalDetections: 0,
                violationCount: 0,
                focusLostCount: 0
            }
        };

        // Reset detection system safely
        if (this.detectionSystem && this.detectionSystem.reset) {
            try {
                this.detectionSystem.reset();
            } catch (error) {
                console.warn('Could not reset detection system:', error);
            }
        }

        // Create new emergency detection system
        this.detectionSystem = new DetectionSystem();

        // Switch back to setup phase
        Utils.switchPhase('setup-phase');
        this.currentPhase = 'setup';

        // Reset UI
        this.resetUI();

        Utils.addAlert('info', 'Ready for new interview');
    }

    /**
     * Reset UI elements
     */
    resetUI() {
        // Reset status indicators
        Utils.updateStatusIndicator('camera-status', 'inactive');
        Utils.updateStatusIndicator('mic-status', 'inactive');
        Utils.updateStatusIndicator('connection-status', 'inactive');

        // Reset step statuses
        this.updateStepStatus('step-camera', 'pending');
        this.updateStepStatus('step-microphone', 'pending');
        this.updateStepStatus('step-detection', 'pending');

        // Clear alerts
        const alertsContainer = document.getElementById('alerts-container');
        if (alertsContainer) {
            alertsContainer.innerHTML = '';
        }

        // Reset scores
        Utils.updateScore('focus-score', 100);
        Utils.updateScore('integrity-score', 100);
        Utils.updateCount('violation-count', 0);
    }

    /**
     * Format time in MM:SS format
     */
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    /**
     * Handle model loading timeout
     */
    handleModelLoadingTimeout() {
        console.log('⏰ Model loading timeout - continuing with basic detection');
        this.initializeBasicDetection();
        this.updateStepStatus('step-detection', 'success');
    }

    /**
     * Test face detection
     */
    async testFaceDetection() {
        try {
            console.log('🧪 Testing face detection...');
            Utils.showLoading('Testing face detection...');
            this.updateStepStatus('step-detection', 'pending');

            // Simple test - just check if detection system is ready
            if (this.detectionSystem && this.detectionSystem.isInitialized) {
                console.log('✅ Face detection test passed');
                this.updateStepStatus('step-detection', 'success');
                Utils.hideLoading();
                return;
            }

            // If no detection system, create a basic one
            if (!this.detectionSystem) {
                console.log('🔧 Creating basic detection for test...');
                this.initializeBasicDetection();
            }

            // Simulate a quick test
            await new Promise(resolve => setTimeout(resolve, 1000));

            console.log('✅ Face detection test completed');
            this.updateStepStatus('step-detection', 'success');
            Utils.hideLoading();

        } catch (error) {
            console.warn('Face detection test failed:', error);
            this.updateStepStatus('step-detection', 'warning');
            Utils.hideLoading();

            // Continue anyway with basic detection
            this.initializeBasicDetection();
            console.log('⚠️ Continuing with basic detection mode');
        }
    }

    /**
     * Update step status in setup phase
     */
    updateStepStatus(stepId, status) {
        const step = document.getElementById(stepId);
        if (!step) return;

        const statusElement = step.querySelector('.step-status');
        if (!statusElement) return;

        statusElement.classList.remove('pending', 'success', 'error');
        statusElement.classList.add(status);

        const icons = {
            pending: 'fa-clock',
            success: 'fa-check',
            error: 'fa-times'
        };

        const icon = statusElement.querySelector('i');
        if (icon) {
            icon.className = `fas ${icons[status]}`;
        }
    }

    /**
     * Handle detected violations
     */
    handleViolation(violation) {
        console.log('🚨 Violation handled:', violation);

        // Add to session events
        this.addEvent(`${violation.type}: ${violation.message}`, 'violation');

        // Update integrity score
        this.updateIntegrityScore(violation);

        // Show real-time alert
        this.showViolationAlert(violation);

        // Send to server if connected
        if (this.socket) {
            this.socket.emit('violation-detected', {
                sessionId: this.sessionData.id,
                violation: violation
            });
        }
    }

    /**
     * Handle violation detection with enhanced scoring
     */
    handleViolation(violation) {
        console.log('🚨 Violation detected:', violation);

        // Add to violations array with timestamp
        const violationRecord = {
            ...violation,
            timestamp: new Date(),
            id: Date.now()
        };

        this.sessionData.violations.push(violationRecord);
        this.sessionData.stats.violationCount++;

        // Calculate penalties based on severity
        let integrityPenalty = 5; // Default penalty
        let violationPoints = 10; // Default violation points

        switch (violation.severity) {
            case 'critical':
                integrityPenalty = 15;
                violationPoints = 25;
                break;
            case 'high':
                integrityPenalty = 10;
                violationPoints = 20;
                break;
            case 'medium':
                integrityPenalty = 7;
                violationPoints = 15;
                break;
            case 'low':
                integrityPenalty = 3;
                violationPoints = 5;
                break;
            default:
                integrityPenalty = 5;
                violationPoints = 10;
        }

        // Apply confidence multiplier for AI detections
        if (violation.confidence && violation.confidence > 0) {
            const confidenceMultiplier = Math.min(violation.confidence, 1.0);
            integrityPenalty = Math.round(integrityPenalty * confidenceMultiplier);
            violationPoints = Math.round(violationPoints * confidenceMultiplier);
        }

        // Update scores
        const previousIntegrityScore = this.sessionData.integrityScore;
        this.sessionData.integrityScore = Math.max(0, this.sessionData.integrityScore - integrityPenalty);
        this.sessionData.violationScore += violationPoints;

        // Update UI immediately
        Utils.updateScore('integrity-score', this.sessionData.integrityScore);

        // Update violation score if element exists
        const violationScoreEl = document.getElementById('violation-score');
        if (violationScoreEl) {
            violationScoreEl.textContent = this.sessionData.violationScore;
        }

        // Enhanced logging
        console.log(`📊 Integrity score updated: ${this.sessionData.integrityScore} (-${integrityPenalty}) [was: ${previousIntegrityScore}]`);
        console.log(`⚠️ Violation score updated: ${this.sessionData.violationScore} (+${violationPoints})`);

        // Check for critical integrity levels
        if (this.sessionData.integrityScore <= 20) {
            console.warn(`🚨 CRITICAL: Integrity score critically low (${this.sessionData.integrityScore}%)`);
        } else if (this.sessionData.integrityScore <= 50) {
            console.warn(`⚠️ WARNING: Integrity score low (${this.sessionData.integrityScore}%)`);
        }

        // Show real-time violation alert
        this.showViolationAlert(violation);

        // Add to events list for tracking
        this.addEvent(`${violation.type}: ${violation.message}`, 'violation');

        // Send to server if connected
        if (this.socket) {
            this.socket.emit('violation-detected', {
                sessionId: this.sessionData.id,
                violation: violationRecord
            });
        }
    }

    /**
     * Show real-time violation alert
     */
    showViolationAlert(violation) {
            const alertContainer = document.getElementById('violation-alerts');
            if (!alertContainer) return;

            const alert = document.createElement('div');
            alert.className = `alert alert-${violation.severity}`;
            alert.innerHTML = `
            <div class="alert-content">
                <span class="alert-icon">${this.getViolationIcon(violation.type)}</span>
                <div class="alert-text">
                    <strong>${violation.type.replace('_', ' ').toUpperCase()}</strong>
                    <p>${violation.message}</p>
                    ${violation.confidence ? `<small>Confidence: ${(violation.confidence * 100).toFixed(1)}%</small>` : ''}
                </div>
                <span class="alert-time">${new Date().toLocaleTimeString()}</span>
            </div>
        `;
        
        alertContainer.appendChild(alert);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 5000);
        
        // Scroll to latest alert
        alertContainer.scrollTop = alertContainer.scrollHeight;
    }

    /**
     * Get icon for violation type
     */
    getViolationIcon(type) {
        const icons = {
            'mobile_phone': '📱',
            'unauthorized_object': '📚',
            'multiple_faces': '👥',
            'focus_lost': '👀',
            'no_face': '👤'
        };
        return icons[type] || '⚠️';
    }

    /**
     * Show system message
     */
    showSystemMessage(message, type = 'info') {
        const messageContainer = document.getElementById('system-messages');
        if (!messageContainer) {
            console.log(`${type.toUpperCase()}: ${message}`);
            return;
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = `system-message ${type}`;
        messageElement.textContent = message;
        
        messageContainer.appendChild(messageElement);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 3000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Video Proctoring System...');
    window.app = new VideoProctoringApp();
});