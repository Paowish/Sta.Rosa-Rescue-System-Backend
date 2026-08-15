const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// src/models/User.model.js
const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['civilian', 'volunteer', 'responder', 'admin', 'dispatcher'],
    default: 'civilian'
  },
  profileImage: { type: String, default: '' },
  isApproved: { type: Boolean, default: false },
  applicationStatus: { type: String, default: 'pending' },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },

  // ✅ Volunteer/Application Fields
  yearsOfExperience: { type: String, default: '' },
  certifications: { type: Array, default: [] },
  availability: { type: Array, default: [] },
  description: { type: String, default: '' },
  address1: { type: String, default: '' },
  address2: { type: String, default: '' },
  birthday: { type: Date },
  age: { type: Number },

  // ✅ FIXED: Added `url` so the Base64 string is saved to the database
  files: [{
    name: { type: String },
    type: { type: String },
    size: { type: Number },
    url: { type: String } // <--- THIS WAS MISSING!
  }]

}, { timestamps: true });

// ============================================
// ✅ NO PRE-SAVE HOOK - Hash in controller
// ============================================

// ============================================
// COMPARE PASSWORD METHOD - Using bcrypt
// ============================================
userSchema.methods.comparePassword = function (candidatePassword) {
  return new Promise((resolve, reject) => {
    bcrypt.compare(candidatePassword, this.password, function (err, isMatch) {
      if (err) {
        return reject(err);
      }
      resolve(isMatch);
    });
  });
};

module.exports = mongoose.model('User', userSchema);