// src/services/systemLog.service.js
// Centralized system activity logging for the admin System Maintenance page

const mongoose = require('mongoose');

// Safe global model definition (prevents OverwriteModelError)
const SystemLog = mongoose.models.SystemLog || mongoose.model('SystemLog', new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    type: { type: String, enum: ['INFO', 'OK', 'ERROR', 'WARNING'], default: 'INFO' },
    action: String,
    message: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}));

/**
 * Log a system activity
 * @param {string} type - 'INFO' | 'OK' | 'ERROR' | 'WARNING'
 * @param {string} action - Short label (e.g., 'USER_REGISTERED', 'LOGIN')
 * @param {string} message - Detailed description
 * @param {string|null} userId - Related user ID
 */
async function logActivity(type, action, message, userId = null) {
    try {
        const log = await SystemLog.create({ type, action, message, userId });
        console.log(`Ì≥ù [LOG] ${type} - ${action}: ${message}`);
        return log;
    } catch (error) {
        console.error('‚ùå Failed to create system log:', error.message);
        return null;
    }
}

module.exports = { logActivity, SystemLog };
