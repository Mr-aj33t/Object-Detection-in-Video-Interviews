/**
 * Interview Model
 * Stores interview session data, violations, events, and integrity scores
 */

const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['no_face', 'multiple_faces', 'focus_lost', 'unauthorized_object', 'eye_closure', 'camera_disabled', 'microphone_disabled']
    },
    message: {
        type: String,
        required: true
    },
    severity: {
        type: String,
        required: true,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    timestamp: {
        type: Date,
        required: true,
        default: Date.now
    },
    confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: 1
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
});

const eventSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['interview_started', 'interview_ended', 'violation', 'camera_disabled', 'microphone_disabled', 'system_check', 'focus_change']
    },
    message: {
        type: String,
        required: true
    },
    severity: {
        type: String,
        enum: ['info', 'warning', 'danger'],
        default: 'info'
    },
    timestamp: {
        type: Date,
        required: true,
        default: Date.now
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
});

const statisticsSchema = new mongoose.Schema({
    eventCounts: {
        focusLost: { type: Number, default: 0 },
        noFace: { type: Number, default: 0 },
        multiplefaces: { type: Number, default: 0 },
        unauthorizedObjects: { type: Number, default: 0 },
        eyeClosure: { type: Number, default: 0 }
    },
    timers: {
        focusLostTime: { type: Number, default: 0 },
        noFaceTime: { type: Number, default: 0 },
        eyeClosedTime: { type: Number, default: 0 }
    },
    detectionAccuracy: {
        faceDetectionRate: { type: Number, default: 0 },
        objectDetectionRate: { type: Number, default: 0 },
        averageConfidence: { type: Number, default: 0 }
    }
});

const interviewSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    candidateInfo: {
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            trim: true,
            lowercase: true
        },
        position: {
            type: String,
            required: true,
            trim: true
        },
        department: {
            type: String,
            trim: true
        },
        candidateId: {
            type: String,
            trim: true
        }
    },
    interviewDetails: {
        title: {
            type: String,
            default: 'Video Interview Session'
        },
        description: {
            type: String
        },
        interviewType: {
            type: String,
            enum: ['technical', 'behavioral', 'screening', 'final'],
            default: 'screening'
        },
        scheduledDuration: {
            type: Number, // in minutes
            default: 60
        }
    },
    sessionData: {
        startTime: {
            type: Date,
            required: true,
            index: true
        },
        endTime: {
            type: Date
        },
        duration: {
            type: Number, // in seconds
            default: 0
        },
        status: {
            type: String,
            enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'failed'],
            default: 'scheduled',
            index: true
        },
        browserInfo: {
            userAgent: String,
            platform: String,
            language: String
        },
        deviceInfo: {
            screenResolution: String,
            timezone: String,
            connection: String
        }
    },
    scores: {
        integrityScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 100
        },
        focusScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 100
        },
        behaviorScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 100
        },
        overallScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 100
        }
    },
    violations: [violationSchema],
    events: [eventSchema],
    statistics: {
        type: statisticsSchema,
        default: () => ({})
    },
    flags: {
        hasViolations: {
            type: Boolean,
            default: false,
            index: true
        },
        requiresReview: {
            type: Boolean,
            default: false,
            index: true
        },
        isHighRisk: {
            type: Boolean,
            default: false,
            index: true
        },
        technicalIssues: {
            type: Boolean,
            default: false
        }
    },
    analysis: {
        recommendation: {
            type: String,
            enum: ['proceed', 'review_required', 'reject', 'retake'],
            default: 'proceed'
        },
        riskLevel: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'low'
        },
        summary: {
            type: String
        },
        keyFindings: [{
            type: String
        }],
        reviewNotes: {
            type: String
        }
    },
    interviewer: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        name: {
            type: String
        },
        email: {
            type: String
        }
    },
    metadata: {
        ipAddress: String,
        userAgent: String,
        referrer: String,
        sessionToken: String,
        apiVersion: {
            type: String,
            default: '1.0'
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better query performance
interviewSchema.index({ 'candidateInfo.email': 1 });
interviewSchema.index({ 'sessionData.startTime': -1 });
interviewSchema.index({ 'scores.integrityScore': -1 });
interviewSchema.index({ 'analysis.riskLevel': 1 });
interviewSchema.index({ createdAt: -1 });

// Virtual for formatted duration
interviewSchema.virtual('formattedDuration').get(function() {
    const duration = this.sessionData.duration;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

// Virtual for violation count
interviewSchema.virtual('violationCount').get(function() {
    return this.violations.length;
});

// Virtual for high severity violations
interviewSchema.virtual('highSeverityViolations').get(function() {
    return this.violations.filter(v => v.severity === 'high').length;
});

// Pre-save middleware to update flags and analysis
interviewSchema.pre('save', function(next) {
    // Update flags based on violations and scores
    this.flags.hasViolations = this.violations.length > 0;
    this.flags.requiresReview = this.scores.integrityScore < 70 || this.violations.filter(v => v.severity === 'high').length > 0;
    this.flags.isHighRisk = this.scores.integrityScore < 50 || this.violations.filter(v => v.severity === 'high').length > 2;

    // Update overall score
    this.scores.overallScore = Math.round((this.scores.integrityScore + this.scores.focusScore + this.scores.behaviorScore) / 3);

    // Update risk level
    if (this.scores.integrityScore >= 90) {
        this.analysis.riskLevel = 'low';
        this.analysis.recommendation = 'proceed';
    } else if (this.scores.integrityScore >= 70) {
        this.analysis.riskLevel = 'medium';
        this.analysis.recommendation = 'review_required';
    } else if (this.scores.integrityScore >= 50) {
        this.analysis.riskLevel = 'high';
        this.analysis.recommendation = 'review_required';
    } else {
        this.analysis.riskLevel = 'critical';
        this.analysis.recommendation = 'reject';
    }

    // Generate summary
    this.analysis.summary = this.generateSummary();

    next();
});

// Method to generate analysis summary
interviewSchema.methods.generateSummary = function() {
    const violationCount = this.violations.length;
    const integrityScore = this.scores.integrityScore;
    const duration = Math.round(this.sessionData.duration / 60); // in minutes

    let summary = `Interview completed in ${duration} minutes with integrity score of ${integrityScore}%.`;

    if (violationCount === 0) {
        summary += ' No violations detected.';
    } else if (violationCount === 1) {
        summary += ' 1 violation detected.';
    } else {
        summary += ` ${violationCount} violations detected.`;
    }

    const highSeverityCount = this.violations.filter(v => v.severity === 'high').length;
    if (highSeverityCount > 0) {
        summary += ` ${highSeverityCount} high-severity violations require attention.`;
    }

    return summary;
};

// Method to add violation
interviewSchema.methods.addViolation = function(violationData) {
    this.violations.push(violationData);

    // Recalculate integrity score
    this.scores.integrityScore = Math.max(0, this.scores.integrityScore - this.getViolationPenalty(violationData.type));

    return this.save();
};

// Method to get violation penalty
interviewSchema.methods.getViolationPenalty = function(violationType) {
    const penalties = {
        'no_face': 20,
        'multiple_faces': 15,
        'focus_lost': 5,
        'unauthorized_object': 10,
        'eye_closure': 2,
        'camera_disabled': 15,
        'microphone_disabled': 10
    };

    return penalties[violationType] || 5;
};

// Method to add event
interviewSchema.methods.addEvent = function(eventData) {
    this.events.push(eventData);
    return this.save();
};

// Static method to get interviews by date range
interviewSchema.statics.getByDateRange = function(startDate, endDate) {
    return this.find({
        'sessionData.startTime': {
            $gte: startDate,
            $lte: endDate
        }
    }).sort({ 'sessionData.startTime': -1 });
};

// Static method to get high-risk interviews
interviewSchema.statics.getHighRisk = function() {
    return this.find({
        'flags.isHighRisk': true
    }).sort({ 'sessionData.startTime': -1 });
};

// Static method to get interviews requiring review
interviewSchema.statics.getRequiringReview = function() {
    return this.find({
        'flags.requiresReview': true,
        'sessionData.status': 'completed'
    }).sort({ 'sessionData.startTime': -1 });
};

// Static method to get statistics
interviewSchema.statics.getStatistics = async function(dateRange = null) {
    const matchStage = dateRange ? {
        'sessionData.startTime': {
            $gte: dateRange.start,
            $lte: dateRange.end
        }
    } : {};

    const stats = await this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalInterviews: { $sum: 1 },
                completedInterviews: {
                    $sum: { $cond: [{ $eq: ['$sessionData.status', 'completed'] }, 1, 0] }
                },
                averageIntegrityScore: { $avg: '$scores.integrityScore' },
                averageDuration: { $avg: '$sessionData.duration' },
                totalViolations: { $sum: { $size: '$violations' } },
                highRiskCount: {
                    $sum: { $cond: ['$flags.isHighRisk', 1, 0] }
                },
                requiresReviewCount: {
                    $sum: { $cond: ['$flags.requiresReview', 1, 0] }
                }
            }
        }
    ]);

    return stats[0] || {
        totalInterviews: 0,
        completedInterviews: 0,
        averageIntegrityScore: 0,
        averageDuration: 0,
        totalViolations: 0,
        highRiskCount: 0,
        requiresReviewCount: 0
    };
};

module.exports = mongoose.model('Interview', interviewSchema);