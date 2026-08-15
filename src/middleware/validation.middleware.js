// rescue-response-backend/src/middleware/validation.middleware.js
const { body, validationResult } = require('express-validator');

// ============================================
// ✅ FIXED: REGISTER VALIDATION - More Flexible
// ============================================
const validateRegister = [
    body('firstName')
        .trim()
        .notEmpty().withMessage('First name is required')
        .isLength({ min: 1, max: 50 }).withMessage('First name must be 1-50 characters'),

    body('lastName')
        .trim()
        .notEmpty().withMessage('Last name is required')
        .isLength({ min: 1, max: 50 }).withMessage('Last name must be 1-50 characters'),

    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Valid email required')
        .normalizeEmail(),

    body('phoneNumber')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .isLength({ min: 10, max: 12 }).withMessage('Phone number must be 10-12 digits'),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character (!@#$%^&*)'),

    body('role')
        .optional()
        .isIn(['civilian', 'volunteer', 'responder', 'dispatcher', 'admin'])
        .withMessage('Invalid role'),

    // Volunteer specific fields - optional
    body('birthday')
        .optional()
        .isISO8601().withMessage('Invalid date format'),

    body('yearsOfExperience')
        .optional()
        .isString().withMessage('Invalid experience format'),

    body('address1')
        .optional()
        .isString().withMessage('Invalid address format'),

    body('address2')
        .optional()
        .isString().withMessage('Invalid address format'),

    body('certifications')
        .optional(),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array().map(err => ({
                    field: err.path,
                    message: err.msg
                }))
            });
        }
        next();
    }
];

// ============================================
// LOGIN VALIDATION
// ============================================
const validateLogin = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail(),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array().map(err => ({
                    field: err.path,
                    message: err.msg
                }))
            });
        }
        next();
    }
];

module.exports = {
    validateRegister,
    validateLogin
};