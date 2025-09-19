/**
 * Authentication Routes
 * Basic authentication for demo purposes
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

// Simple in-memory user store for demo (in production, use a proper database)
const users = [{
        id: 1,
        email: 'admin@videoproctoring.com',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.Uy6Nz6', // password: admin123
        role: 'admin',
        name: 'System Administrator'
    },
    {
        id: 2,
        email: 'interviewer@videoproctoring.com',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.Uy6Nz6', // password: admin123
        role: 'interviewer',
        name: 'Interview Manager'
    }
];

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
 * @route   POST /api/v1/auth/login
 * @desc    Login user and return JWT token
 * @access  Public
 */
router.post('/login', [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], handleValidationErrors, async(req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = users.find(u => u.email === email);
        if (!user) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            name: user.name
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        });

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    name: user.name
                }
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Server error during login',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register new user (demo purposes)
 * @access  Public
 */
router.post('/register', [
    body('name').notEmpty().trim().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['admin', 'interviewer']).withMessage('Invalid role')
], handleValidationErrors, async(req, res) => {
    try {
        const { name, email, password, role = 'interviewer' } = req.body;

        // Check if user already exists
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
            return res.status(400).json({
                error: 'User already exists with this email'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const newUser = {
            id: users.length + 1,
            name,
            email,
            password: hashedPassword,
            role
        };

        users.push(newUser);

        // Generate JWT token
        const payload = {
            userId: newUser.id,
            email: newUser.email,
            role: newUser.role,
            name: newUser.name
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        });

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                token,
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    role: newUser.role,
                    name: newUser.name
                }
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            error: 'Server error during registration',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user info
 * @access  Private
 */
router.get('/me', require('../middleware/auth'), (req, res) => {
    try {
        const user = users.find(u => u.id === req.user.userId);

        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            error: 'Server error',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh JWT token
 * @access  Private
 */
router.post('/refresh', require('../middleware/auth'), (req, res) => {
    try {
        const user = users.find(u => u.id === req.user.userId);

        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        // Generate new token
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            name: user.name
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        });

        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                token
            }
        });

    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({
            error: 'Server error during token refresh',
            message: error.message
        });
    }
});

module.exports = router;