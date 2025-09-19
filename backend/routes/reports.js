/**
 * Reports Routes
 * Handles report generation, analytics, and export functionality
 */

const express = require('express');
const router = express.Router();
const { param, query, validationResult } = require('express-validator');
const Interview = require('../models/Interview');
const auth = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

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
 * @route   GET /api/v1/reports/:sessionId
 * @desc    Generate comprehensive report for an interview
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

        // Generate comprehensive report
        const report = generateDetailedReport(interview);

        res.json({
            success: true,
            data: report
        });

    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({
            error: 'Failed to generate report',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/v1/reports/:sessionId/pdf
 * @desc    Generate PDF report for an interview
 * @access  Public
 */
router.get('/:sessionId/pdf', [
    param('sessionId').notEmpty().withMessage('Session ID is required')
], handleValidationErrors, async(req, res) => {
    try {
        const interview = await Interview.findOne({ sessionId: req.params.sessionId });

        if (!interview) {
            return res.status(404).json({
                error: 'Interview not found'
            });
        }

        // Generate PDF
        const pdfBuffer = await generatePDFReport(interview);

        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="proctoring-report-${interview.sessionId}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error generating PDF report:', error);
        res.status(500).json({
            error: 'Failed to generate PDF report',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/v1/reports/analytics/overview
 * @desc    Get analytics overview for all interviews
 * @access  Private
 */
router.get('/analytics/overview', auth, [
    query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date'),
    query('department').optional().isString(),
    query('position').optional().isString()
], handleValidationErrors, async(req, res) => {
    try {
        const { startDate, endDate, department, position } = req.query;

        // Build filter
        const filter = {};

        if (startDate || endDate) {
            filter['sessionData.startTime'] = {};
            if (startDate) filter['sessionData.startTime'].$gte = new Date(startDate);
            if (endDate) filter['sessionData.startTime'].$lte = new Date(endDate);
        }

        if (department) filter['candidateInfo.department'] = department;
        if (position) filter['candidateInfo.position'] = { $regex: position, $options: 'i' };

        // Get analytics data
        const analytics = await generateAnalytics(filter);

        res.json({
            success: true,
            data: analytics
        });

    } catch (error) {
        console.error('Error generating analytics:', error);
        res.status(500).json({
            error: 'Failed to generate analytics',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/v1/reports/analytics/violations
 * @desc    Get violation analytics
 * @access  Private
 */
router.get('/analytics/violations', auth, [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('violationType').optional().isString()
], handleValidationErrors, async(req, res) => {
    try {
        const { startDate, endDate, violationType } = req.query;

        const matchStage = {};

        if (startDate || endDate) {
            matchStage['sessionData.startTime'] = {};
            if (startDate) matchStage['sessionData.startTime'].$gte = new Date(startDate);
            if (endDate) matchStage['sessionData.startTime'].$lte = new Date(endDate);
        }

        const pipeline = [
            { $match: matchStage },
            { $unwind: '$violations' },
            {
                $group: {
                    _id: '$violations.type',
                    count: { $sum: 1 },
                    averageSeverity: {
                        $avg: {
                            $cond: [
                                { $eq: ['$violations.severity', 'high'] },
                                3,
                                { $cond: [{ $eq: ['$violations.severity', 'medium'] }, 2, 1] }
                            ]
                        }
                    },
                    interviews: { $addToSet: '$sessionId' }
                }
            },
            {
                $project: {
                    violationType: '$_id',
                    count: 1,
                    averageSeverity: 1,
                    affectedInterviews: { $size: '$interviews' },
                    _id: 0
                }
            },
            { $sort: { count: -1 } }
        ];

        if (violationType) {
            pipeline.splice(1, 0, { $match: { 'violations.type': violationType } });
        }

        const violationStats = await Interview.aggregate(pipeline);

        res.json({
            success: true,
            data: violationStats
        });

    } catch (error) {
        console.error('Error generating violation analytics:', error);
        res.status(500).json({
            error: 'Failed to generate violation analytics',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/v1/reports/analytics/trends
 * @desc    Get trend analytics over time
 * @access  Private
 */
router.get('/analytics/trends', auth, [
    query('period').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Period must be daily, weekly, or monthly'),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
], handleValidationErrors, async(req, res) => {
    try {
        const { period = 'daily', startDate, endDate } = req.query;

        const matchStage = {};

        if (startDate || endDate) {
            matchStage['sessionData.startTime'] = {};
            if (startDate) matchStage['sessionData.startTime'].$gte = new Date(startDate);
            if (endDate) matchStage['sessionData.startTime'].$lte = new Date(endDate);
        }

        // Define date grouping based on period
        let dateGroup;
        switch (period) {
            case 'weekly':
                dateGroup = {
                    year: { $year: '$sessionData.startTime' },
                    week: { $week: '$sessionData.startTime' }
                };
                break;
            case 'monthly':
                dateGroup = {
                    year: { $year: '$sessionData.startTime' },
                    month: { $month: '$sessionData.startTime' }
                };
                break;
            default: // daily
                dateGroup = {
                    year: { $year: '$sessionData.startTime' },
                    month: { $month: '$sessionData.startTime' },
                    day: { $dayOfMonth: '$sessionData.startTime' }
                };
        }

        const trends = await Interview.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: dateGroup,
                    totalInterviews: { $sum: 1 },
                    completedInterviews: {
                        $sum: { $cond: [{ $eq: ['$sessionData.status', 'completed'] }, 1, 0] }
                    },
                    averageIntegrityScore: { $avg: '$scores.integrityScore' },
                    averageDuration: { $avg: '$sessionData.duration' },
                    totalViolations: { $sum: { $size: '$violations' } },
                    highRiskInterviews: {
                        $sum: { $cond: ['$flags.isHighRisk', 1, 0] }
                    }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
        ]);

        res.json({
            success: true,
            data: {
                period,
                trends
            }
        });

    } catch (error) {
        console.error('Error generating trend analytics:', error);
        res.status(500).json({
            error: 'Failed to generate trend analytics',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/v1/reports/export/csv
 * @desc    Export interview data as CSV
 * @access  Private
 */
router.get('/export/csv', auth, [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('status').optional().isIn(['scheduled', 'in_progress', 'completed', 'cancelled', 'failed'])
], handleValidationErrors, async(req, res) => {
    try {
        const { startDate, endDate, status } = req.query;

        const filter = {};

        if (startDate || endDate) {
            filter['sessionData.startTime'] = {};
            if (startDate) filter['sessionData.startTime'].$gte = new Date(startDate);
            if (endDate) filter['sessionData.startTime'].$lte = new Date(endDate);
        }

        if (status) filter['sessionData.status'] = status;

        const interviews = await Interview.find(filter)
            .select('sessionId candidateInfo sessionData scores violations analysis')
            .sort({ 'sessionData.startTime': -1 });

        // Generate CSV
        const csv = generateCSV(interviews);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="interview-data.csv"');
        res.send(csv);

    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({
            error: 'Failed to export CSV',
            message: error.message
        });
    }
});

/**
 * Generate detailed report for an interview
 */
function generateDetailedReport(interview) {
    const violationsByType = {};
    interview.violations.forEach(violation => {
        if (!violationsByType[violation.type]) {
            violationsByType[violation.type] = 0;
        }
        violationsByType[violation.type]++;
    });

    const eventsByType = {};
    interview.events.forEach(event => {
        if (!eventsByType[event.type]) {
            eventsByType[event.type] = 0;
        }
        eventsByType[event.type]++;
    });

    return {
        sessionInfo: {
            sessionId: interview.sessionId,
            candidateName: interview.candidateInfo.name,
            candidateEmail: interview.candidateInfo.email,
            position: interview.candidateInfo.position,
            department: interview.candidateInfo.department,
            interviewType: interview.interviewDetails.interviewType,
            startTime: interview.sessionData.startTime,
            endTime: interview.sessionData.endTime,
            duration: interview.sessionData.duration,
            formattedDuration: interview.formattedDuration,
            status: interview.sessionData.status
        },
        scores: {
            integrityScore: interview.scores.integrityScore,
            focusScore: interview.scores.focusScore,
            behaviorScore: interview.scores.behaviorScore,
            overallScore: interview.scores.overallScore
        },
        analysis: {
            recommendation: interview.analysis.recommendation,
            riskLevel: interview.analysis.riskLevel,
            summary: interview.analysis.summary,
            keyFindings: interview.analysis.keyFindings
        },
        statistics: {
            totalViolations: interview.violations.length,
            violationsByType,
            totalEvents: interview.events.length,
            eventsByType,
            highSeverityViolations: interview.violations.filter(v => v.severity === 'high').length
        },
        flags: {
            hasViolations: interview.flags.hasViolations,
            requiresReview: interview.flags.requiresReview,
            isHighRisk: interview.flags.isHighRisk,
            technicalIssues: interview.flags.technicalIssues
        },
        violations: interview.violations.map(v => ({
            type: v.type,
            message: v.message,
            severity: v.severity,
            timestamp: v.timestamp,
            confidence: v.confidence
        })),
        timeline: interview.events.map(e => ({
            type: e.type,
            message: e.message,
            severity: e.severity,
            timestamp: e.timestamp
        })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
        generatedAt: new Date(),
        reportVersion: '1.0'
    };
}

/**
 * Generate PDF report
 */
async function generatePDFReport(interview) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));

            // Header
            doc.fontSize(20).text('Video Proctoring Report', { align: 'center' });
            doc.moveDown();

            // Interview Information
            doc.fontSize(16).text('Interview Information', { underline: true });
            doc.fontSize(12);
            doc.text(`Session ID: ${interview.sessionId}`);
            doc.text(`Candidate: ${interview.candidateInfo.name}`);
            doc.text(`Position: ${interview.candidateInfo.position}`);
            doc.text(`Date: ${interview.sessionData.startTime.toLocaleDateString()}`);
            doc.text(`Duration: ${interview.formattedDuration}`);
            doc.moveDown();

            // Scores
            doc.fontSize(16).text('Integrity Scores', { underline: true });
            doc.fontSize(12);
            doc.text(`Integrity Score: ${interview.scores.integrityScore}%`);
            doc.text(`Focus Score: ${interview.scores.focusScore}%`);
            doc.text(`Overall Score: ${interview.scores.overallScore}%`);
            doc.moveDown();

            // Analysis
            doc.fontSize(16).text('Analysis', { underline: true });
            doc.fontSize(12);
            doc.text(`Risk Level: ${interview.analysis.riskLevel.toUpperCase()}`);
            doc.text(`Recommendation: ${interview.analysis.recommendation.replace('_', ' ').toUpperCase()}`);
            doc.text(`Summary: ${interview.analysis.summary}`);
            doc.moveDown();

            // Violations
            if (interview.violations.length > 0) {
                doc.fontSize(16).text('Violations Detected', { underline: true });
                doc.fontSize(12);
                interview.violations.forEach((violation, index) => {
                    doc.text(`${index + 1}. ${violation.message} (${violation.severity.toUpperCase()}) - ${violation.timestamp.toLocaleString()}`);
                });
                doc.moveDown();
            }

            // Footer
            doc.fontSize(10).text(`Report generated on ${new Date().toLocaleString()}`, { align: 'center' });

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Generate analytics data
 */
async function generateAnalytics(filter = {}) {
    const [
        totalStats,
        violationStats,
        scoreDistribution,
        riskDistribution
    ] = await Promise.all([
        // Total statistics
        Interview.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalInterviews: { $sum: 1 },
                    completedInterviews: { $sum: { $cond: [{ $eq: ['$sessionData.status', 'completed'] }, 1, 0] } },
                    averageIntegrityScore: { $avg: '$scores.integrityScore' },
                    averageDuration: { $avg: '$sessionData.duration' },
                    totalViolations: { $sum: { $size: '$violations' } }
                }
            }
        ]),

        // Violation statistics
        Interview.aggregate([
            { $match: filter },
            { $unwind: '$violations' },
            {
                $group: {
                    _id: '$violations.type',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]),

        // Score distribution
        Interview.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: {
                        $switch: {
                            branches: [
                                { case: { $gte: ['$scores.integrityScore', 90] }, then: '90-100' },
                                { case: { $gte: ['$scores.integrityScore', 80] }, then: '80-89' },
                                { case: { $gte: ['$scores.integrityScore', 70] }, then: '70-79' },
                                { case: { $gte: ['$scores.integrityScore', 60] }, then: '60-69' }
                            ],
                            default: '0-59'
                        }
                    },
                    count: { $sum: 1 }
                }
            }
        ]),

        // Risk distribution
        Interview.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$analysis.riskLevel',
                    count: { $sum: 1 }
                }
            }
        ])
    ]);

    return {
        overview: totalStats[0] || {
            totalInterviews: 0,
            completedInterviews: 0,
            averageIntegrityScore: 0,
            averageDuration: 0,
            totalViolations: 0
        },
        violations: violationStats,
        scoreDistribution,
        riskDistribution
    };
}

/**
 * Generate CSV from interview data
 */
function generateCSV(interviews) {
    const headers = [
        'Session ID',
        'Candidate Name',
        'Email',
        'Position',
        'Start Time',
        'Duration (min)',
        'Status',
        'Integrity Score',
        'Focus Score',
        'Overall Score',
        'Risk Level',
        'Recommendation',
        'Total Violations',
        'High Severity Violations',
        'Requires Review'
    ];

    const rows = interviews.map(interview => [
        interview.sessionId,
        interview.candidateInfo.name,
        interview.candidateInfo.email || '',
        interview.candidateInfo.position,
        interview.sessionData.startTime.toISOString(),
        Math.round(interview.sessionData.duration / 60),
        interview.sessionData.status,
        interview.scores.integrityScore,
        interview.scores.focusScore,
        interview.scores.overallScore,
        interview.analysis.riskLevel,
        interview.analysis.recommendation,
        interview.violations.length,
        interview.violations.filter(v => v.severity === 'high').length,
        interview.flags.requiresReview ? 'Yes' : 'No'
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

    return csvContent;
}

/**
 * Enhanced Report Generation with AI Detection Analytics
 */

/**
 * Generate comprehensive proctoring report with AI analytics
 */
router.post('/generate', async(req, res) => {
    try {
        const reportData = req.body;

        // Validate report data
        if (!reportData || !reportData.sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid report data'
            });
        }

        console.log('📊 Generating AI-enhanced proctoring report...');

        // Process AI detection statistics
        const aiStats = processAIDetectionStats(reportData.events || []);

        // Generate PDF report
        const pdfBuffer = await generateEnhancedPDFReport({
            ...reportData,
            aiStats
        });

        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="proctoring-report-${reportData.sessionId}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        res.send(pdfBuffer);

        console.log('✅ AI-enhanced report generated successfully');

    } catch (error) {
        console.error('❌ Report generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate report',
            error: error.message
        });
    }
});

/**
 * Process AI detection statistics
 */
function processAIDetectionStats(events) {
    const stats = {
        totalViolations: 0,
        aiDetections: 0,
        basicDetections: 0,
        averageConfidence: 0,
        violationsByType: {},
        confidenceDistribution: {
            high: 0, // 80-100%
            medium: 0, // 60-80%
            low: 0 // 0-60%
        },
        detectionMethods: {
            tensorflow: 0,
            mediapipe: 0,
            cocoSsd: 0,
            basic: 0
        }
    };

    let totalConfidence = 0;
    let confidenceCount = 0;

    events.forEach(event => {
        if (event.type && event.type.includes('violation')) {
            stats.totalViolations++;

            // Count violations by type
            const violationType = event.violationType || event.type || 'unknown';
            stats.violationsByType[violationType] = (stats.violationsByType[violationType] || 0) + 1;

            // Process confidence scores
            if (event.confidence !== undefined) {
                const confidence = event.confidence * 100;
                totalConfidence += confidence;
                confidenceCount++;

                if (confidence >= 80) {
                    stats.confidenceDistribution.high++;
                    stats.aiDetections++;
                } else if (confidence >= 60) {
                    stats.confidenceDistribution.medium++;
                    stats.aiDetections++;
                } else {
                    stats.confidenceDistribution.low++;
                    stats.basicDetections++;
                }
            } else {
                stats.basicDetections++;
            }

            // Detect AI method used (based on message content)
            const message = event.message || '';
            if (message.includes('AI Object Detection') || message.includes('COCO-SSD')) {
                stats.detectionMethods.cocoSsd++;
            } else if (message.includes('AI Face Detection') || message.includes('TensorFlow')) {
                stats.detectionMethods.tensorflow++;
            } else if (message.includes('AI Gaze Detection') || message.includes('MediaPipe')) {
                stats.detectionMethods.mediapipe++;
            } else {
                stats.detectionMethods.basic++;
            }
        }
    });

    // Calculate average confidence
    if (confidenceCount > 0) {
        stats.averageConfidence = Math.round(totalConfidence / confidenceCount);
    }

    return stats;
}

/**
 * Generate enhanced PDF report with AI analytics
 */
async function generateEnhancedPDFReport(reportData) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const chunks = [];

            // Collect PDF data
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));

            // Header
            doc.fontSize(24)
                .fillColor('#2c3e50')
                .text('🤖 AI-Powered Video Proctoring Report', { align: 'center' });

            doc.moveDown();

            // Session Information
            doc.fontSize(16)
                .fillColor('#34495e')
                .text('Session Information', { underline: true });

            doc.fontSize(12)
                .fillColor('#2c3e50')
                .text(`Session ID: ${reportData.sessionId}`)
                .text(`Candidate: ${reportData.candidateName || 'Unknown'}`)
                .text(`Position: ${reportData.position || 'Not specified'}`)
                .text(`Date: ${new Date(reportData.startTime).toLocaleDateString()}`)
                .text(`Duration: ${formatDuration(reportData.duration)}`)
                .text(`Final Integrity Score: ${reportData.integrityScore}/100`);

            doc.moveDown();

            // AI Detection Summary
            doc.fontSize(16)
                .fillColor('#8e44ad')
                .text('🤖 AI Detection Analytics', { underline: true });

            const aiStats = reportData.aiStats;

            doc.fontSize(12)
                .fillColor('#2c3e50')
                .text(`Total Violations Detected: ${aiStats.totalViolations}`)
                .text(`AI-Powered Detections: ${aiStats.aiDetections} (${Math.round(aiStats.aiDetections/aiStats.totalViolations*100)||0}%)`)
                .text(`Basic Detections: ${aiStats.basicDetections} (${Math.round(aiStats.basicDetections/aiStats.totalViolations*100)||0}%)`)
                .text(`Average AI Confidence: ${aiStats.averageConfidence}%`);

            doc.moveDown();

            // Detection Methods Breakdown
            doc.fontSize(14)
                .fillColor('#e74c3c')
                .text('Detection Methods Used:', { underline: true });

            doc.fontSize(11)
                .fillColor('#2c3e50')
                .text(`• TensorFlow.js Face Detection: ${aiStats.detectionMethods.tensorflow} violations`)
                .text(`• COCO-SSD Object Detection: ${aiStats.detectionMethods.cocoSsd} violations`)
                .text(`• MediaPipe Gaze Tracking: ${aiStats.detectionMethods.mediapipe} violations`)
                .text(`• Basic Detection Fallback: ${aiStats.detectionMethods.basic} violations`);

            doc.moveDown();

            // Confidence Distribution
            doc.fontSize(14)
                .fillColor('#27ae60')
                .text('AI Confidence Distribution:', { underline: true });

            doc.fontSize(11)
                .fillColor('#2c3e50')
                .text(`• High Confidence (80-100%): ${aiStats.confidenceDistribution.high} detections`)
                .text(`• Medium Confidence (60-80%): ${aiStats.confidenceDistribution.medium} detections`)
                .text(`• Low Confidence (0-60%): ${aiStats.confidenceDistribution.low} detections`);

            doc.moveDown();

            // Violations by Type
            if (Object.keys(aiStats.violationsByType).length > 0) {
                doc.fontSize(14)
                    .fillColor('#f39c12')
                    .text('Violations by Type:', { underline: true });

                Object.entries(aiStats.violationsByType).forEach(([type, count]) => {
                    const icon = getViolationIcon(type);
                    doc.fontSize(11)
                        .fillColor('#2c3e50')
                        .text(`${icon} ${type.replace('_', ' ').toUpperCase()}: ${count} incidents`);
                });

                doc.moveDown();
            }

            // Detailed Event Log
            if (reportData.events && reportData.events.length > 0) {
                doc.fontSize(16)
                    .fillColor('#34495e')
                    .text('📋 Detailed Event Log', { underline: true });

                doc.moveDown(0.5);

                reportData.events.slice(0, 20).forEach((event, index) => { // Limit to 20 events
                    const timestamp = new Date(event.timestamp).toLocaleTimeString();
                    const confidence = event.confidence ? ` (${Math.round(event.confidence * 100)}% confidence)` : '';

                    doc.fontSize(10)
                        .fillColor('#7f8c8d')
                        .text(`${timestamp} - ${event.type}: ${event.message}${confidence}`);
                });

                if (reportData.events.length > 20) {
                    doc.fontSize(10)
                        .fillColor('#95a5a6')
                        .text(`... and ${reportData.events.length - 20} more events`);
                }
            }

            // Footer
            doc.fontSize(8)
                .fillColor('#95a5a6')
                .text(`Report generated on ${new Date().toLocaleString()}`, 50, doc.page.height - 50)
                .text('Powered by AI Video Proctoring System v2.0', { align: 'right' });

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Format duration in minutes and seconds
 */
function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Get icon for violation type
 */
function getViolationIcon(type) {
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
 * Get report statistics
 */
router.get('/stats/:sessionId', async(req, res) => {
    try {
        const { sessionId } = req.params;

        // In a real implementation, you would fetch from database
        // For now, return mock statistics
        const stats = {
            sessionId,
            totalDetections: 15,
            aiDetections: 12,
            basicDetections: 3,
            averageConfidence: 87,
            topViolationType: 'mobile_phone',
            detectionAccuracy: 94
        };

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('Stats retrieval error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve statistics'
        });
    }
});

module.exports = router;