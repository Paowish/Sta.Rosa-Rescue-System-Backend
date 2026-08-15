const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

// ============================================
// JWT AUTHENTICATION (Your existing code)
// ============================================
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ success: false, message: 'User not found' });
            }

            if (!req.user.isActive) {
                return res.status(401).json({ success: false, message: 'Account is deactivated' });
            }

            next();
        } catch (error) {
            return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. ${req.user.role} role is not authorized`
            });
        }
        next();
    };
};

// ============================================
// SESSION MANAGEMENT (ADD THIS)
// ============================================

// Require authentication for protected routes (alias for protect)
const requireAuth = protect;

// Role-based access control (alias for authorize)
const requireRole = (...roles) => authorize(...roles);

// Get session info (for frontend session timeout feature)
const getSessionInfo = (req) => {
    if (!req.user) {
        return null;
    }
    return {
        userId: req.user._id,
        userType: req.user.role,
        userEmail: req.user.email
    };
};

module.exports = {
    protect,
    authorize,
    requireAuth,   // ADDED
    requireRole,   // ADDED
    getSessionInfo // ADDED
};