/**
 * Main Express Server for Video Proctoring System
 * Handles API endpoints, real-time communication, and data storage
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import routes
const interviewRoutes = require('./routes/interviews');
const reportRoutes = require('./routes/reports');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');

// Import socket handlers
const socketHandlers = require('./socket/handlers');

// Create Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
    cors: {
        origin: process.env.SOCKET_CORS_ORIGIN || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Global middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    }
}));

app.use(compression());
app.use(morgan('combined'));

// CORS configuration
const corsOptions = {
    origin: function(origin, callback) {
        const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: require('./package.json').version
    });
});

// API routes
const apiPrefix = process.env.API_PREFIX || '/api/v1';

app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/interviews`, interviewRoutes);
app.use(`${apiPrefix}/reports`, reportRoutes);
app.use(`${apiPrefix}/dashboard`, dashboardRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend')));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    });
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Set up socket event handlers
    socketHandlers.setupHandlers(socket, io);

    socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        message: `The requested route ${req.originalUrl} does not exist.`
    });
});

// Database connection
const connectDB = async() => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/video_proctoring';

        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('✅ MongoDB connected successfully');

        // Create indexes for better performance
        await createIndexes();

    } catch (error) {
        console.warn('⚠️ MongoDB connection failed, running in demo mode:', error.message);
        console.log('📝 Note: Some features may be limited without database');
        // Continue without database for demo purposes
    }
};

// Create database indexes
const createIndexes = async() => {
    try {
        const Interview = require('./models/Interview');
        const Event = require('./models/Event');

        // Create indexes for better query performance
        await Interview.createIndexes();
        await Event.createIndexes();

        console.log('✅ Database indexes created successfully');
    } catch (error) {
        console.error('❌ Error creating indexes:', error);
    }
};

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    server.close(() => {
        console.log('HTTP server closed');

        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });

    // Force close after 30 seconds
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async() => {
    try {
        // Connect to database first
        await connectDB();

        // Start the server with error handling
        server.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 API Base URL: http://localhost:${PORT}${apiPrefix}`);
            console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
            console.log(`📡 Socket.IO enabled on port ${PORT}`);
        }).on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`⚠️ Port ${PORT} is busy, trying port ${PORT + 1}...`);
                server.listen(PORT + 1, () => {
                    console.log(`🚀 Server running on port ${PORT + 1}`);
                    console.log(`🔗 API Base URL: http://localhost:${PORT + 1}${apiPrefix}`);
                });
            } else {
                console.error('❌ Server error:', err);
            }
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        console.log('🔧 Try running: npm install');
    }
};

// Start the server
startServer();

// Export for testing
module.exports = { app, server, io };