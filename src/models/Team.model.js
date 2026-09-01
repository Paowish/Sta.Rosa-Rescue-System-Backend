const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    role: { type: String, required: true },
    teamLeader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    volunteerId: { type: String, required: true, unique: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    specialties: [{ type: String }],
    schedule: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);