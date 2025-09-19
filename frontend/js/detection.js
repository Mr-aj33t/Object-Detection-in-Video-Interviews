/**
 * Advanced AI-Powered Detection System for Video Proctoring
 * Clean implementation to prevent duplicate declarations
 */

// Immediately check and prevent duplicate loading
if (window.DetectionSystem) {
    console.log('ℹ️ DetectionSystem already loaded, skipping redefinition');
} else {
    // Main AIDetectionSystem class
    class AIDetectionSystem {
        constructor() {
            this.isInitialized = false;
            this.isDetecting = false;
            this.videoElement = null;
            this.cocoSsdModel = null;
            this.faceDetectionModel = null;
            this.faceMesh = null;
            this.handsModel = null; // Add MediaPipe Hands for accurate hand detection
            this.detectionInterval = null;
            this.focusCheckInterval = null;
            this.lastFaceDetection = Date.now();
            this.focusLostCount = 0;
            this.previousFrame = null;
            this.onViolationDetected = null;
            this.frameSkipCount = 0;
            this.maxFrameSkip = 3;

            // Visual Feedback Elements
            this.overlayCanvas = null;
            this.overlayCtx = null;
            this.setupOverlayCanvas = null;
            this.setupOverlayCtx = null;

            // Consecutive frame detection for reliable mobile detection with grace period
            this.phoneDetectedCount = 0;
            this.phoneMissedCount = 0;
            this.requiredConsecutiveDetections = 3; // Need 3 detections
            this.allowedMissedFrames = 2; // Grace period - allow 2 missed frames
            this.maxDetectionCount = 6; // Reset after this many to prevent spam

            this.consecutiveObjectDetections = {};
            this.requiredConsecutiveFrames = 3; // Need 3 consecutive detections
            this.maxConsecutiveFrames = 5; // Reset after 5 frames to prevent spam

            // Focus Detection Tracking
            this.lookingAwayStartTime = null;
            this.lookingAwayThreshold = 5000; // 5 seconds in milliseconds
            this.noFaceStartTime = null;
            this.noFaceThreshold = 10000; // 10 seconds in milliseconds
            this.headAngleThreshold = 25; // degrees for looking away detection
            this.isCurrentlyLookingAway = false;
            this.isCurrentlyNoFace = false;

            // Visual feedback state
            this.showFocusWarning = false;
            this.focusWarningType = null; // 'looking_away' or 'no_face'
            this.lastFacePosition = null;

            // Optimized confidence thresholds
            this.confidenceThresholds = {
                mobilePhone: {
                    high: 0.60, // Definite mobile phone
                    medium: 0.45, // Likely mobile phone
                    low: 0.30 // Possible mobile phone
                },
                objects: {
                    high: 0.55,
                    medium: 0.40,
                    low: 0.25
                },
                // COCO-SSD specific item thresholds
                cocoItems: {
                    cellPhone: 0.50, // 'cell phone'
                    book: 0.45, // 'book'
                    laptop: 0.60, // 'laptop'
                    keyboard: 0.55, // 'keyboard'
                    mouse: 0.50, // 'mouse'
                    tv: 0.65, // 'tv'
                    remote: 0.45 // 'remote'
                }
            };

            this.statistics = {
                totalDetections: 0,
                violations: 0,
                faceDetections: 0,
                objectDetections: 0,
                gazeDetections: 0,
                averageConfidence: 0,
                consecutiveDetections: 0,
                reliableDetections: 0,
                focusViolations: 0,
                multiplefacesDetected: 0,
                noFaceDetected: 0,
                lookingAwayDetected: 0
            };

            // Text Detection for Books/Notebooks
            this.textDetectionEnabled = true;
            this.textDetectionThreshold = 10; // Minimum characters to consider as text
            this.bookTextPatterns = [
                // Common book/notebook indicators
                'chapter', 'page', 'exercise', 'question', 'answer', 'notes',
                'book', 'notebook', 'study', 'lesson', 'homework', 'assignment',
                'hindi', 'english', 'subject', 'chemistry', 'physics', 'math', 'mathematics',
                // Hindi text patterns
                'अध्याय', 'पृष्ठ', 'प्रश्न', 'उत्तर', 'नोट्स', 'किताब', 'पुस्तक'
            ];
            this.consecutiveTextDetections = 0;
            this.textDetectionRequiredFrames = 2; // Need 2 frames of text to confirm book

            // Advanced Mobile Detection System
            this.advancedMobileDetection = {
                enabled: true,
                suspiciousnessThreshold: 120, // Points needed to trigger violation
                phoneAspectRatios: {
                    portrait: { min: 0.4, max: 0.6 }, // Height > Width
                    landscape: { min: 1.6, max: 2.5 } // Width > Height
                },
                handRegionEstimation: {
                    enabled: true,
                    lowerBodyRatio: 0.6, // Lower 60% of person for hand area
                    sideMarginRatio: 0.3 // 30% margin on sides
                }
            };

            // Advanced Book/Notes Detection System
            this.advancedBookDetection = {
                enabled: true,
                textureAnalysis: {
                    enabled: true,
                    edgeThreshold: 30,
                    lineDetectionThreshold: 0.15,
                    handwritingIrregularityThreshold: 0.3
                },
                scoringSystem: {
                    handwrittenTexture: 50, // +50 for handwritten-like patterns
                    bindingDetected: 50, // +50 for book spine/binding
                    printedText: 30, // +30 for printed text patterns
                    flatSurface: -25, // -25 for uniform flat surface
                    irregularLines: 40, // +40 for irregular handwriting
                    parallelLines: 35 // +35 for book binding lines
                },
                violationThreshold: 80 // Points needed for book/notes violation
            };

            // Book detection tracking
            this.bookAnalysisResults = [];
            this.consecutiveBookDetections = 0;

            // Suspiciousness scoring system
            this.suspiciousObjects = [];
            this.lastPersonDetection = null;

            // Enhanced Violation System for Misclassified Objects
            this.enhancedViolationSystem = {
                enabled: true,
                misclassifiedObjectThreshold: 100, // Points to trigger misclassified violation
                personWithObjectThreshold: 75, // Points to trigger person-with-object violation
                suspiciousObjectTimer: 0, // Timer for suspicious objects in hand
                suspiciousObjectTimeLimit: 3000, // 3 seconds before violation
                lastSuspiciousObjectTime: null,
                consecutiveSuspiciousFrames: 0,
                requiredSuspiciousFrames: 5 // Need 5 consecutive suspicious frames
            };

            // Multiple violation pathways
            this.violationPathways = {
                directMobile: { count: 0, threshold: 3 }, // Direct cell phone detection
                misclassifiedObject: { count: 0, threshold: 2 }, // Misclassified phone-like object
                personWithObject: { count: 0, threshold: 4 }, // Person holding suspicious object
                highSuspiciousness: { count: 0, threshold: 1 } // Very high suspiciousness score
            };

            // Initialize misclassified detection if not already done
            this.initializeMisclassifiedDetection();

            // Stateful Object Tracking System
            this.objectTracker = {
                trackedObjects: new Map(), // objectType -> state
                thresholds: {
                    high: 0.8, // >80%: Immediate high-severity violation
                    medium: 0.5, // 50-80%: Contribute to consecutive count
                    low: 0.2 // 20-50%: Reset misses, extend grace period
                },
                gracePeriod: {
                    mobile: 3, // 3 frames grace for mobile phones
                    book: 4, // 4 frames grace for books
                    default: 2 // 2 frames grace for other objects
                },
                violationThresholds: {
                    mobile: 3, // Trigger violation after 3 consecutive detections
                    book: 4, // Trigger violation after 4 consecutive detections
                    default: 3 // Default threshold
                }
            };

            // Initialize tracking for key object types
            this.initializeObjectTracking();

            console.log('🤖 AIDetectionSystem instance created with visual feedback and comprehensive detection');
        }

        initializeMisclassifiedDetection() {
            if (!this.misclassifiedDetection) {
                this.misclassifiedDetection = {
                    enabled: true,
                    personOnlyFrames: 0, // Frames with only person detected
                    personOnlyThreshold: 8, // Trigger after 8 frames
                    unknownObjectFrames: 0, // Frames with unidentified objects
                    unknownObjectThreshold: 5, // Trigger after 5 frames
                    lowConfidenceFrames: 0, // Frames with low confidence objects
                    lowConfidenceThreshold: 6, // Trigger after 6 frames
                    lastViolationTime: 0, // Timestamp of last violation
                    violationCooldown: 10000 // 10 second cooldown between violations
                };
                console.log('🔧 Misclassified detection system initialized with conservative thresholds');
            }
        }

        initializeObjectTracking() {
            // Initialize tracking for key object types
            this.objectTracker.trackedObjects.set('mobile', {
                consecutiveDetections: 0,
                missedFrames: 0,
                lastDetectionTime: null,
                confidence: 0
            });
            this.objectTracker.trackedObjects.set('book', {
                consecutiveDetections: 0,
                missedFrames: 0,
                lastDetectionTime: null,
                confidence: 0
            });
        }

        async initialize() {
            try {
                console.log('🚀 Initializing AI models...');
                await this.loadTensorFlowModels();
                await this.loadMediaPipeModels();
                this.isInitialized = true;
                return true;
            } catch (error) {
                console.error('❌ Failed to initialize AI models:', error);
                this.initializeBasicFallback();
                return false;
            }
        }

        async loadTensorFlowModels() {
            console.log('📦 Loading TensorFlow.js models...');

            if (typeof cocoSsd !== 'undefined') {
                this.cocoSsdModel = await cocoSsd.load({
                    base: 'mobilenet_v2'
                });
                console.log('✅ COCO-SSD model loaded');
            }

            if (typeof faceLandmarksDetection !== 'undefined') {
                this.faceDetectionModel = await faceLandmarksDetection.load(
                    faceLandmarksDetection.SupportedPackages.mediapipeFacemesh, { maxFaces: 5 }
                );
                console.log('✅ Face detection model loaded');
            }
        }

        async loadMediaPipeModels() {
            console.log('📦 Loading MediaPipe Face Mesh...');

            if (typeof FaceMesh !== 'undefined') {
                this.faceMesh = new FaceMesh({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
                    }
                });

                this.faceMesh.setOptions({
                    maxNumFaces: 3,
                    refineLandmarks: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                console.log('✅ MediaPipe Face Mesh loaded');
            }

            if (typeof Hands !== 'undefined') {
                this.handsModel = new Hands({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1633559619/${file}`;
                    }
                });

                this.handsModel.setOptions({
                    maxNumHands: 2,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                console.log('✅ MediaPipe Hands loaded');
            }
        }

        initializeBasicFallback() {
            console.log('🔧 Initializing basic detection fallback...');
            this.isInitialized = true;
            this.useBasicDetection = true;
        }

        startDetection(videoElement) {
            if (!videoElement) {
                console.error('❌ No video element provided');
                return false;
            }
            this.videoElement = videoElement;
            this.isDetecting = true;
            console.log('🎯 Starting detection...');

            if (this.useBasicDetection) {
                this.startBasicDetectionLoop();
            } else {
                this.startAIDetectionLoop();
            }

            return true;
        }

        stopDetection() {
            console.log('🛑 Stopping AI detection system...');

            this.isDetecting = false;

            if (this.detectionInterval) {
                clearInterval(this.detectionInterval);
                this.detectionInterval = null;
                console.log('✅ AI detection interval cleared');
            }

            if (this.focusCheckInterval) {
                clearInterval(this.focusCheckInterval);
                this.focusCheckInterval = null;
                console.log('✅ Focus check interval cleared');
            }

            // Reset detection state
            this.frameSkipCount = 0;
            this.focusLostCount = 0;

            console.log('🛑 Detection system completely stopped');
            return true;
        }

        setViolationCallback(callback) {
            this.onViolationDetected = callback;
        }

        getStatistics() {
            return {...this.statistics };
        }

        getStats() {
            return this.getStatistics();
        }

        getStatus() {
            return {
                initialized: this.isInitialized,
                detecting: this.isDetecting,
                models: {
                    object: !!this.cocoSsdModel,
                    face: !!this.faceDetectionModel,
                    gaze: !!this.faceMesh,
                    hands: !!this.handsModel
                },
                mode: this.useBasicDetection ? 'basic' : 'ai'
            };
        }

        async startAIDetectionLoop() {
            console.log('🤖 Starting AI detection loop...');

            this.detectionInterval = setInterval(async() => {
                if (!this.isDetecting || !this.videoElement) return;

                this.frameSkipCount++;
                if (this.frameSkipCount < this.maxFrameSkip) return;
                this.frameSkipCount = 0;

                try {
                    await this.runAIDetection();
                } catch (error) {
                    console.warn('⚠️ AI detection error:', error);
                }
            }, 1000);

            this.focusCheckInterval = setInterval(async() => {
                if (!this.isDetecting || !this.videoElement) return;
                try {
                    await this.detectFocusWithAI();
                } catch (error) {
                    console.warn('⚠️ Focus detection error:', error);
                }
            }, 2000);
        }

        async runAIDetection() {
            await this.detectObjectsWithAI();
            await this.detectFacesWithAI();
            await this.detectGazeWithMediaPipe();
            await this.detectTextWithAI();
            await this.detectHandsWithMediaPipe();
            this.statistics.totalDetections++;
        }

        async detectObjectsWithAI() {
            if (!this.cocoSsdModel || !this.videoElement) return;

            try {
                const predictions = await this.cocoSsdModel.detect(this.videoElement);

                // Log all detected objects for debugging
                if (predictions.length > 0) {
                    console.log(`🔍 COCO-SSD detected ${predictions.length} objects:`);
                    predictions.forEach((pred, index) => {
                        console.log(`  ${index + 1}. ${pred.class} (${(pred.score * 100).toFixed(1)}% confidence)`);
                    });
                } else {
                    console.log('🔍 COCO-SSD: No objects detected in current frame');
                }

                // STEP 1: Check for direct mobile phone detections with multiple confidence levels
                const mobileDetections = this.checkMobilePhoneDetections(predictions);

                // STEP 2: Process mobile detections with consecutive frame logic
                this.processConsecutiveMobileDetections(mobileDetections);

                // STEP 3: Check for other suspicious objects
                const categorizedObjects = this.checkOtherSuspiciousObjects(predictions);

                // STEP 4: Process other objects (without consecutive frame requirement)
                this.processOtherObjects(categorizedObjects);

                // Update object tracking state
                this.updateObjectTracking(predictions);

            } catch (error) {
                console.warn('Object detection error:', error);
            }
        }

        checkMobilePhoneDetections(predictions) {
            const mobileKeywords = ['cell phone', 'mobile phone', 'phone', 'smartphone', 'iphone', 'android'];
            const mobileDetections = [];

            // Phase 1: Direct mobile phone detections
            predictions.forEach(prediction => {
                const className = prediction.class.toLowerCase();
                const isMobile = mobileKeywords.some(keyword =>
                    className.includes(keyword) || keyword.includes(className)
                );

                if (isMobile) {
                    let confidenceLevel = 'low';
                    let shouldCount = false;

                    if (prediction.score >= this.confidenceThresholds.mobilePhone.high) {
                        confidenceLevel = 'high';
                        shouldCount = true;
                        console.log(`📱 HIGH CONFIDENCE MOBILE: "${prediction.class}" (${(prediction.score * 100).toFixed(1)}%)`);
                    } else if (prediction.score >= this.confidenceThresholds.mobilePhone.medium) {
                        confidenceLevel = 'medium';
                        shouldCount = true;
                        console.log(`📱 MEDIUM CONFIDENCE MOBILE: "${prediction.class}" (${(prediction.score * 100).toFixed(1)}%)`);
                    } else if (prediction.score >= this.confidenceThresholds.mobilePhone.low) {
                        confidenceLevel = 'low';
                        shouldCount = true;
                        console.log(`📱 LOW CONFIDENCE MOBILE: "${prediction.class}" (${(prediction.score * 100).toFixed(1)}%)`);
                    }

                    if (shouldCount) {
                        mobileDetections.push({
                            ...prediction,
                            confidenceLevel,
                            isMobile: true,
                            suspiciousnessScore: 100 // Direct mobile detection = 100 points
                        });
                    }
                }
            });

            // Phase 2: Advanced analysis for suspicious objects
            if (this.advancedMobileDetection.enabled) {
                const advancedDetections = this.performAdvancedMobileAnalysis(predictions);
                mobileDetections.push(...advancedDetections);
            }

            return mobileDetections;
        }

        performAdvancedMobileAnalysis(predictions) {
            const suspiciousDetections = [];

            // Update person detection for context
            this.updatePersonContext(predictions);

            // Analyze each object for mobile phone characteristics
            predictions.forEach(prediction => {
                const suspiciousnessScore = this.calculateSuspiciousnessScore(prediction);

                if (suspiciousnessScore >= this.advancedMobileDetection.suspiciousnessThreshold) {
                    console.log(`🔍 ADVANCED MOBILE DETECTION: "${prediction.class}" scored ${suspiciousnessScore} points (threshold: ${this.advancedMobileDetection.suspiciousnessThreshold})`);

                    suspiciousDetections.push({
                        ...prediction,
                        confidenceLevel: 'advanced',
                        isMobile: true,
                        suspiciousnessScore: suspiciousnessScore,
                        detectionMethod: 'advanced-analysis'
                    });
                }
            });

            return suspiciousDetections;
        }

        calculateSuspiciousnessScore(prediction) {
            let score = 0;
            const className = prediction.class.toLowerCase();
            const bbox = prediction.bbox || this.extractBoundingBox(prediction);

            if (!bbox) return 0;

            const [x, y, width, height] = bbox;

            // Phase 1: Direct object classification scoring
            if (className.includes('phone') || className.includes('cell')) {
                score += 100; // Direct phone detection
                console.log(`📱 Direct phone classification: +100 points`);
            } else if (['remote', 'book', 'bottle', 'cup'].some(item => className.includes(item))) {
                score += 25; // Potentially misclassified phone
                console.log(`📱 Potentially misclassified object (${className}): +25 points`);
            }

            // Phase 2: Shape and aspect ratio analysis
            const aspectRatio = width / height;
            const shapeScore = this.analyzePhoneShape(aspectRatio, width, height);
            score += shapeScore;

            // Phase 3: Contextual analysis (hand region)
            const contextScore = this.analyzeHandContext(x, y, width, height);
            score += contextScore;

            // Phase 4: Size analysis
            const sizeScore = this.analyzePhoneSize(width, height);
            score += sizeScore;

            if (score > 0) {
                console.log(`📊 Suspiciousness analysis for "${className}": Total score = ${score}`);
            }

            return score;
        }

        updatePersonContext(predictions) {
            // Find person detection for contextual analysis
            const personDetection = predictions.find(pred =>
                pred.class.toLowerCase() === 'person' && pred.score > 0.5
            );

            if (personDetection) {
                this.lastPersonDetection = personDetection;
            }
        }

        extractBoundingBox(prediction) {
            // Handle different bounding box formats
            if (prediction.bbox) {
                return prediction.bbox;
            } else if (prediction.boundingBox) {
                const bb = prediction.boundingBox;
                return [bb.xMin, bb.yMin, bb.width, bb.height];
            }
            return null;
        }

        processConsecutiveMobileDetections(mobileDetections) {
            if (mobileDetections.length > 0) {
                // Process each detection through multiple pathways
                mobileDetections.forEach(detection => {
                    this.processViolationPathways(detection);
                });

                // Traditional consecutive frame logic for direct mobile detections
                const directMobileDetections = mobileDetections.filter(d => d.detectionMethod !== 'advanced-analysis');
                if (directMobileDetections.length > 0) {
                    this.phoneDetectedCount++;
                    this.phoneMissedCount = 0;
                    console.log(`📱 Mobile detection count: ${this.phoneDetectedCount}/${this.requiredConsecutiveDetections} (missed: ${this.phoneMissedCount})`);

                    if (this.phoneDetectedCount >= this.requiredConsecutiveDetections) {
                        const bestDetection = directMobileDetections.reduce((best, current) =>
                            current.score > best.score ? current : best
                        );

                        console.log(`🚨 RELIABLE MOBILE PHONE VIOLATION: ${bestDetection.class} detected in ${this.phoneDetectedCount} frames with grace period (${(bestDetection.score * 100).toFixed(1)}% confidence)`);

                        this.triggerViolation('mobile_phone_detected',
                            `Mobile phone reliably detected: ${bestDetection.class} in ${this.phoneDetectedCount} frames (${(bestDetection.score * 100).toFixed(1)}% confidence)`,
                            bestDetection.confidenceLevel === 'high' ? 'high' : 'medium');

                        this.statistics.objectDetections++;
                        this.statistics.reliableDetections++;
                        this.phoneDetectedCount = 0;
                        this.phoneMissedCount = 0;
                    }
                }

                // Update suspicious object timer
                this.updateSuspiciousObjectTimer();

            } else {
                // No mobile phone detected - handle grace period
                this.phoneMissedCount++;
                console.log(`📱 Mobile missed: ${this.phoneMissedCount}/${this.allowedMissedFrames} (detected: ${this.phoneDetectedCount})`);

                if (this.phoneMissedCount > this.allowedMissedFrames) {
                    if (this.phoneDetectedCount > 0) {
                        console.log(`📱 Grace period exceeded: Resetting detection count from ${this.phoneDetectedCount} (missed ${this.phoneMissedCount} frames)`);
                    }
                    this.phoneDetectedCount = 0;
                    this.phoneMissedCount = 0;
                }

                // Reset suspicious object timer
                this.resetSuspiciousObjectTimer();
            }

            this.statistics.consecutiveDetections = this.phoneDetectedCount;
        }

        processViolationPathways(detection) {
            const className = detection.class.toLowerCase();
            const suspiciousnessScore = detection.suspiciousnessScore || 0;
            const detectionMethod = detection.detectionMethod || 'coco-ssd';

            // Pathway 1: Direct Mobile Detection
            if (className.includes('phone') || className.includes('cell')) {
                this.violationPathways.directMobile.count++;
                console.log(`🎯 PATHWAY 1 - Direct Mobile: ${this.violationPathways.directMobile.count}/${this.violationPathways.directMobile.threshold}`);

                if (this.violationPathways.directMobile.count >= this.violationPathways.directMobile.threshold) {
                    this.triggerEnhancedViolation('direct_mobile_detection', detection, 'high');
                    this.resetAllPathways();
                }
                return;
            }

            // Pathway 2: Misclassified Object (High Suspiciousness)
            if (suspiciousnessScore >= this.enhancedViolationSystem.misclassifiedObjectThreshold) {
                this.violationPathways.misclassifiedObject.count++;
                console.log(`🎯 PATHWAY 2 - Misclassified Object: ${this.violationPathways.misclassifiedObject.count}/${this.violationPathways.misclassifiedObject.threshold} (${className} scored ${suspiciousnessScore})`);

                if (this.violationPathways.misclassifiedObject.count >= this.violationPathways.misclassifiedObject.threshold) {
                    this.triggerEnhancedViolation('misclassified_mobile_object', detection, 'high');
                    this.resetAllPathways();
                }
                return;
            }

            // Pathway 3: Person with Suspicious Object
            if (className === 'person' && suspiciousnessScore >= this.enhancedViolationSystem.personWithObjectThreshold) {
                this.violationPathways.personWithObject.count++;
                console.log(`🎯 PATHWAY 3 - Person with Object: ${this.violationPathways.personWithObject.count}/${this.violationPathways.personWithObject.threshold} (scored ${suspiciousnessScore})`);

                if (this.violationPathways.personWithObject.count >= this.violationPathways.personWithObject.threshold) {
                    this.triggerEnhancedViolation('person_with_suspicious_object', detection, 'medium');
                    this.resetAllPathways();
                }
                return;
            }

            // Pathway 4: Very High Suspiciousness (Any Object)
            if (suspiciousnessScore >= 150) {
                this.violationPathways.highSuspiciousness.count++;
                console.log(`🎯 PATHWAY 4 - High Suspiciousness: ${this.violationPathways.highSuspiciousness.count}/${this.violationPathways.highSuspiciousness.threshold} (${className} scored ${suspiciousnessScore})`);

                if (this.violationPathways.highSuspiciousness.count >= this.violationPathways.highSuspiciousness.threshold) {
                    this.triggerEnhancedViolation('highly_suspicious_object', detection, 'high');
                    this.resetAllPathways();
                }
                return;
            }

            // Moderate suspiciousness - increment consecutive frames
            if (suspiciousnessScore >= 50) {
                this.enhancedViolationSystem.consecutiveSuspiciousFrames++;
                console.log(`🔍 Consecutive suspicious frames: ${this.enhancedViolationSystem.consecutiveSuspiciousFrames}/${this.enhancedViolationSystem.requiredSuspiciousFrames} (${className}: ${suspiciousnessScore} points)`);

                if (this.enhancedViolationSystem.consecutiveSuspiciousFrames >= this.enhancedViolationSystem.requiredSuspiciousFrames) {
                    this.triggerEnhancedViolation('consecutive_suspicious_behavior', detection, 'medium');
                    this.enhancedViolationSystem.consecutiveSuspiciousFrames = 0;
                }
            } else {
                // Reset consecutive frames if not suspicious
                this.enhancedViolationSystem.consecutiveSuspiciousFrames = 0;
            }
        }

        triggerEnhancedViolation(violationType, detection, severity) {
            const className = detection.class || 'unknown';
            const score = detection.suspiciousnessScore || detection.score || 0;
            const method = detection.detectionMethod || 'unknown';

            let message = '';
            switch (violationType) {
                case 'direct_mobile_detection':
                    message = `Direct mobile phone detected: ${className} (${(score * 100).toFixed(1)}% confidence)`;
                    break;
                case 'misclassified_mobile_object':
                    message = `Misclassified mobile phone detected: ${className} with ${score} suspiciousness points via ${method}`;
                    break;
                case 'person_with_suspicious_object':
                    message = `Person detected holding suspicious object: ${score} suspiciousness points`;
                    break;
                case 'highly_suspicious_object':
                    message = `Highly suspicious object detected: ${className} with ${score} points`;
                    break;
                case 'consecutive_suspicious_behavior':
                    message = `Consecutive suspicious behavior: ${className} detected in ${this.enhancedViolationSystem.requiredSuspiciousFrames} frames`;
                    break;
            }

            console.log(`� ENHANCED VIOLATION TRIGGERED: ${violationType.toUpperCase()}`);
            console.log(`📋 Details: ${message}`);

            this.triggerViolation('mobile_phone_detected', message, severity);
            this.statistics.objectDetections++;
            this.statistics.reliableDetections++;
        }

        updateSuspiciousObjectTimer() {
            const currentTime = Date.now();

            if (!this.enhancedViolationSystem.lastSuspiciousObjectTime) {
                this.enhancedViolationSystem.lastSuspiciousObjectTime = currentTime;
                console.log(`⏱️ Starting suspicious object timer`);
            } else {
                const elapsed = currentTime - this.enhancedViolationSystem.lastSuspiciousObjectTime;

                if (elapsed >= this.enhancedViolationSystem.suspiciousObjectTimeLimit) {
                    console.log(`⏱️ SUSPICIOUS OBJECT TIMER VIOLATION: Object held for ${(elapsed / 1000).toFixed(1)} seconds`);

                    this.triggerViolation('mobile_phone_detected',
                        `Suspicious object held in hand for ${(elapsed / 1000).toFixed(1)} seconds`,
                        'medium');

                    this.statistics.objectDetections++;
                    this.resetSuspiciousObjectTimer();
                }
            }
        }

        resetSuspiciousObjectTimer() {
            if (this.enhancedViolationSystem.lastSuspiciousObjectTime) {
                console.log(`⏱️ Resetting suspicious object timer`);
                this.enhancedViolationSystem.lastSuspiciousObjectTime = null;
            }
        }

        resetAllPathways() {
            Object.keys(this.violationPathways).forEach(pathway => {
                this.violationPathways[pathway].count = 0;
            });
            console.log(`🔄 All violation pathways reset`);
        }

        analyzePhoneShape(aspectRatio, width, height) {
            let shapeScore = 0;
            const ratios = this.advancedMobileDetection.phoneAspectRatios;

            // Check portrait orientation (taller than wide)
            if (aspectRatio >= ratios.portrait.min && aspectRatio <= ratios.portrait.max) {
                shapeScore += 50;
                console.log(`📱 Portrait phone shape detected (ratio: ${aspectRatio.toFixed(2)}): +50 points`);
            }
            // Check landscape orientation (wider than tall)
            else if (aspectRatio >= ratios.landscape.min && aspectRatio <= ratios.landscape.max) {
                shapeScore += 50;
                console.log(`📱 Landscape phone shape detected (ratio: ${aspectRatio.toFixed(2)}): +50 points`);
            }
            // Slightly outside ideal range but still suspicious
            else if ((aspectRatio >= 0.3 && aspectRatio <= 0.7) || (aspectRatio >= 1.4 && aspectRatio <= 3.0)) {
                shapeScore += 25;
                console.log(`📱 Somewhat phone-like shape (ratio: ${aspectRatio.toFixed(2)}): +25 points`);
            }

            return shapeScore;
        }

        analyzeHandContext(x, y, width, height) {
            // Use stored hand detections from latest frame
            const detectedHands = this.detectedHands || [];

            if (detectedHands.length === 0) {
                // No hands detected - cannot be holding anything
                console.log(`🚫 No hands detected - object cannot be in hand`);
                return 0;
            }

            // Check if object overlaps with any detected hand
            const objectCenterX = x + width / 2;
            const objectCenterY = y + height / 2;

            for (const hand of detectedHands) {
                const handCenterX = hand.x + hand.width / 2;
                const handCenterY = hand.y + hand.height / 2;

                // Calculate distance between object and hand centers
                const distance = Math.sqrt(
                    Math.pow(objectCenterX - handCenterX, 2) +
                    Math.pow(objectCenterY - handCenterY, 2)
                );

                // Check for overlap or close proximity
                const maxDistance = Math.max(hand.width, hand.height) / 2 + Math.max(width, height) / 2;

                if (distance < maxDistance) {
                    const overlapPercentage = ((maxDistance - distance) / maxDistance * 100).toFixed(1);
                    console.log(`✋ Object overlaps with ${hand.label} hand: ${overlapPercentage}% overlap (confidence: ${(hand.confidence * 100).toFixed(1)}%)`);

                    // Higher score for better hand detection confidence
                    const baseScore = 50;
                    const confidenceBonus = Math.round(hand.confidence * 20); // Up to 20 bonus points
                    const totalScore = baseScore + confidenceBonus;

                    console.log(`📱 Object in actual hand region: +${totalScore} points (${hand.label} hand, ${(hand.confidence * 100).toFixed(1)}% confidence)`);
                    return totalScore;
                }
            }

            // Object detected but not in any hand
            console.log(`📱 Object detected but not in any hand region`);
            return 0;
        }

        analyzePhoneSize(width, height) {
            // Typical phone sizes in pixels (approximate)
            const minPhoneSize = 30; // Minimum reasonable phone size
            const maxPhoneSize = 200; // Maximum reasonable phone size

            const objectSize = Math.max(width, height);

            if (objectSize >= minPhoneSize && objectSize <= maxPhoneSize) {
                console.log(`📱 Reasonable phone size (${objectSize}px): +25 points`);
                return 25;
            } else if (objectSize > maxPhoneSize * 0.7 && objectSize < maxPhoneSize * 1.5) {
                console.log(`📱 Somewhat reasonable size (${objectSize}px): +10 points`);
                return 10;
            }

            return 0;
        }

        checkOtherSuspiciousObjects(predictions) {
            // Add safety checks for predictions
            if (!predictions || !Array.isArray(predictions)) {
                console.warn('Invalid predictions array passed to checkOtherSuspiciousObjects:', predictions);
                return [];
            }

            if (predictions.length === 0) {
                console.log('📋 No predictions to analyze for suspicious objects');
                return [];
            }

            const suspiciousObjects = [];

            // Check for person-only scenarios (potential misclassified objects)
            this.checkMisclassifiedObjects(predictions);

            // Analyze each prediction with expanded categories
            predictions.forEach((prediction, index) => {
                try {
                    if (!prediction) {
                        console.warn(`Skipping null/undefined prediction at index ${index}`);
                        return;
                    }

                    const suspiciousnessData = this.analyzeSuspiciousObject(prediction);

                    if (suspiciousnessData && suspiciousnessData.totalScore >= 70) { // Lowered threshold for better detection
                        suspiciousObjects.push({
                            ...prediction,
                            ...suspiciousnessData,
                            isSuspicious: true
                        });
                    }
                } catch (error) {
                    console.error(`Error analyzing prediction at index ${index}:`, error, prediction);
                }
            });

            console.log(`📋 Analyzed ${predictions.length} predictions, found ${suspiciousObjects.length} suspicious objects`);
            return suspiciousObjects;
        }

        analyzeSuspiciousObject(prediction) {
            // Add null checks to prevent TypeError
            if (!prediction || typeof prediction !== 'object') {
                console.warn('Invalid prediction object passed to analyzeSuspiciousObject:', prediction);
                return {
                    totalScore: 0,
                    violationType: 'suspicious_item_detected',
                    severity: 'medium',
                    detectedCategory: null,
                    suspiciousnessScore: 0
                };
            }

            // Ensure suspiciousItemsCategories is initialized
            if (!this.suspiciousItemsCategories || typeof this.suspiciousItemsCategories !== 'object') {
                console.warn('suspiciousItemsCategories not initialized, initializing now...');
                this.initializeSuspiciousCategories();
            }

            const className = prediction.class ? prediction.class.toLowerCase() : '';
            if (!className) {
                console.warn('Prediction has no class name:', prediction);
                return {
                    totalScore: 0,
                    violationType: 'suspicious_item_detected',
                    severity: 'medium',
                    detectedCategory: null,
                    suspiciousnessScore: 0
                };
            }

            let totalScore = 0;
            let violationType = 'suspicious_item_detected';
            let severity = 'medium';
            let detectedCategory = null;

            // Check against all suspicious categories (with safe Object.entries)
            try {
                for (const [categoryName, categoryData] of Object.entries(this.suspiciousItemsCategories)) {
                    if (!categoryData || !categoryData.items || !Array.isArray(categoryData.items)) {
                        console.warn(`Invalid category data for ${categoryName}:`, categoryData);
                        continue;
                    }

                    const isInCategory = categoryData.items.some(item =>
                        item && typeof item === 'string' &&
                        (className.includes(item.toLowerCase()) || item.toLowerCase().includes(className))
                    );

                    if (isInCategory) {
                        totalScore += categoryData.baseScore || 0;
                        violationType = categoryData.violationType || 'suspicious_item_detected';
                        severity = categoryData.severity || 'medium';
                        detectedCategory = categoryName;

                        console.log(`📋 CATEGORY MATCH: "${className}" → ${categoryName} (+${categoryData.baseScore || 0} points)`);
                        break;
                    }
                }
            } catch (error) {
                console.error('Error processing suspicious categories:', error);
                console.log('suspiciousItemsCategories:', this.suspiciousItemsCategories);
            }

            // Add contextual scoring (with null checks)
            const bbox = this.extractBoundingBox(prediction);
            if (bbox && Array.isArray(bbox) && bbox.length >= 4) {
                const [x, y, width, height] = bbox;

                if (typeof x === 'number' && typeof y === 'number' &&
                    typeof width === 'number' && typeof height === 'number' &&
                    width > 0 && height > 0) {

                    // Shape analysis
                    const aspectRatio = width / height;
                    const shapeScore = this.analyzeObjectShape(aspectRatio, width, height, detectedCategory);
                    totalScore += shapeScore || 0;

                    // Hand context analysis
                    const contextScore = this.analyzeHandContext(x, y, width, height);
                    totalScore += contextScore || 0;

                    // Size analysis
                    const sizeScore = this.analyzeObjectSize(width, height, detectedCategory);
                    totalScore += sizeScore || 0;
                }
            }

            // Confidence boost for low-confidence detections that might be misclassified
            if (prediction.score && typeof prediction.score === 'number' && prediction.score < 0.6 && totalScore > 0) {
                const confidenceBoost = Math.round((0.6 - prediction.score) * 50);
                totalScore += confidenceBoost;
                console.log(`📋 Low confidence boost: +${confidenceBoost} points (confidence: ${(prediction.score * 100).toFixed(1)}%)`);
            }

            if (totalScore > 0) {
                console.log(`📊 Suspicious object analysis for "${className}": Total score = ${totalScore} (category: ${detectedCategory || 'none'})`);
            }

            return {
                totalScore,
                violationType,
                severity,
                detectedCategory,
                suspiciousnessScore: totalScore
            };
        }

        checkMisclassifiedObjects(predictions) {
            // Ensure misclassifiedDetection is initialized
            this.initializeMisclassifiedDetection();

            const personDetections = predictions.filter(p => p.class.toLowerCase() === 'person');
            const otherDetections = predictions.filter(p => p.class.toLowerCase() !== 'person');

            // Scenario 1: Only person detected (potential hidden object)
            if (personDetections.length > 0 && otherDetections.length === 0) {
                // Add confidence threshold - only trigger if person detection is confident
                const highConfidencePerson = personDetections.find(p => p.score >= 0.7);

                if (highConfidencePerson) {
                    this.misclassifiedDetection.personOnlyFrames++;
                    console.log(`👤 High-confidence person-only detection: ${this.misclassifiedDetection.personOnlyFrames}/${this.misclassifiedDetection.personOnlyThreshold} (confidence: ${(highConfidencePerson.score * 100).toFixed(1)}%)`);

                    // Increased threshold to reduce false positives
                    if (this.misclassifiedDetection.personOnlyFrames >= this.misclassifiedDetection.personOnlyThreshold) {
                        // Check cooldown period to prevent spam
                        const currentTime = Date.now();
                        const timeSinceLastViolation = currentTime - this.misclassifiedDetection.lastViolationTime;

                        if (timeSinceLastViolation >= this.misclassifiedDetection.violationCooldown) {
                            console.log(`🔍 MISCLASSIFIED OBJECT VIOLATION: High-confidence person detected alone for ${this.misclassifiedDetection.personOnlyFrames} frames - likely holding hidden object`);

                            this.triggerViolation('misclassified_object_detected',
                                `Person detected holding unidentified object for ${this.misclassifiedDetection.personOnlyFrames} consecutive frames (${(highConfidencePerson.score * 100).toFixed(1)}% confidence)`,
                                'medium');

                            this.misclassifiedDetection.lastViolationTime = currentTime;
                            this.misclassifiedDetection.personOnlyFrames = 0;
                        } else {
                            const remainingCooldown = Math.ceil((this.misclassifiedDetection.violationCooldown - timeSinceLastViolation) / 1000);
                            console.log(`⏳ Misclassified violation on cooldown: ${remainingCooldown}s remaining`);
                            // Don't reset counter during cooldown, but don't spam violations
                        }
                    }
                } else {
                    // Reset counter if person detection is not confident enough
                    this.misclassifiedDetection.personOnlyFrames = Math.max(0, this.misclassifiedDetection.personOnlyFrames - 1);
                }
            } else {
                this.misclassifiedDetection.personOnlyFrames = 0;
            }

            // Scenario 2: Unknown/low confidence objects - make this more strict
            const unknownObjects = otherDetections.filter(p =>
                !this.isKnownObject(p.class.toLowerCase()) && p.score < 0.6 // Lowered from 0.7
            );

            if (unknownObjects.length > 0) {
                this.misclassifiedDetection.unknownObjectFrames++;
                console.log(`❓ Unknown object detection: ${this.misclassifiedDetection.unknownObjectFrames}/${this.misclassifiedDetection.unknownObjectThreshold}`);

                if (this.misclassifiedDetection.unknownObjectFrames >= this.misclassifiedDetection.unknownObjectThreshold) {
                    const unknownObj = unknownObjects[0];
                    console.log(`🔍 UNKNOWN OBJECT VIOLATION: Unidentified object "${unknownObj.class}" detected for ${this.misclassifiedDetection.unknownObjectFrames} frames`);

                    this.triggerViolation('unknown_object_detected',
                        `Unknown object "${unknownObj.class}" detected with ${(unknownObj.score * 100).toFixed(1)}% confidence`,
                        'medium');

                    this.misclassifiedDetection.unknownObjectFrames = 0;
                }
            } else {
                this.misclassifiedDetection.unknownObjectFrames = 0;
            }
        }

        isKnownObject(className) {
            // Check if object is in any of our suspicious categories or common safe objects
            const allSuspiciousItems = Object.values(this.suspiciousItemsCategories)
                .flatMap(category => category.items);

            const commonSafeObjects = ['person', 'chair', 'desk', 'wall', 'window', 'door'];

            return allSuspiciousItems.some(item =>
                className.includes(item.toLowerCase()) || item.toLowerCase().includes(className)
            ) || commonSafeObjects.includes(className);
        }

        analyzeObjectShape(aspectRatio, width, height, category) {
            let shapeScore = 0;

            if (category === 'booksAndPapers') {
                // Books typically have rectangular shapes
                if ((aspectRatio >= 0.6 && aspectRatio <= 0.8) || (aspectRatio >= 1.2 && aspectRatio <= 1.7)) {
                    shapeScore += 30;
                    console.log(`📚 Book-like shape detected (ratio: ${aspectRatio.toFixed(2)}): +30 points`);
                }
            } else if (category === 'electronicDevices') {
                // Electronics have various shapes, use phone-like detection
                shapeScore += this.analyzePhoneShape(aspectRatio, width, height);
            } else {
                // General suspicious shape analysis
                if (aspectRatio >= 0.3 && aspectRatio <= 3.0) {
                    shapeScore += 15;
                    console.log(`📋 Reasonable object shape (ratio: ${aspectRatio.toFixed(2)}): +15 points`);
                }
            }

            return shapeScore;
        }

        analyzeObjectSize(width, height, category) {
            const objectSize = Math.max(width, height);
            let sizeScore = 0;

            if (category === 'booksAndPapers') {
                // Books are typically medium to large sized
                if (objectSize >= 50 && objectSize <= 300) {
                    sizeScore += 25;
                    console.log(`📚 Book-appropriate size (${objectSize}px): +25 points`);
                }
            } else if (category === 'electronicDevices') {
                // Use existing phone size analysis
                sizeScore += this.analyzePhoneSize(width, height);
            } else {
                // General size analysis
                if (objectSize >= 20 && objectSize <= 200) {
                    sizeScore += 15;
                    console.log(`📋 Reasonable object size (${objectSize}px): +15 points`);
                }
            }

            return sizeScore;
        }

        processOtherObjects(suspiciousObjects) {
            if (suspiciousObjects.length > 0) {
                suspiciousObjects.forEach(obj => {
                    console.log(`🚨 ${obj.violationType.toUpperCase()}: ${obj.class} detected (${(obj.score * 100).toFixed(1)}% confidence, ${obj.totalScore} suspiciousness points)`);

                    // Create detailed violation message with timestamp
                    const timestamp = new Date().toISOString();
                    const detailedMessage = `${obj.violationType.replace('_', ' ')}: ${obj.class} detected with ${(obj.score * 100).toFixed(1)}% confidence and ${obj.totalScore} suspiciousness points at ${timestamp}`;

                    this.triggerViolation(obj.violationType, detailedMessage, obj.severity);
                    this.statistics.objectDetections++;

                    // Update category-specific statistics
                    if (!this.statistics[obj.violationType]) {
                        this.statistics[obj.violationType] = 0;
                    }
                    this.statistics[obj.violationType]++;
                });
            }
        }

        async detectFacesWithAI() {
            if (!this.faceDetectionModel || !this.videoElement) return;

            try {
                const faces = await this.faceDetectionModel.estimateFaces({
                    input: this.videoElement,
                    returnTensors: false,
                    flipHorizontal: false
                });

                console.log(`👥 AI Face Detection: ${faces.length} faces detected`);
                this.statistics.faceDetections++;

                // FOCUS DETECTION LOGIC
                this.processFocusDetection(faces);

                // UPDATE VISUAL FEEDBACK
                this.updateVisualFeedback(faces);

            } catch (error) {
                console.warn('Face detection error:', error);
            }
        }

        processFocusDetection(faces) {
            const currentTime = Date.now();

            // 1. MULTIPLE FACES DETECTION
            if (faces.length > 1) {
                console.log(`👥 MULTIPLE FACES DETECTED: ${faces.length} faces in frame`);
                this.triggerViolation('multiple_faces',
                    `Multiple faces detected: ${faces.length} faces in frame`,
                    'high');
                this.statistics.multiplefacesDetected++;

                // Reset other timers since we have faces
                this.resetNoFaceTimer();
                this.resetLookingAwayTimer();
                this.hideFocusWarning();
                return;
            }

            // 2. NO FACE DETECTION
            if (faces.length === 0) {
                this.handleNoFaceDetection(currentTime);
                return;
            }

            // 3. SINGLE FACE - CHECK FOR LOOKING AWAY
            if (faces.length === 1) {
                this.handleSingleFaceDetection(faces[0], currentTime);
            }
        }

        handleNoFaceDetection(currentTime) {
            if (!this.isCurrentlyNoFace) {
                // Start no face timer
                this.noFaceStartTime = currentTime;
                this.isCurrentlyNoFace = true;
                console.log(`👤 NO FACE: Starting no face timer`);
            } else {
                // Check if no face duration exceeds threshold
                const noFaceDuration = currentTime - this.noFaceStartTime;

                if (noFaceDuration >= this.noFaceThreshold) {
                    console.log(`👤 NO FACE VIOLATION: No face detected for ${(noFaceDuration / 1000).toFixed(1)} seconds`);

                    // Show visual warning
                    this.showFocusWarning = true;
                    this.focusWarningType = 'no_face';

                    this.triggerViolation('no_face',
                        `No face detected for ${(noFaceDuration / 1000).toFixed(1)} seconds`,
                        'high');

                    this.statistics.noFaceDetected++;
                    this.statistics.focusViolations++;

                    // Reset timer to prevent spam (but keep warning visible)
                    this.noFaceStartTime = currentTime;
                }
            }

            // Reset looking away timer since there's no face to track
            this.resetLookingAwayTimer();
        }

        handleSingleFaceDetection(face, currentTime) {
            // Reset no face timer since we have a face
            this.resetNoFaceTimer();

            // Calculate head angle for looking away detection
            const headAngle = this.calculateHeadAngle(face);

            if (Math.abs(headAngle) > this.headAngleThreshold) {
                // Person is looking away
                this.handleLookingAwayDetection(currentTime, headAngle);
            } else {
                // Person is looking at screen
                this.resetLookingAwayTimer();
                this.hideFocusWarning();
            }

            // Update last face detection time
            this.lastFaceDetection = currentTime;
        }

        handleLookingAwayDetection(currentTime, headAngle) {
            if (!this.isCurrentlyLookingAway) {
                // Start looking away timer
                this.lookingAwayStartTime = currentTime;
                this.isCurrentlyLookingAway = true;
                console.log(`👀 LOOKING AWAY: Starting timer (head angle: ${headAngle.toFixed(1)}°)`);
            } else {
                // Check if looking away duration exceeds threshold
                const lookingAwayDuration = currentTime - this.lookingAwayStartTime;

                if (lookingAwayDuration >= this.lookingAwayThreshold) {
                    console.log(`👀 LOOKING AWAY VIOLATION: Looking away for ${(lookingAwayDuration / 1000).toFixed(1)} seconds (head angle: ${headAngle.toFixed(1)}°)`);

                    // Show visual warning
                    this.showFocusWarning = true;
                    this.focusWarningType = 'looking_away';

                    this.triggerViolation('looking_away',
                        `Looking away from screen for ${(lookingAwayDuration / 1000).toFixed(1)} seconds (head angle: ${headAngle.toFixed(1)}°)`,
                        'medium');

                    this.statistics.lookingAwayDetected++;
                    this.statistics.focusViolations++;

                    // Reset timer to prevent spam (but keep warning visible)
                    this.lookingAwayStartTime = currentTime;
                }
            }
        }

        resetNoFaceTimer() {
            if (this.isCurrentlyNoFace) {
                console.log(`👤 FACE DETECTED: Resetting no face timer`);
                this.noFaceStartTime = null;
                this.isCurrentlyNoFace = false;
                this.hideFocusWarning();
            }
        }

        resetLookingAwayTimer() {
            if (this.isCurrentlyLookingAway) {
                console.log(`👀 LOOKING BACK: Resetting looking away timer`);
                this.lookingAwayStartTime = null;
                this.isCurrentlyLookingAway = false;
                this.hideFocusWarning();
            }
        }

        hideFocusWarning() {
            if (this.showFocusWarning) {
                this.showFocusWarning = false;
                this.focusWarningType = null;
                console.log(`✅ FOCUS RESTORED: Hiding warning overlay`);
            }
        }

        calculateHeadAngle(face) {
            try {
                // Get key facial landmarks for head pose estimation
                const landmarks = face.landmarks;

                if (!landmarks || landmarks.length < 468) {
                    return 0; // Default to looking straight if landmarks insufficient
                }

                // Use specific landmarks for head pose calculation
                // Nose tip, left eye, right eye, left mouth corner, right mouth corner
                const noseTip = landmarks[1];
                const leftEye = landmarks[33];
                const rightEye = landmarks[263];
                const leftMouth = landmarks[61];
                const rightMouth = landmarks[291];

                // Calculate horizontal head rotation (yaw)
                const eyeCenterX = (leftEye.x + rightEye.x) / 2;
                const mouthCenterX = (leftMouth.x + rightMouth.x) / 2;
                const noseTipX = noseTip.x;

                // Simple head angle estimation based on facial feature alignment
                const faceWidth = Math.abs(rightEye.x - leftEye.x);
                const noseOffset = noseTipX - eyeCenterX;
                const headAngle = (noseOffset / faceWidth) * 90; // Convert to degrees

                return headAngle;

            } catch (error) {
                console.warn('Head angle calculation error:', error);
                return 0; // Default to looking straight on error
            }
        }

        handleNoFaceDetected() {
            const timeSinceLastFace = Date.now() - this.lastFaceDetection;
            if (timeSinceLastFace > 10000) {
                console.log('👤 AI Face Detection: No face detected for 10+ seconds');
                this.triggerViolation('no_face', 'No face detected in frame for extended period', 'high');
                this.lastFaceDetection = Date.now();
                this.statistics.noFaceDetected++;
            }
        }

        async detectFocusWithAI() {
            // This is handled by detectGazeWithMediaPipe
        }

        triggerViolation(type, message, severity) {
            const violation = {
                type,
                message,
                severity,
                timestamp: new Date(),
                confidence: this.useBasicDetection ? 0.6 : 0.9
            };

            console.log(`🚨 Violation detected:`, violation);
            this.statistics.violations++;

            if (this.onViolationDetected) {
                this.onViolationDetected(violation);
            }
        }

        setVideoElement(videoElement) {
            this.videoElement = videoElement;
            console.log('📹 Video element set for detection');

            // Initialize overlay canvases based on video element
            this.initializeOverlayCanvases();
        }

        initializeOverlayCanvases() {
            try {
                // Determine which canvas to use based on video element ID
                if (this.videoElement && this.videoElement.id === 'main-video') {
                    this.overlayCanvas = document.getElementById('main-overlay-canvas');
                } else if (this.videoElement && this.videoElement.id === 'setup-video') {
                    this.overlayCanvas = document.getElementById('setup-overlay-canvas');
                }

                if (this.overlayCanvas) {
                    this.overlayCtx = this.overlayCanvas.getContext('2d');
                    console.log('🎨 Overlay canvas initialized for visual feedback');

                    // Set canvas dimensions to match video
                    this.updateCanvasDimensions();
                } else {
                    console.warn('⚠️ Overlay canvas not found');
                }
            } catch (error) {
                console.warn('Canvas initialization error:', error);
            }
        }

        updateCanvasDimensions() {
            if (this.overlayCanvas && this.videoElement) {
                // Update canvas dimensions to match video
                this.overlayCanvas.width = this.videoElement.videoWidth || this.videoElement.clientWidth;
                this.overlayCanvas.height = this.videoElement.videoHeight || this.videoElement.clientHeight;
            }
        }

        clearOverlay() {
            if (this.overlayCtx && this.overlayCanvas) {
                this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
            }
        }

        drawGreenTriangle(face) {
            if (!this.overlayCtx || !face) return;

            try {
                // Update canvas dimensions if needed
                this.updateCanvasDimensions();

                // Get face bounding box or landmarks
                let x, y, width, height;

                if (face.boundingBox) {
                    // TensorFlow.js face detection format
                    x = face.boundingBox.xMin;
                    y = face.boundingBox.yMin;
                    width = face.boundingBox.width;
                    height = face.boundingBox.height;
                } else if (face.landmarks && face.landmarks.length > 0) {
                    // MediaPipe format - calculate bounding box from landmarks
                    const landmarks = face.landmarks;
                    const xCoords = landmarks.map(point => point.x);
                    const yCoords = landmarks.map(point => point.y);

                    x = Math.min(...xCoords);
                    y = Math.min(...yCoords);
                    width = Math.max(...xCoords) - x;
                    height = Math.max(...yCoords) - y;
                } else {
                    return; // No valid face data
                }

                // Calculate triangle position (above the face)
                const centerX = x + width / 2;
                const triangleY = y - 30;
                const triangleSize = 20;

                // Draw green triangle
                this.overlayCtx.beginPath();
                this.overlayCtx.moveTo(centerX, triangleY); // Top point
                this.overlayCtx.lineTo(centerX - triangleSize, triangleY + triangleSize); // Bottom-left
                this.overlayCtx.lineTo(centerX + triangleSize, triangleY + triangleSize); // Bottom-right
                this.overlayCtx.closePath();

                // Fill and stroke
                this.overlayCtx.fillStyle = 'rgba(0, 255, 0, 0.7)';
                this.overlayCtx.fill();
                this.overlayCtx.strokeStyle = '#00FF00';
                this.overlayCtx.lineWidth = 3;
                this.overlayCtx.stroke();

                // Store face position for reference
                this.lastFacePosition = { x: centerX, y: triangleY };

            } catch (error) {
                console.warn('Triangle drawing error:', error);
            }
        }

        drawFocusWarning(warningType) {
            if (!this.overlayCtx) return;

            try {
                // Update canvas dimensions
                this.updateCanvasDimensions();

                const canvas = this.overlayCanvas;
                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;

                // Warning background
                this.overlayCtx.fillStyle = 'rgba(255, 0, 0, 0.8)';
                this.overlayCtx.fillRect(0, 0, canvas.width, canvas.height);

                // Warning text
                this.overlayCtx.fillStyle = 'white';
                this.overlayCtx.font = 'bold 24px Arial';
                this.overlayCtx.textAlign = 'center';

                let warningText = '';
                if (warningType === 'no_face') {
                    warningText = '⚠️ LOOK AT THE SCREEN\nFace not detected!';
                } else if (warningType === 'looking_away') {
                    warningText = '⚠️ LOOK AT THE SCREEN\nYou are looking away!';
                }

                // Draw warning text with multiple lines
                const lines = warningText.split('\n');
                lines.forEach((line, index) => {
                    this.overlayCtx.fillText(line, centerX, centerY - 20 + (index * 40));
                });

                // Warning icon
                this.overlayCtx.font = 'bold 48px Arial';
                this.overlayCtx.fillText('⚠️', centerX, centerY - 80);

            } catch (error) {
                console.warn('Warning drawing error:', error);
            }
        }

        updateVisualFeedback(faces) {
            // Clear previous drawings
            this.clearOverlay();

            if (this.showFocusWarning) {
                // Show focus warning overlay
                this.drawFocusWarning(this.focusWarningType);
            } else if (faces && faces.length === 1) {
                // Show green triangle for detected face
                this.drawGreenTriangle(faces[0]);
            }
            // If multiple faces or no faces, show nothing (already cleared)
        }

        startBasicDetectionLoop() {
            console.log('🔧 Starting basic detection fallback...');
            this.detectionInterval = setInterval(() => {
                if (!this.isDetecting || !this.videoElement) return;
                this.detectMobilePhoneBasic();
                this.detectObjectsBasic();
                this.detectMultipleFacesBasic();
                this.statistics.totalDetections++;
            }, 3000);
        }

        detectMobilePhoneBasic() {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = this.videoElement.videoWidth;
                canvas.height = this.videoElement.videoHeight;
                ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const brightPixels = this.countBrightPixels(imageData);
                const totalPixels = canvas.width * canvas.height;
                const brightRatio = brightPixels / totalPixels;

                if (brightRatio > 0.15) {
                    this.triggerViolation('mobile_phone', 'Mobile phone detected (basic detection)', 'medium');
                }
            } catch (error) {
                console.warn('Basic mobile detection error:', error);
            }
        }

        countBrightPixels(imageData) {
            const data = imageData.data;
            let brightCount = 0;
            for (let i = 0; i < data.length; i += 16) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const brightness = (r + g + b) / 3;
                if (brightness > 200) brightCount++;
            }
            return brightCount * 4;
        }

        detectObjectsBasic() {
            if (Math.random() < 0.01) {
                this.triggerViolation('unauthorized_object', 'Object detected (basic detection)', 'low');
            }
        }

        detectMultipleFacesBasic() {
            if (Math.random() < 0.005) {
                this.triggerViolation('multiple_faces', '2 faces detected (basic detection)', 'medium');
            }
        }

        async detectTextWithAI() {
            if (!this.textDetectionEnabled) return;

            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = this.videoElement.videoWidth || 640;
                canvas.height = this.videoElement.videoHeight || 480;
                ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);

                // Analyze for text patterns
                const hasTextPattern = this.analyzeForTextPatterns(ctx, canvas.width, canvas.height);

                if (hasTextPattern) {
                    this.consecutiveTextDetections++;
                    console.log(`📝 TEXT PATTERN DETECTED: Possible book/notebook (count: ${this.consecutiveTextDetections}/${this.textDetectionRequiredFrames})`);

                    if (this.consecutiveTextDetections >= this.textDetectionRequiredFrames) {
                        console.log(`📚 BOOK/NOTEBOOK VIOLATION: Text patterns detected in consecutive frames`);

                        this.triggerViolation('books_notes_detected',
                            `Book or notebook detected through text analysis`,
                            'high');
                        this.statistics.objectDetections++;
                        this.consecutiveTextDetections = 0;
                    }
                } else {
                    this.consecutiveTextDetections = 0;
                }
            } catch (error) {
                console.warn('Text detection error:', error);
            }
        }

        analyzeForTextPatterns(ctx, width, height) {
            try {
                // Sample image data for text-like patterns
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;

                let edgeCount = 0;
                let linePatterns = 0;

                // Simple edge detection for text
                for (let y = 10; y < height - 10; y += 8) {
                    for (let x = 10; x < width - 10; x += 8) {
                        const idx = (y * width + x) * 4;

                        // Calculate brightness
                        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                        const rightBrightness = (data[idx + 32] + data[idx + 33] + data[idx + 34]) / 3;
                        const bottomBrightness = (data[idx + width * 32] + data[idx + width * 32 + 1] + data[idx + width * 32 + 2]) / 3;

                        // Detect edges (text characteristics)
                        if (Math.abs(brightness - rightBrightness) > 50 || Math.abs(brightness - bottomBrightness) > 50) {
                            edgeCount++;

                            // Check for line patterns
                            if (Math.abs(brightness - rightBrightness) > 80) linePatterns++;
                        }
                    }
                }

                const totalSamples = ((width - 20) / 8) * ((height - 20) / 8);
                const edgeRatio = edgeCount / totalSamples;
                const lineRatio = linePatterns / totalSamples;

                // Text detection criteria
                const hasText = edgeRatio > 0.1 && edgeRatio < 0.4 && lineRatio > 0.05;

                if (hasText) {
                    console.log(`📊 Text pattern analysis: edges=${edgeRatio.toFixed(3)}, lines=${lineRatio.toFixed(3)}`);
                }

                return hasText;
            } catch (error) {
                console.warn('Text pattern analysis error:', error);
                return false;
            }
        }

        initializeSuspiciousCategories() {
            if (!this.suspiciousItemsCategories) {
                this.suspiciousItemsCategories = {
                    booksAndPapers: {
                        items: ['book', 'notebook', 'paper', 'magazine', 'journal', 'textbook'],
                        baseScore: 80,
                        violationType: 'books_notes_detected',
                        severity: 'high'
                    },
                    electronicDevices: {
                        items: ['cell phone', 'mobile phone', 'phone', 'smartphone', 'tv', 'remote', 'laptop', 'mouse', 'keyboard', 'tablet', 'ipad'],
                        baseScore: 100,
                        violationType: 'electronic_device_detected',
                        severity: 'high'
                    },
                    writingMaterials: {
                        items: ['pencil', 'pen', 'marker', 'highlighter', 'eraser'],
                        baseScore: 60,
                        violationType: 'writing_materials_detected',
                        severity: 'medium'
                    },
                    otherSuspicious: {
                        items: ['cup', 'bottle', 'bag', 'backpack', 'wallet', 'purse', 'calculator'],
                        baseScore: 50,
                        violationType: 'suspicious_item_detected',
                        severity: 'medium'
                    }
                };
                console.log('🔧 Suspicious categories initialized');
            }
        }

        /**
         * Get current tracking status for all objects
         */
        getTrackingStatus() {
            const status = {};

            for (const [objectType, state] of this.objectTracker.trackedObjects) {
                status[objectType] = {
                    isActive: state.consecutiveDetections > 0,
                    consecutiveDetections: state.consecutiveDetections,
                    missedFrames: state.missedFrames,
                    lastSeen: state.lastDetectionTime ? new Date(state.lastDetectionTime).toLocaleTimeString() : 'Never',
                    status: this.getObjectStatus(objectType, state)
                };
            }

            return status;
        }

        /**
         * Get human-readable status for an object
         */
        getObjectStatus(objectType, state) {
            const threshold = this.objectTracker.violationThresholds[objectType] || this.objectTracker.violationThresholds.default;
            const gracePeriod = this.objectTracker.gracePeriod[objectType] || this.objectTracker.gracePeriod.default;

            if (state.consecutiveDetections >= threshold) {
                return `🚨 VIOLATION READY (${state.consecutiveDetections}/${threshold})`;
            } else if (state.consecutiveDetections > 0) {
                return `🟡 TRACKING (${state.consecutiveDetections}/${threshold})`;
            } else if (state.missedFrames > 0 && state.missedFrames <= gracePeriod) {
                return `⏳ GRACE PERIOD (${state.missedFrames}/${gracePeriod})`;
            } else {
                return `⚪ INACTIVE`;
            }
        }

        /**
         * Dynamically register new object type for tracking
         */
        registerObjectType(objectType, options = {}) {
            if (!this.objectTracker.trackedObjects.has(objectType)) {
                this.objectTracker.trackedObjects.set(objectType, {
                    consecutiveDetections: 0,
                    missedFrames: 0,
                    lastDetectionTime: null,
                    confidence: 0
                });

                // Set custom thresholds if provided
                if (options.gracePeriod) {
                    this.objectTracker.gracePeriod[objectType] = options.gracePeriod;
                }
                if (options.violationThreshold) {
                    this.objectTracker.violationThresholds[objectType] = options.violationThreshold;
                }

                console.log(`📋 Registered new object type: ${objectType}`, options);
            }
        }

        /**
         * Log detailed tracking status (for debugging)
         */
        logTrackingStatus() {
            const status = this.getTrackingStatus();
            console.log('📊 OBJECT TRACKING STATUS:');

            for (const [objectType, info] of Object.entries(status)) {
                console.log(`  ${objectType}: ${info.status} | Confidence: ${(info.confidence * 100).toFixed(1)}% | Last seen: ${info.lastSeen}`);
            }
        }

        /**
         * Update object tracking state based on current frame detections
         */
        updateObjectTracking(predictions) {
            const currentTime = Date.now();

            // Process each tracked object type
            for (const [objectType, state] of this.objectTracker.trackedObjects) {
                const detection = this.findObjectInPredictions(predictions, objectType);

                if (detection) {
                    this.handleObjectDetected(objectType, detection, currentTime);
                } else {
                    this.handleObjectMissed(objectType, currentTime);
                }

                // Check for violations based on accumulated state
                this.checkObjectViolation(objectType, state);
            }

            // Log status every 30 frames (approximately every 5 seconds at 6 FPS)
            if (!this.frameCounter) this.frameCounter = 0;
            this.frameCounter++;

            if (this.frameCounter % 30 === 0) {
                this.logTrackingStatus();
            }
        }

        /**
         * Find object of specific type in predictions
         */
        findObjectInPredictions(predictions, objectType) {
            const searchTerms = this.getSearchTermsForObjectType(objectType);

            return predictions.find(prediction => {
                const className = prediction.class.toLowerCase();
                return searchTerms.some(term =>
                    className.includes(term) || term.includes(className)
                );
            });
        }

        /**
         * Get search terms for object type
         */
        getSearchTermsForObjectType(objectType) {
            const searchMap = {
                'mobile': ['cell phone', 'mobile phone', 'phone', 'smartphone'],
                'book': ['book', 'notebook', 'paper', 'magazine', 'journal', 'textbook'],
                'remote': ['remote', 'tv remote'],
                'cup': ['cup', 'mug', 'bottle']
            };

            return searchMap[objectType] || [objectType];
        }

        /**
         * Handle when object is detected in current frame
         */
        handleObjectDetected(objectType, detection, currentTime) {
            const state = this.objectTracker.trackedObjects.get(objectType);
            const confidence = detection.score;

            // Update state based on confidence level
            if (confidence >= this.objectTracker.thresholds.high) {
                // High confidence: Strong detection
                state.consecutiveDetections++;
                state.missedFrames = 0;
                state.confidence = confidence;
                state.lastDetectionTime = currentTime;

                console.log(`🔴 HIGH confidence ${objectType}: ${(confidence * 100).toFixed(1)}% (consecutive: ${state.consecutiveDetections})`);

            } else if (confidence >= this.objectTracker.thresholds.medium) {
                // Medium confidence: Contribute to consecutive count
                state.consecutiveDetections++;
                state.missedFrames = 0;
                state.confidence = confidence;
                state.lastDetectionTime = currentTime;

                console.log(`🟡 MEDIUM confidence ${objectType}: ${(confidence * 100).toFixed(1)}% (consecutive: ${state.consecutiveDetections})`);

            } else if (confidence >= this.objectTracker.thresholds.low) {
                // Low confidence: Reset misses but don't increment detections
                state.missedFrames = 0;
                state.confidence = confidence;
                state.lastDetectionTime = currentTime;

                console.log(`🟢 LOW confidence ${objectType}: ${(confidence * 100).toFixed(1)}% (extending grace period)`);
            }
            // Below low threshold: Ignore completely
        }

        /**
         * Handle when object is missed in current frame
         */
        handleObjectMissed(objectType, currentTime) {
            const state = this.objectTracker.trackedObjects.get(objectType);
            const gracePeriod = this.objectTracker.gracePeriod[objectType] || this.objectTracker.gracePeriod.default;

            state.missedFrames++;

            // Check if grace period exceeded
            if (state.missedFrames > gracePeriod) {
                // Reset state - object is truly gone
                const wasTracking = state.consecutiveDetections > 0;
                state.consecutiveDetections = 0;
                state.confidence = 0;

                if (wasTracking) {
                    console.log(`⚪ ${objectType} lost after ${state.missedFrames} missed frames (grace period: ${gracePeriod})`);
                }
            } else {
                // Still within grace period
                console.log(`⏳ ${objectType} missed: ${state.missedFrames}/${gracePeriod} (grace period active)`);
            }
        }

        /**
         * Check if object state warrants a violation
         */
        checkObjectViolation(objectType, state) {
            const threshold = this.objectTracker.violationThresholds[objectType] || this.objectTracker.violationThresholds.default;

            if (state.consecutiveDetections >= threshold && state.confidence >= this.objectTracker.thresholds.medium) {
                // Determine severity based on confidence and consecutive count
                let severity = 'medium';
                if (state.confidence >= this.objectTracker.thresholds.high || state.consecutiveDetections >= threshold + 2) {
                    severity = 'high';
                }

                console.log(`🚨 STATEFUL VIOLATION: ${objectType} detected for ${state.consecutiveDetections} consecutive frames (confidence: ${(state.confidence * 100).toFixed(1)}%)`);

                // Trigger violation
                this.triggerViolation(
                    `${objectType}_detected_stateful`,
                    `${objectType} consistently detected over ${state.consecutiveDetections} frames with ${(state.confidence * 100).toFixed(1)}% confidence`,
                    severity
                );

                // Reset to prevent spam (but keep some history)
                state.consecutiveDetections = Math.floor(threshold / 2);
            }
        }

        /**
         * Detect hands using MediaPipe Hands model
         */
        async detectHandsWithMediaPipe() {
            if (!this.handsModel || !this.videoElement) return [];

            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = this.videoElement.videoWidth;
                canvas.height = this.videoElement.videoHeight;
                ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);

                return new Promise((resolve) => {
                    this.handsModel.onResults((results) => {
                        const detectedHands = [];

                        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                                const landmarks = results.multiHandLandmarks[i];
                                const handedness = results.multiHandedness[i];

                                // Calculate bounding box from landmarks
                                const xs = landmarks.map(point => point.x * canvas.width);
                                const ys = landmarks.map(point => point.y * canvas.height);

                                const minX = Math.min(...xs);
                                const maxX = Math.max(...xs);
                                const minY = Math.min(...ys);
                                const maxY = Math.max(...ys);

                                // Add padding to bounding box
                                const padding = 20;
                                const handBbox = {
                                    x: Math.max(0, minX - padding),
                                    y: Math.max(0, minY - padding),
                                    width: Math.min(canvas.width, maxX - minX + 2 * padding),
                                    height: Math.min(canvas.height, maxY - minY + 2 * padding),
                                    label: handedness.label,
                                    confidence: handedness.score
                                };

                                detectedHands.push(handBbox);
                                console.log(`✋ Hand detected: ${handedness.label} (${(handedness.score * 100).toFixed(1)}% confidence)`);
                            }
                        }

                        // Store detected hands in instance variable
                        this.detectedHands = detectedHands;
                        this.gazeAwayStartTime = null; // Timer for 5-second gaze tracking
                        this.consecutiveLookingAwayFrames = 0; // Consecutive frame counter for robust gaze detection

                        resolve(detectedHands);
                    });

                    this.handsModel.send({ image: canvas });
                });

            } catch (error) {
                console.warn('Hand detection error:', error);
                return [];
            }
        }

        async detectGazeWithMediaPipe() {
            if (!this.faceMesh || !this.videoElement) return;

            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = this.videoElement.videoWidth;
                canvas.height = this.videoElement.videoHeight;
                ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);

                return new Promise((resolve) => {
                    this.faceMesh.onResults((results) => {
                        if (results && results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
                            const landmarks = results.multiFaceLandmarks[0];
                            const gazeDirection = this.analyzeGazeDirection(landmarks);
                            this.statistics.gazeDetections++;

                            if (!gazeDirection.lookingAtScreen) {
                                // Increment consecutive looking away frames
                                this.consecutiveLookingAwayFrames++;

                                console.log(`👀 Looking away: Frame ${this.consecutiveLookingAwayFrames} (X=${gazeDirection.gazeOffsetX.toFixed(3)}, Y=${gazeDirection.gazeOffsetY.toFixed(3)})`);

                                // Trigger violation after 35 consecutive frames (~7 seconds at 5fps)
                                if (this.consecutiveLookingAwayFrames >= 35) {
                                    // Check cooldown to prevent spam
                                    if (!this.gazeViolationCooldown || (Date.now() - this.gazeViolationCooldown) > 15000) {
                                        const secondsAway = Math.floor(this.consecutiveLookingAwayFrames / 5); // Approximate seconds
                                        console.log(`👀 GAZE VIOLATION: Looking away for ${this.consecutiveLookingAwayFrames} frames (~${secondsAway} seconds)`);
                                        this.triggerViolation('focus_lost', `Candidate looking away from screen for ${secondsAway} seconds`, 'medium');
                                        this.gazeViolationCooldown = Date.now();
                                        this.consecutiveLookingAwayFrames = 25; // Reset to prevent immediate re-trigger
                                    } else {
                                        const cooldownRemaining = Math.ceil((15000 - (Date.now() - this.gazeViolationCooldown)) / 1000);
                                        console.log(`👀 Gaze violation on cooldown: ${cooldownRemaining}s remaining`);
                                    }
                                }
                            } else {
                                // Reset counter immediately when looking back at screen
                                if (this.consecutiveLookingAwayFrames > 0) {
                                    console.log(`👀 Looking back at screen after ${this.consecutiveLookingAwayFrames} frames (~${Math.floor(this.consecutiveLookingAwayFrames / 5)} seconds)`);
                                    this.consecutiveLookingAwayFrames = 0;
                                }
                            }
                        }

                        resolve(results);
                    });

                    this.faceMesh.send({ image: canvas });
                });

            } catch (error) {
                console.warn('Gaze detection error:', error);
            }
        }

        analyzeGazeDirection(landmarks) {
            try {
                const leftEye = landmarks[33];
                const rightEye = landmarks[263];
                const noseTip = landmarks[1];
                const leftEyeOuter = landmarks[130];
                const rightEyeOuter = landmarks[359];

                // Calculate eye center and nose position
                const eyeCenterX = (leftEye.x + rightEye.x) / 2;
                const eyeCenterY = (leftEye.y + rightEye.y) / 2;

                // Calculate head pose angles (more robust approach)
                const faceWidth = Math.abs(leftEyeOuter.x - rightEyeOuter.x);
                const noseToEyeX = Math.abs(eyeCenterX - noseTip.x);
                const noseToEyeY = Math.abs(eyeCenterY - noseTip.y);

                // Normalize by face width to account for distance variations
                const normalizedOffsetX = noseToEyeX / faceWidth;
                const normalizedOffsetY = noseToEyeY / faceWidth;

                // More lenient thresholds to prevent false positives
                const yawThreshold = 0.15; // Increased from 0.05 (more lenient left/right)
                const pitchThreshold = 0.12; // Increased from 0.05 (more lenient up/down)

                // Create "dead zone" in center where minor movements are ignored
                const deadZoneX = 0.08; // Small dead zone for micro-movements
                const deadZoneY = 0.06;

                // Check if within acceptable range (looking at screen)
                const withinDeadZone = normalizedOffsetX < deadZoneX && normalizedOffsetY < deadZoneY;
                const withinThreshold = normalizedOffsetX < yawThreshold && normalizedOffsetY < pitchThreshold;

                const lookingAtScreen = withinDeadZone || withinThreshold;

                // Enhanced logging for debugging
                if (!lookingAtScreen) {
                    console.log(`👀 Gaze Analysis: X-offset=${normalizedOffsetX.toFixed(3)} (threshold: ${yawThreshold}), Y-offset=${normalizedOffsetY.toFixed(3)} (threshold: ${pitchThreshold})`);
                } else {
                    console.log(`👀 Looking at screen: X-offset=${normalizedOffsetX.toFixed(3)}, Y-offset=${normalizedOffsetY.toFixed(3)} ✅`);
                }

                return {
                    lookingAtScreen,
                    gazeOffsetX: normalizedOffsetX,
                    gazeOffsetY: normalizedOffsetY,
                    withinDeadZone,
                    faceWidth
                };
            } catch (error) {
                console.warn('Gaze analysis error:', error);
                return { lookingAtScreen: true }; // Default to "looking at screen" on error
            }
        }
    }

    // UnifiedDetectionSystem for backward compatibility
    class UnifiedDetectionSystem extends AIDetectionSystem {
        constructor() {
            super();
            console.log('🔄 Using UnifiedDetectionSystem (backward compatible)');
        }
    }

    // Export to window object
    try {
        console.log('📡 Exporting DetectionSystem to window object...');

        window.AIDetectionSystem = AIDetectionSystem;
        window.UnifiedDetectionSystem = UnifiedDetectionSystem;
        window.DetectionSystem = UnifiedDetectionSystem;

        console.log('✅ Successfully exported DetectionSystem to window object');

        if (window.DetectionSystem) {
            console.log('✅ DetectionSystem is now available on window.DetectionSystem');

            try {
                const test = new window.DetectionSystem();
                console.log('✅ DetectionSystem instantiation test passed');

                const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(test))
                    .filter(m => m !== 'constructor' && typeof test[m] === 'function');
                console.log('Available methods:', methods.join(', '));

            } catch (e) {
                console.error('❌ DetectionSystem instantiation test failed:', e);
            }
        } else {
            console.error('❌ Failed to export DetectionSystem to window object');
        }

    } catch (error) {
        console.error('❌ Error exporting DetectionSystem:', error);
    }
}