const xss = require('xss');

// ============================================
// SIMPLIFIED DATA SANITIZATION - NO express-mongo-sanitize
// ============================================

// Simple NoSQL injection protection (manual)
const noSqlSanitizer = (req, res, next) => {
    const sanitizeNoSQL = (obj) => {
        if (!obj) return obj;

        const result = Array.isArray(obj) ? [] : {};

        for (const [key, value] of Object.entries(obj)) {
            // Check for MongoDB operators ($ne, $gt, $regex, etc.)
            if (typeof key === 'string' && key.startsWith('$')) {
                console.warn(`[SECURITY] NoSQL injection attempt detected: ${key}`);
                // Skip this field or replace it
                continue;
            }

            if (typeof value === 'object' && value !== null) {
                result[key] = sanitizeNoSQL(value);
            } else {
                result[key] = value;
            }
        }
        return result;
    };

    if (req.body) {
        req.body = sanitizeNoSQL(req.body);
    }
    if (req.query) {
        req.query = sanitizeNoSQL(req.query);
    }
    if (req.params) {
        req.params = sanitizeNoSQL(req.params);
    }

    next();
};

// XSS Protection
const xssSanitizer = (req, res, next) => {
    const sanitizeXSS = (obj) => {
        if (!obj) return obj;

        const result = Array.isArray(obj) ? [] : {};

        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                result[key] = xss(value, {
                    whiteList: {},
                    stripIgnoreTag: true,
                    stripIgnoreTagBody: ['script', 'style', 'iframe']
                });
            } else if (typeof value === 'object' && value !== null) {
                result[key] = sanitizeXSS(value);
            } else {
                result[key] = value;
            }
        }
        return result;
    };

    if (req.body) {
        req.body = sanitizeXSS(req.body);
    }
    if (req.query) {
        req.query = sanitizeXSS(req.query);
    }
    if (req.params) {
        req.params = sanitizeXSS(req.params);
    }

    next();
};

module.exports = { noSqlSanitizer, xssSanitizer };