// models/Settings.js
const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    general: {
        systemName: { type: String, default: 'A CROSS-PLATFORM WEB SYSTEM SUPPORTING COMMUNITY INCIDENT REPORTING AND GEOLOCATION-DRIVEN EMERGENCY RESPONSE FOR MUNICIPAL RESCUE UNIT' },
        region: { type: String, default: 'Central Luzon — Region III' },
        timezone: { type: String, default: 'Asia/Manila (UTC+8)' },
        dateFormat: { type: String, default: 'MM / DD / YYYY' }
    },
    security: {
        sessionTimeout: { type: Number, default: 30 },
        maxLoginAttempts: { type: Number, default: 5 },
        passwordMinLength: { type: Number, default: 14 },
        twoFactorAuth: { type: Boolean, default: false }
    },
    notifications: {
        dailySummary: { type: Boolean, default: false },
        systemErrors: { type: Boolean, default: false },
        adminEmail: { type: String, default: 'admin@rescue.gov.ph' },
        adminNumber: { type: String, default: '+63 912-345-6789' }
    }
}, { timestamps: true });

module.exports = mongoose.model('Settings', SettingsSchema);