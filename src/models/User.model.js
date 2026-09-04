// rescue-response-backend/src/models/User.model.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, default: '' },
  password: { type: String, required: false },
  googleId: { type: String, default: null },
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

  // ✅ OTP VERIFICATION FIELDS
  otpCode: { type: String },
  otpExpires: { type: Date },
  otpAttempts: { type: Number, default: 0 },

  // ✅ Volunteer/Application Fields
  yearsOfExperience: { type: String, default: '' },
  certifications: { type: Array, default: [] },
  availability: { type: Array, default: [] },
  description: { type: String, default: '' },
  address1: { type: String, default: '' },
  address2: { type: String, default: '' },
  birthday: { type: Date },
  age: { type: Number },

  files: [{
    name: { type: String },
    type: { type: String },
    size: { type: Number },
    url: { type: String }
  }],

  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  isOnDuty: { type: Boolean, default: true },
  availabilityStatus: { type: String, default: 'on-duty' }

}, { timestamps: true });

userSchema.methods.comparePassword = function (candidatePassword) {
  return new Promise((resolve, reject) => {
    bcrypt.compare(candidatePassword, this.password, function (err, isMatch) {
      if (err) return reject(err);
      resolve(isMatch);
    });
  });
};

module.exports = mongoose.model('User', userSchema);