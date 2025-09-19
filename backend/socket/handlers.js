/**
 * Socket.IO Event Handlers
 * Handles real-time communication for video proctoring
 */

const Interview = require('../models/Interview');

class SocketHandlers {
    constructor() {
        this.activeInterviews = new Map(); // sessionId -> socket.id
        this.interviewerSockets = new Map(); // interviewerId -> socket.id
    }

    setupHandlers(socket, io) {
        console.log(`Setting up handlers for socket: ${socket.id}`);

        // Interview session events
        socket.on('join-interview', (data) => this.handleJoinInterview(socket, io, data));
        socket.on('leave-interview', (data) => this.handleLeaveInterview(socket, io, data));
        socket.on('interview-started', (data) => this.handleInterviewStarted(socket, io, data));
        socket.on('interview-ended', (data) => this.handleInterviewEnded(socket, io, data));

        // Violation and event handling
        socket.on('violation-detected', (data) => this.handleViolationDetected(socket, io, data));
        socket.on('event-logged', (data) => this.handleEventLogged(socket, io, data));

        // Real-time monitoring
        socket.on('detection-update', (data) => this.handleDetectionUpdate(socket, io, data));
        socket.on('score-update', (data) => this.handleScoreUpdate(socket, io, data));

        // Interviewer events
        socket.on('join-as-interviewer', (data) => this.handleJoinAsInterviewer(socket, io, data));
        socket.on('interviewer-message', (data) => this.handleInterviewerMessage(socket, io, data));
        socket.on('request-candidate-attention', (data) => this.handleRequestAttention(socket, io, data));

        // System events
        socket.on('system-check', (data) => this.handleSystemCheck(socket, io, data));
        socket.on('technical-issue', (data) => this.handleTechnicalIssue(socket, io, data));

        // Disconnect handling
        socket.on('disconnect', () => this.handleDisconnect(socket, io));
    }

    /**
     * Handle candidate joining an interview
     */
    async handleJoinInterview(socket, io, data) {
        try {
            const { sessionId, candidateInfo } = data;

            if (!sessionId) {
                socket.emit('error', { message: 'Session ID is required' });
                return;
            }

            // Find the interview
            const interview = await Interview.findOne({ sessionId });
            if (!interview) {
                socket.emit('error', { message: 'Interview not found' });
                return;
            }

            // Join the interview room
            socket.join(`interview_${sessionId}`);
            this.activeInterviews.set(sessionId, socket.id);

            // Update candidate info if provided
            if (candidateInfo) {
                Object.assign(interview.candidateInfo, candidateInfo);
                await interview.save();
            }

            socket.emit('interview-joined', {
                sessionId,
                interview: interview.toObject()
            });

            // Notify interviewers
            socket.to(`interviewer_${sessionId}`).emit('candidate-joined', {
                sessionId,
                candidateInfo: interview.candidateInfo,
                timestamp: new Date()
            });

            console.log(`Candidate joined interview: ${sessionId}`);

        } catch (error) {
            console.error('Error handling join interview:', error);
            socket.emit('error', { message: 'Failed to join interview' });
        }
    }

    /**
     * Handle candidate leaving an interview
     */
    async handleLeaveInterview(socket, io, data) {
        try {
            const { sessionId } = data;

            socket.leave(`interview_${sessionId}`);
            this.activeInterviews.delete(sessionId);

            // Notify interviewers
            socket.to(`interviewer_${sessionId}`).emit('candidate-left', {
                sessionId,
                timestamp: new Date()
            });

            console.log(`Candidate left interview: ${sessionId}`);

        } catch (error) {
            console.error('Error handling leave interview:', error);
        }
    }

    /**
     * Handle interview started event
     */
    async handleInterviewStarted(socket, io, data) {
        try {
            const { sessionId, candidateName } = data;

            // Update interview status
            const interview = await Interview.findOne({ sessionId });
            if (interview) {
                interview.sessionData.status = 'in_progress';
                interview.sessionData.startTime = new Date();
                await interview.save();
            }

            // Broadcast to all connected clients in the interview room
            io.to(`interview_${sessionId}`).emit('interview-status-changed', {
                sessionId,
                status: 'in_progress',
                startTime: new Date(),
                candidateName
            });

            // Notify interviewers
            io.to(`interviewer_${sessionId}`).emit('interview-started-notification', {
                sessionId,
                candidateName,
                timestamp: new Date()
            });

            console.log(`Interview started: ${sessionId}`);

        } catch (error) {
            console.error('Error handling interview started:', error);
        }
    }

    /**
     * Handle interview ended event
     */
    async handleInterviewEnded(socket, io, data) {
        try {
            const { sessionId, sessionData } = data;

            // Update interview in database
            const interview = await Interview.findOne({ sessionId });
            if (interview) {
                interview.sessionData.status = 'completed';
                interview.sessionData.endTime = new Date();

                if (sessionData) {
                    Object.assign(interview, sessionData);
                }

                await interview.save();
            }

            // Broadcast to all connected clients
            io.to(`interview_${sessionId}`).emit('interview-ended', {
                sessionId,
                endTime: new Date(),
                finalData: interview ? interview.toObject() : null
            });

            // Notify interviewers
            io.to(`interviewer_${sessionId}`).emit('interview-completed', {
                sessionId,
                interview: interview ? interview.toObject() : null,
                timestamp: new Date()
            });

            console.log(`Interview ended: ${sessionId}`);

        } catch (error) {
            console.error('Error handling interview ended:', error);
        }
    }

    /**
     * Handle violation detected event
     */
    async handleViolationDetected(socket, io, data) {
        try {
            const { sessionId, violation } = data;

            // Save violation to database
            const interview = await Interview.findOne({ sessionId });
            if (interview) {
                await interview.addViolation(violation);
            }

            // Broadcast violation to interviewers immediately
            io.to(`interviewer_${sessionId}`).emit('violation-alert', {
                sessionId,
                violation,
                timestamp: new Date(),
                integrityScore: interview ? interview.scores.integrityScore : null
            });

            // Send acknowledgment to candidate
            socket.emit('violation-logged', {
                violationType: violation.type,
                timestamp: new Date()
            });

            console.log(`Violation detected in ${sessionId}:`, violation.type);

        } catch (error) {
            console.error('Error handling violation:', error);
        }
    }

    /**
     * Handle event logged
     */
    async handleEventLogged(socket, io, data) {
        try {
            const { sessionId, event } = data;

            // Save event to database
            const interview = await Interview.findOne({ sessionId });
            if (interview) {
                await interview.addEvent(event);
            }

            // Broadcast to interviewers if it's a significant event
            if (event.severity === 'warning' || event.severity === 'danger') {
                io.to(`interviewer_${sessionId}`).emit('event-notification', {
                    sessionId,
                    event,
                    timestamp: new Date()
                });
            }

        } catch (error) {
            console.error('Error handling event:', error);
        }
    }

    /**
     * Handle real-time detection updates
     */
    handleDetectionUpdate(socket, io, data) {
        try {
            const { sessionId, detections } = data;

            // Broadcast detection updates to interviewers
            socket.to(`interviewer_${sessionId}`).emit('detection-update', {
                sessionId,
                detections,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('Error handling detection update:', error);
        }
    }

    /**
     * Handle score updates
     */
    async handleScoreUpdate(socket, io, data) {
        try {
            const { sessionId, scores } = data;

            // Update scores in database
            const interview = await Interview.findOne({ sessionId });
            if (interview) {
                Object.assign(interview.scores, scores);
                await interview.save();
            }

            // Broadcast to interviewers
            io.to(`interviewer_${sessionId}`).emit('score-update', {
                sessionId,
                scores,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('Error handling score update:', error);
        }
    }

    /**
     * Handle interviewer joining
     */
    handleJoinAsInterviewer(socket, io, data) {
        try {
            const { sessionId, interviewerId, interviewerInfo } = data;

            // Join interviewer room
            socket.join(`interviewer_${sessionId}`);
            this.interviewerSockets.set(interviewerId, socket.id);

            socket.emit('interviewer-joined', {
                sessionId,
                message: 'Successfully joined as interviewer'
            });

            console.log(`Interviewer ${interviewerId} joined session: ${sessionId}`);

        } catch (error) {
            console.error('Error handling interviewer join:', error);
        }
    }

    /**
     * Handle interviewer messages to candidate
     */
    handleInterviewerMessage(socket, io, data) {
        try {
            const { sessionId, message, interviewerName } = data;

            // Send message to candidate
            socket.to(`interview_${sessionId}`).emit('interviewer-message', {
                message,
                interviewerName,
                timestamp: new Date()
            });

            console.log(`Interviewer message sent to ${sessionId}: ${message}`);

        } catch (error) {
            console.error('Error handling interviewer message:', error);
        }
    }

    /**
     * Handle request for candidate attention
     */
    handleRequestAttention(socket, io, data) {
        try {
            const { sessionId, message } = data;

            // Send attention request to candidate
            socket.to(`interview_${sessionId}`).emit('attention-request', {
                message: message || 'Please pay attention to the camera',
                timestamp: new Date()
            });

            console.log(`Attention requested for session: ${sessionId}`);

        } catch (error) {
            console.error('Error handling attention request:', error);
        }
    }

    /**
     * Handle system check events
     */
    handleSystemCheck(socket, io, data) {
        try {
            const { sessionId, checkResults } = data;

            // Broadcast system check results
            socket.to(`interviewer_${sessionId}`).emit('system-check-results', {
                sessionId,
                checkResults,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('Error handling system check:', error);
        }
    }

    /**
     * Handle technical issues
     */
    async handleTechnicalIssue(socket, io, data) {
        try {
            const { sessionId, issue } = data;

            // Log technical issue
            const interview = await Interview.findOne({ sessionId });
            if (interview) {
                interview.flags.technicalIssues = true;
                await interview.addEvent({
                    id: `tech_issue_${Date.now()}`,
                    type: 'system_check',
                    message: `Technical issue: ${issue.description}`,
                    severity: 'warning',
                    timestamp: new Date(),
                    metadata: issue
                });
            }

            // Notify interviewers
            io.to(`interviewer_${sessionId}`).emit('technical-issue', {
                sessionId,
                issue,
                timestamp: new Date()
            });

            console.log(`Technical issue reported for ${sessionId}:`, issue);

        } catch (error) {
            console.error('Error handling technical issue:', error);
        }
    }

    /**
     * Handle socket disconnection
     */
    handleDisconnect(socket, io) {
        try {
            // Clean up active interviews
            for (const [sessionId, socketId] of this.activeInterviews.entries()) {
                if (socketId === socket.id) {
                    this.activeInterviews.delete(sessionId);

                    // Notify interviewers of candidate disconnect
                    socket.to(`interviewer_${sessionId}`).emit('candidate-disconnected', {
                        sessionId,
                        timestamp: new Date()
                    });

                    console.log(`Candidate disconnected from interview: ${sessionId}`);
                    break;
                }
            }

            // Clean up interviewer sockets
            for (const [interviewerId, socketId] of this.interviewerSockets.entries()) {
                if (socketId === socket.id) {
                    this.interviewerSockets.delete(interviewerId);
                    console.log(`Interviewer disconnected: ${interviewerId}`);
                    break;
                }
            }

        } catch (error) {
            console.error('Error handling disconnect:', error);
        }
    }

    /**
     * Get active interviews count
     */
    getActiveInterviewsCount() {
        return this.activeInterviews.size;
    }

    /**
     * Get connected interviewers count
     */
    getConnectedInterviewersCount() {
        return this.interviewerSockets.size;
    }
}

// Create singleton instance
const socketHandlers = new SocketHandlers();

module.exports = socketHandlers;