/**
 * Authentication Middleware
 * Protects routes that require authentication
 */

const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
    try {
        // Get token from header
        const token = (req.header('Authorization') || '').replace('Bearer ', '');

        // Check if no token
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No token, authorization denied'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            error: 'Token is not valid'
        });
    }
};

module.exports = auth;