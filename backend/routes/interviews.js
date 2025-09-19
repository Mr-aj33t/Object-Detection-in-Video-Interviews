/**
 * Interview Routes
 * Handles all interview-related API endpoints
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const Interview = require('../models/Interview');
const auth = require('../middleware/auth');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};

/**
 * @route   POST /api/v1/interviews
 * @desc    Create a new interview session
 * @access  Public
 */
router.post('/', [
    body('candidateName').notEmpty().trim().withMessage('Candidate name is required'),
    body('position').notEmpty().trim().withMessage('Position is required'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('interviewType').optional().isIn(['technical', 'behavioral', 'screening', 'final']),
    body('scheduledDuration').optional().isInt({ min: 1, max: 300 }).withMessage('Duration must be between 1-300 minutes')
], handleValidationErrors, async(req, res) => {
    try {
        const {
            candidateName,
            position,
            email,
            department,
            candidateId,
            interviewType = 'screening',
            scheduledDuration = 60,
            title,
            description
        } = req.body;

        // Generate unique session ID
        const sessionId = `interview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const interview = new Interview({
            sessionId,
            candidateInfo: {
                name: candidateName,
                email,
                position,
                department,
                candidateId
            },
            interviewDetails: {
                title: title || 'Video Interview Session',
                description,
                interviewType,
                scheduledDuration
            },
            sessionData: {
                startTime: new Date(),
                status: 'scheduled',
                browserInfo: {
                    userAgent: req.get('User-Agent'),
                    platform: req.body.platform,
                    language: req.body.language
                },
                deviceInfo: {
                    screenResolution: req.body.screenResolution,
                    timezone: req.body.timezone,
                    connection: req.body.connection
                }
            },
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                referrer: req.get('Referer'),
                apiVersion: '1.0'
            }
        });

        await interview.save();

        res.status(201).json({
            success: true,
            message: 'Interview session created successfully',
            data: {
                sessionId: interview.sessionId,
                interview: interview
            }
        });

    } catch (error) {
        console.error('Error creating interview:', error);
        res.status(500).json({
            error: 'Failed to create interview session',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/v1/interviews
 * @desc    Get all interviews with pagination and filtering
 * @access  Private
 */
router.get('/', [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100'),
    query('status').optional().isIn(['scheduled', 'in_progress', 'completed', 'cancelled', 'failed']),
    query('riskLevel').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date')
], handleValidationErrors, async(req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter object
        const filter = {};

        if (req.query.status) {
            filter['sessionData.status'] = req.query.status;
        }

        if (req.query.riskLevel) {
            filter['analysis.riskLevel'] = req.query.riskLevel;
        }

        if (req.query.requiresReview === 'true') {
            filter['flags.requiresReview'] = true;
        }

        if (req.query.hasViolations === 'true') {
            filter['flags.hasViolations'] = true;
        }

        if (req.query.startDate || req.query.endDate) {
            filter['sessionData.startTime'] = {};
            if (req.query.startDate) {
                filter['sessionData.startTime'].$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                filter['sessionData.startTime'].$lte = new Date(req.query.endDate);
            }
        }

        if (req.query.search) {
            filter.$or = [
                { 'candidateInfo.name': { $regex: req.query.search, $options: 'i' } },
                { 'candidateInfo.email': { $regex: req.query.search, $options: 'i' } },
                { 'candidateInfo.position': { $regex: req.query.search, $options: 'i' } }
            ];
        }

        const interviews = await Interview.find(filter)
            .sort({ 'sessionData.startTime': -1 })
            .skip(skip)
            .limit(limit)
            .select('-events -metadata'); // Exclude large fields for list view

        const total = await Interview.countDocuments(filter);

        res.json({
            success: true,
            data: {
                interviews,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Error fetching interviews:', error);
        res.status(500).json({
            error: 'Failed to fetch interviews',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/v1/interviews/:sessionId
 * @desc    Get interview by session ID
 * @access  Public
 */
router.get('/:sessionId', [
    param('sessionId').notEmpty().withMessage('Session ID is required')
], handleValidationErrors, async(req, res) => {
    try {
        const interview = await Interview.findOne({ sessionId: req.params.sessionId });

        if (!interview) {
            return res.status(404).json({
                error: 'Interview not found',
                message: 'No interview found with the provided session ID'
            });
        }

        res.json({
            success: true,
            data: interview
        });

    } catch (error) {
        console.error('Error fetching interview:', error);
        res.status(500).json({
            error: 'Failed to fetch interview',
            message: error.message
        });
    }
});

/**
 * @route   PUT /api/v1/interviews/:sessionId/start
 * @desc    Start an interview session
 * @access  Public
 */
router.put('/:sessionId/start', [
    param('sessionId').notEmpty().withMessage('Session ID is required')
], handleValidationErrors, async(req, res) => {
    try {
        const interview = await Interview.findOne({ sessionId: req.params.sessionId });

        if (!interview) {
            return res.status(404).json({
                error: 'Interview not found'
            });
        }

        if (interview.sessionData.status !== 'scheduled') {
            return res.status(400).json({
                error: 'Interview cannot be started',
                message: `Interview is currently ${interview.sessionData.status}`
            });
        }

        interview.sessionData.status = 'in_progress';
        interview.sessionData.startTime = new Date();

        // Add start event
        interview.events.push({
            id: `event_${Date.now()}`,
            type: 'interview_started',
            message: 'Interview session started',
            severity: 'info',
            timestamp: new Date()
        });

        await interview.save();

        res.json({
            success: true,
            message: 'Interview started successfully',
            data: interview
        });

    } catch (error) {
        console.error('Error starting interview:', error);
        res.status(500).json({
            error: 'Failed to start interview',
            message: error.message
        });
    }
});

/**
 * @route   PUT /api/v1/interviews/:sessionId/end
 * @desc    End an interview session
 * @access  Public
 */
router.put('/:sessionId/end', [
    param('sessionId').notEmpty().withMessage('Session ID is required'),
    body('finalData').optional().isObject()
], handleValidationErrors, async(req, res) => {
    try {
        const interview = await Interview.findOne({ sessionId: req.params.sessionId });

        if (!interview) {
            return res.status(404).json({
                error: 'Interview not found'
            });
        }

        if (interview.sessionData.status !== 'in_progress') {
            return res.status(400).json({
                error: 'Interview cannot be ended',
                message: `Interview is currently ${interview.sessionData.status}`
            });
        }

        const endTime = new Date();
        const duration = Math.floor((endTime - interview.sessionData.startTime) / 1000);

        interview.sessionData.status = 'completed';
        interview.sessionData.endTime = endTime;
        interview.sessionData.duration = duration;

        // Update final data if provided
        if (req.body.finalData) {
            if (req.body.finalData.scores) {
                Object.assign(interview.scores, req.body.finalData.scores);
            }
            if (req.body.finalData.statistics) {
                Object.assign(interview.statistics, req.body.finalData.statistics);
            }
        }

        // Add end event
        interview.events.push({
            id: `event_${Date.now()}`,
            type: 'interview_ended',
            message: 'Interview session ended',
            severity: 'info',
            timestamp: endTime
        });

        await interview.save();

        res.json({
            success: true,
            message: 'Interview ended successfully',
            data: interview
        });

    } catch (error) {
        console.error('Error ending interview:', error);
        res.status(500).json({
            error: 'Failed to end interview',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/v1/interviews/:sessionId/violations
 * @desc    Add a violation to an interview
 * @access  Public
 */
router.post('/:sessionId/violations', [
    param('sessionId').notEmpty().withMessage('Session ID is required'),
    body('type').isIn(['no_face', 'multiple_faces', 'focus_lost', 'unauthorized_object', 'eye_closure', 'camera_disabled', 'microphone_disabled']).withMessage('Invalid violation type'),
    body('message').notEmpty().withMessage('Violation message is required'),
    body('severity').isIn(['low', 'medium', 'high']).withMessage('Invalid severity level'),
    body('confidence').optional().isFloat({ min: 0, max: 1 }).withMessage('Confidence must be between 0 and 1')
], handleValidationErrors, async(req, res) => {
    try {
        const interview = await Interview.findOne({ sessionId: req.params.sessionId });

        if (!interview) {
            return res.status(404).json({
                error: 'Interview not found'
            });
        }

        const violationData = {
            type: req.body.type,
            message: req.body.message,
            severity: req.body.severity,
            confidence: req.body.confidence || 1,
            timestamp: new Date(),
            metadata: req.body.metadata || {}
        };

        await interview.addViolation(violationData);

        res.json({
            success: true,
            message: 'Violation added successfully',
            data: {
                violation: violationData,
                integrityScore: interview.scores.integrityScore
            }
        });

    } catch (error) {
        console.error('Error adding violation:', error);
        res.status(500).json({
            error: 'Failed to add violation',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/v1/interviews/:sessionId/events
 * @desc    Add an event to an interview
 * @access  Public
 */
router.post('/:sessionId/events', [
    param('sessionId').notEmpty().withMessage('Session ID is required'),
    body('type').isIn(['interview_started', 'interview_ended', 'violation', 'camera_disabled', 'microphone_disabled', 'system_check', 'focus_change']).withMessage('Invalid event type'),
    body('message').notEmpty().withMessage('Event message is required'),
    body('severity').optional().isIn(['info', 'warning', 'danger']).withMessage('Invalid severity level')
], handleValidationErrors, async(req, res) => {
    try {
        const interview = await Interview.findOne({ sessionId: req.params.sessionId });

        if (!interview) {
            return res.status(404).json({
                error: 'Interview not found'
            });
        }

        const eventData = {
            id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            type: req.body.type,
            message: req.body.message,
            severity: req.body.severity || 'info',
            timestamp: new Date(),
            metadata: req.body.metadata || {}
        };

        await interview.addEvent(eventData);

        res.json({
            success: true,
            message: 'Event added successfully',
            data: eventData
        });

    } catch (error) {
        console.error('Error adding event:', error);
        res.status(500).json({
            error: 'Failed to add event',
            message: error.message
        });
    }
});

/**
 * @route   PUT /api/v1/interviews/:sessionId/scores
 * @desc    Update interview scores
 * @access  Public
 */
router.put('/:sessionId/scores', [
    param('sessionId').notEmpty().withMessage('Session ID is required'),
    body('integrityScore').optional().isFloat({ min: 0, max: 100 }).withMessage('Integrity score must be between 0-100'),
    body('focusScore').optional().isFloat({ min: 0, max: 100 }).withMessage('Focus score must be between 0-100'),
    body('behaviorScore').optional().isFloat({ min: 0, max: 100 }).withMessage('Behavior score must be between 0-100')
], handleValidationErrors, async(req, res) => {
    try {
        const interview = await Interview.findOne({ sessionId: req.params.sessionId });

        if (!interview) {
            return res.status(404).json({
                error: 'Interview not found'
            });
        }

        // Update scores
        if (req.body.integrityScore !== undefined) {
            interview.scores.integrityScore = req.body.integrityScore;
        }
        if (req.body.focusScore !== undefined) {
            interview.scores.focusScore = req.body.focusScore;
        }
        if (req.body.behaviorScore !== undefined) {
            interview.scores.behaviorScore = req.body.behaviorScore;
        }

        await interview.save();

        res.json({
            success: true,
            message: 'Scores updated successfully',
            data: interview.scores
        });

    } catch (error) {
        console.error('Error updating scores:', error);
        res.status(500).json({
            error: 'Failed to update scores',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/v1/interviews/:sessionId/violations
 * @desc    Get all violations for an interview
 * @access  Public
 */
router.get('/:sessionId/violations', [
    param('sessionId').notEmpty().withMessage('Session ID is required')
], handleValidationErrors, async(req, res) => {
    try {
        const interview = await Interview.findOne({ sessionId: req.params.sessionId }).select('violations');

        if (!interview) {
            return res.status(404).json({
                error: 'Interview not found'
            });
        }

        res.json({
            success: true,
            data: {
                violations: interview.violations,
                count: interview.violations.length
            }
        });

    } catch (error) {
        console.error('Error fetching violations:', error);
        res.status(500).json({
            error: 'Failed to fetch violations',
            message: error.message
        });
    }
});

/**
 * @route   DELETE /api/v1/interviews/:sessionId
 * @desc    Delete an interview (soft delete by changing status)
 * @access  Private
 */
router.delete('/:sessionId', auth, [
    param('sessionId').notEmpty().withMessage('Session ID is required')
], handleValidationErrors, async(req, res) => {
    try {
        const interview = await Interview.findOne({ sessionId: req.params.sessionId });

        if (!interview) {
            return res.status(404).json({
                error: 'Interview not found'
            });
        }

        interview.sessionData.status = 'cancelled';
        await interview.save();

        res.json({
            success: true,
            message: 'Interview cancelled successfully'
        });

    } catch (error) {
        console.error('Error deleting interview:', error);
        res.status(500).json({
            error: 'Failed to delete interview',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/v1/interviews/stats/overview
 * @desc    Get interview statistics overview
 * @access  Private
 */
router.get('/stats/overview', auth, async(req, res) => {
    try {
        const dateRange = req.query.dateRange ? {
            start: new Date(req.query.startDate),
            end: new Date(req.query.endDate)
        } : null;

        const stats = await Interview.getStatistics(dateRange);

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({
            error: 'Failed to fetch statistics',
            message: error.message
        });
    }
});

module.exports = router;