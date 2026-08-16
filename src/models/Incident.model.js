// rescue-response-backend/src/models/Incident.model.js
const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  incidentId: { type: String, default: null },
  type: {
    type: String,
    required: true,
    enum: ['Vehicle Accident', 'Fire Incident', 'Medical Emergency', 'Natural Disaster', 'Road Obstruction', 'Flooding', 'Crime Incident', 'Other']
  },
  severity: {
    type: String,
    enum: ['Critical', 'High', 'Medium', 'Low'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Pending', 'Acknowledged', 'Active', 'Dispatched', 'En Route', 'On Scene', 'Resolved', 'Closed'],
    default: 'Pending'
  },
  location: {
    address: { type: String, required: true },
    coordinates: {
      latitude: { type: Number, default: 0 },
      longitude: { type: Number, default: 0 }
    },
    barangay: { type: String, default: '' },
    city: { type: String, default: 'Sta. Rosa' },
    province: { type: String, default: 'Nueva Ecija' }
  },
  description: { type: String, required: true, maxlength: 1000 },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reportedAt: { type: Date, default: Date.now },
  reporterNumber: { type: String, default: '' },
  reporterName: { type: String, default: "Anonymous" },
  isGuest: { type: Boolean, default: false },
  victimsAffected: { type: Number, default: 0 },
  image: { type: String, default: null },
  images: [{ url: String, caption: String }],
  assignedTo: [{
    responder: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: Date,
    status: String
  }],
  assignedTeam: String,
  dispatchNotes: String,
  resolvedAt: Date,
  resolutionNotes: String,
  // ✅ Location Tracking Fields
  responderLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  responder: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'en-route', 'on-scene', 'completed'],
      default: 'pending'
    },
    locationHistory: [{
      coordinates: [Number],
      timestamp: Date
    }],
    lastUpdated: { type: Date, default: Date.now }
  }


}, { timestamps: true });

module.exports = mongoose.model('Incident', incidentSchema);