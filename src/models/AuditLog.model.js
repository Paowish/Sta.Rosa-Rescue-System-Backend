const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    action: {
        type: String,
        required: true,
        enum: ['CREATE', 'UPDATE', 'DELETE', 'VIEW', 'ASSIGN', 'RESOLVE', 'LOGIN', 'LOGOUT']
    },
    entity: {
        type: String,
        required: true,
        enum: ['INCIDENT', 'USER', 'VOLUNTEER', 'RESPONSE', 'NOTIFICATION']
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId
    },
    changes: {
        type: mongoose.Schema.Types.Mixed
    },
    ipAddress: String,
    userAgent: String,
    location: {
        latitude: Number,
        longitude: Number
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1, action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);