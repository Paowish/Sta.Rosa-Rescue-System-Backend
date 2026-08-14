const mongoose = require('mongoose');

const emergencyResponseSchema = new mongoose.Schema({
    incidentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Incident',
        required: true
    },

    // Response Timeline
    acknowledgmentTime: Date,
    dispatchTime: Date,
    arrivalTime: Date,
    resolutionTime: Date,

    // Responders Assigned
    responders: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        role: String,
        assignedAt: Date,
        arrivedAt: Date,
        departedAt: Date
    }],

    // Resources Deployed
    resources: [{
        type: {
            type: String,
            enum: ['Ambulance', 'Fire Truck', 'Rescue Vehicle', 'Police', 'Other']
        },
        quantity: Number,
        vehicleNumber: String
    }],

    // Real-time Updates
    updates: [{
        message: String,
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        location: {
            latitude: Number,
            longitude: Number
        }
    }],

    // Status
    status: {
        type: String,
        enum: ['Pending', 'Dispatched', 'On Scene', 'Resolving', 'Closed'],
        default: 'Pending'
    },

    // Feedback
    civilianFeedback: {
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        comment: String,
        submittedAt: Date
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('EmergencyResponse', emergencyResponseSchema);