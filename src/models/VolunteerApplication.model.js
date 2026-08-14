// rescue-response-backend/src/models/VolunteerApplication.model.js
const mongoose = require('mongoose');

const volunteerApplicationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    phoneNumber: { type: String, required: true },
    birthday: { type: Date },
    age: { type: Number },
    yearsOfExperience: { type: String, default: '' },
    address1: { type: String, default: '' },
    address2: { type: String, default: '' },
    certifications: { type: [String], default: [] },
    files: { type: [mongoose.Schema.Types.Mixed], default: [] },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'closed'],
        default: 'pending'
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewNotes: { type: String, default: '' },
    reviewedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.VolunteerApplication || mongoose.model('VolunteerApplication', volunteerApplicationSchema);