/**
 * Dashboard Routes
 * Handles interviewer dashboard and real-time monitoring
 */

const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
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
 * @route   GET /api/v1/dashboard/overview
 * @desc    Get dashboard overview statistics
 * @access  Private
 */
router.get('/overview', auth, async(req, res) => {
    try {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const [
            todayStats,
            weekStats,
            monthStats,
            activeInterviews,
            recentViolations,
            highRiskInterviews
        ] = await Promise.all([
            // Today's statistics
            Interview.aggregate([
                { $match: { 'sessionData.startTime': { $gte: startOfDay } } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        completed: { $sum: { $cond: [{ $eq: ['$sessionData.status', 'completed'] }, 1, 0] } },
                        inProgress: { $sum: { $cond: [{ $eq: ['$sessionData.status', 'in_progress'] }, 1, 0] } },
                        avgIntegrity: { $avg: '$scores.integrityScore' },
                        totalViolations: { $sum: { $size: '$violations' } }
                    }
                }
            ]),

            // This week's statistics
            Interview.aggregate([
                { $match: { 'sessionData.startTime': { $gte: startOfWeek } } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        completed: { $sum: { $cond: [{ $eq: ['$sessionData.status', 'completed'] }, 1, 0] } },
                        avgIntegrity: { $avg: '$scores.integrityScore' }
                    }
                }
            ]),

            // This month's statistics
            Interview.aggregate([
                { $match: { 'sessionData.startTime': { $gte: startOfMonth } } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        completed: { $sum: { $cond: [{ $eq: ['$sessionData.status', 'completed'] }, 1, 0] } },
                        avgIntegrity: { $avg: '$scores.integrityScore' }
                    }
                }
            ]),

            // Active interviews
            Interview.find({ 'sessionData.status': 'in_progress' })
            .select('sessionId candidateInfo sessionData scores')
            .sort({ 'sessionData.startTime': -1 })
            .limit(10),

            // Recent violations (last 24 hours)
            Interview.aggregate([
                { $match: { 'sessionData.startTime': { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
                { $unwind: '$violations' },
                { $match: { 'violations.timestamp': { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
                {
                    $project: {
                        sessionId: 1,
                        candidateName: '$candidateInfo.name',
                        violation: '$violations',
                        integrityScore: '$scores.integrityScore'
                    }
                },
                { $sort: { 'violation.timestamp': -1 } },
                { $limit: 20 }
            ]),

            // High-risk interviews requiring attention
            Interview.find({ 'flags.isHighRisk': true, 'sessionData.status': { $in: ['completed', 'in_progress'] } })
            .select('sessionId candidateInfo scores analysis sessionData')
            .sort({ 'sessionData.startTime': -1 })
            .limit(10)
        ]);

        const overview = {
            today: todayStats[0] || { total: 0, completed: 0, inProgress: 0, avgIntegrity: 0, totalViolations: 0 },
            week: weekStats[0] || { total: 0, completed: 0, avgIntegrity: 0 },
            month: monthStats[0] || { total: 0, completed: 0, avgIntegrity: 0 },
            activeInterviews: activeInterviews.length,
            recentViolations: recentViolations.length,
            highRiskCount: highRiskInterviews.length
        };

        res.json({
            success: true,
            data: {
                overview,
                activeInterviews,
                recentViolations,
                highRiskInterviews
            }
        });

    } catch (error) {
        console.error('Error fetching dashboard overview:', error);
        res.status(500).json({
            error: 'Failed to fetch dashboard data',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/v1/dashboard/active-interviews
 * @desc    Get currently active interviews
 * @access  Private
 */
router.get('/active-interviews', auth, async(req, res) => {
    try {
        const activeInterviews = await Interview.find({ 'sessionData.status': 'in_progress' })
            .select('sessionId candidateInfo sessionData scores violations flags')
            .sort({ 'sessionData.startTime': -1 });

        // Calculate additional metrics for each interview
        const enrichedInterviews = activeInterviews.map(interview => {
            const currentTime = new Date();
            const elapsedTime = Math.floor((currentTime - interview.sessionData.startTime) / 1000);
            const recentViolations = interview.violations.filter(v =>
                new Date(v.timestamp) > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
            );

            return {
                ...interview.toObject(),
                elapsedTime,
                formattedElapsedTime: formatTime(elapsedTime),
                recentViolationCount: recentViolations.length,
                lastViolation: interview.violations.length > 0 ?
                    interview.violations[interview.violations.length - 1] : null
            };
        });

        res.json({
            success: true,
            data: {
                count: enrichedInterviews.length,
                interviews: enrichedInterviews
            }
        });

    } catch (error) {
        console.error('Error fetching active interviews:', error);
        res.status(500).json({
            error: 'Failed to fetch active interviews',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/v1/dashboard/violations/recent
 * @desc    Get recent violations across all interviews
 * @access  Private
 */
router.get('/violations/recent', auth, [
    query('hours').optional().isInt({ min: 1, max: 168 }).withMessage('Hours must be between 1-168'),
    query('severity').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid severity level'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100')
], handleValidationErrors, async(req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const severity = req.query.severity;
        const limit = parseInt(req.query.limit) || 50;

        const timeThreshold = new Date(Date.now() - hours * 60 * 60 * 1000);

        const pipeline = [
            { $match: { 'sessionData.startTime': { $gte: timeThreshold } } },
            { $unwind: '$violations' },
            { $match: { 'violations.timestamp': { $gte: timeThreshold } } }
        ];

        if (severity) {
            pipeline.push({ $match: { 'violations.severity': severity } });
        }

        pipeline.push({
            $project: {
                sessionId: 1,
                candidateName: '$candidateInfo.name',
                candidateEmail: '$candidateInfo.email',
                position: '$candidateInfo.position',
                violation: '$violations',
                integrityScore: '$scores.integrityScore',
                interviewStatus: '$sessionData.status'
            }
        }, { $sort: { 'violation.timestamp': -1 } }, { $limit: limit });

        const recentViolations = await Interview.aggregate(pipeline);

        // Group violations by type for summary
        const violationSummary = {};
        recentViolations.forEach(item => {
            const type = item.violation.type;
            if (!violationSummary[type]) {
                violationSummary[type] = {
                    count: 0,
                    severityBreakdown: { low: 0, medium: 0, high: 0 }
                };
            }
            violationSummary[type].count++;
            violationSummary[type].severityBreakdown[item.violation.severity]++;
        });

        res.json({
            success: true,
            data: {
                violations: recentViolations,
                summary: violationSummary,
                totalCount: recentViolations.length,
                timeRange: `${hours} hours`
            }
        });

    } catch (error) {
        console.error('Error fetching recent violations:', error);
        res.status(500).json({
            error: 'Failed to fetch recent violations',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/v1/dashboard/alerts
 * @desc    Get system alerts and notifications
 * @access  Private
 */
router.get('/alerts', auth, async(req, res) => {
    try {
        const now = new Date();
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const [
            systemAlerts,
            highRiskInterviews,
            technicalIssues,
            suspiciousActivity
        ] = await Promise.all([
            // System-level alerts
            Interview.aggregate([
                { $match: { 'sessionData.startTime': { $gte: last24Hours } } },
                {
                    $group: {
                        _id: null,
                        highViolationRate: {
                            $sum: {
                                $cond: [{ $gt: [{ $size: '$violations' }, 5] }, 1, 0]
                            }
                        },
                        lowIntegrityScores: {
                            $sum: {
                                $cond: [{ $lt: ['$scores.integrityScore', 50] }, 1, 0]
                            }
                        },
                        technicalIssues: {
                            $sum: {
                                $cond: ['$flags.technicalIssues', 1, 0]
                            }
                        }
                    }
                }
            ]),

            // High-risk interviews needing immediate attention
            Interview.find({
                'flags.isHighRisk': true,
                'sessionData.status': 'in_progress'
            }).select('sessionId candidateInfo scores violations'),

            // Recent technical issues
            Interview.find({
                'flags.technicalIssues': true,
                'sessionData.startTime': { $gte: last24Hours }
            }).select('sessionId candidateInfo sessionData events'),

            // Suspicious activity patterns
            Interview.aggregate([
                { $match: { 'sessionData.startTime': { $gte: last24Hours } } },
                { $unwind: '$violations' },
                {
                    $group: {
                        _id: '$candidateInfo.email',
                        candidateName: { $first: '$candidateInfo.name' },
                        violationCount: { $sum: 1 },
                        sessions: { $addToSet: '$sessionId' },
                        highSeverityCount: {
                            $sum: { $cond: [{ $eq: ['$violations.severity', 'high'] }, 1, 0] }
                        }
                    }
                },
                { $match: { violationCount: { $gte: 10 } } },
                { $sort: { violationCount: -1 } }
            ])
        ]);

        const alerts = [];

        // Process system alerts
        const systemStats = systemAlerts[0];
        if (systemStats) {
            if (systemStats.highViolationRate > 5) {
                alerts.push({
                    type: 'system',
                    severity: 'high',
                    title: 'High Violation Rate Detected',
                    message: `${systemStats.highViolationRate} interviews with excessive violations in the last 24 hours`,
                    timestamp: now,
                    actionRequired: true
                });
            }

            if (systemStats.lowIntegrityScores > 3) {
                alerts.push({
                    type: 'system',
                    severity: 'medium',
                    title: 'Multiple Low Integrity Scores',
                    message: `${systemStats.lowIntegrityScores} interviews with integrity scores below 50%`,
                    timestamp: now,
                    actionRequired: true
                });
            }

            if (systemStats.technicalIssues > 0) {
                alerts.push({
                    type: 'technical',
                    severity: 'medium',
                    title: 'Technical Issues Reported',
                    message: `${systemStats.technicalIssues} interviews experienced technical difficulties`,
                    timestamp: now,
                    actionRequired: false
                });
            }
        }

        // Add high-risk interview alerts
        highRiskInterviews.forEach(interview => {
            alerts.push({
                type: 'interview',
                severity: 'high',
                title: 'High-Risk Interview in Progress',
                message: `${interview.candidateInfo.name} - Integrity Score: ${interview.scores.integrityScore}%`,
                sessionId: interview.sessionId,
                timestamp: now,
                actionRequired: true
            });
        });

        // Add suspicious activity alerts
        suspiciousActivity.forEach(activity => {
            alerts.push({
                type: 'security',
                severity: 'high',
                title: 'Suspicious Activity Pattern',
                message: `${activity.candidateName} has ${activity.violationCount} violations across ${activity.sessions.length} sessions`,
                timestamp: now,
                actionRequired: true
            });
        });

        res.json({
            success: true,
            data: {
                alerts: alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
                summary: {
                    total: alerts.length,
                    high: alerts.filter(a => a.severity === 'high').length,
                    medium: alerts.filter(a => a.severity === 'medium').length,
                    actionRequired: alerts.filter(a => a.actionRequired).length
                }
            }
        });

    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({
            error: 'Failed to fetch alerts',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/v1/dashboard/performance
 * @desc    Get system performance metrics
 * @access  Private
 */
router.get('/performance', auth, async(req, res) => {
    try {
        const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const performanceMetrics = await Interview.aggregate([
            { $match: { 'sessionData.startTime': { $gte: last7Days } } },
            {
                $group: {
                    _id: {
                        date: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$sessionData.startTime'
                            }
                        }
                    },
                    totalInterviews: { $sum: 1 },
                    completedInterviews: {
                        $sum: { $cond: [{ $eq: ['$sessionData.status', 'completed'] }, 1, 0] }
                    },
                    averageIntegrityScore: { $avg: '$scores.integrityScore' },
                    averageDuration: { $avg: '$sessionData.duration' },
                    totalViolations: { $sum: { $size: '$violations' } },
                    technicalIssues: {
                        $sum: { $cond: ['$flags.technicalIssues', 1, 0] }
                    }
                }
            },
            { $sort: { '_id.date': 1 } }
        ]);

        // Calculate completion rate and other KPIs
        const enrichedMetrics = performanceMetrics.map(metric => ({
            date: metric._id.date,
            totalInterviews: metric.totalInterviews,
            completedInterviews: metric.completedInterviews,
            completionRate: metric.totalInterviews > 0 ?
                Math.round((metric.completedInterviews / metric.totalInterviews) * 100) : 0,
            averageIntegrityScore: Math.round(metric.averageIntegrityScore || 0),
            averageDuration: Math.round((metric.averageDuration || 0) / 60), // Convert to minutes
            totalViolations: metric.totalViolations,
            violationRate: metric.totalInterviews > 0 ?
                Math.round((metric.totalViolations / metric.totalInterviews) * 100) / 100 : 0,
            technicalIssues: metric.technicalIssues,
            reliabilityScore: metric.totalInterviews > 0 ?
                Math.round(((metric.totalInterviews - metric.technicalIssues) / metric.totalInterviews) * 100) : 100
        }));

        res.json({
            success: true,
            data: {
                metrics: enrichedMetrics,
                period: '7 days'
            }
        });

    } catch (error) {
        console.error('Error fetching performance metrics:', error);
        res.status(500).json({
            error: 'Failed to fetch performance metrics',
            message: error.message
        });
    }
});

/**
 * Helper function to format time in HH:MM:SS
 */
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

module.exports = router;