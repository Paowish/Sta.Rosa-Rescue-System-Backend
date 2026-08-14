const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const { noSqlSanitizer, xssSanitizer } = require('./src/middleware/sanitize.middleware');
// Add this with your other imports
const { sendVolunteerAccepted, sendVolunteerRejected } = require('./src/services/email.service');

// FORCE DNS OVERRIDE FOR LOCAL DEVELOPMENT
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require('dotenv').config();

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');


const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// ✅ HARDCODE YOUR CLOUDINARY CREDENTIALS HERE
cloudinary.config({
  cloud_name: 'nvvaydmz',      // ← Replace with your Cloudinary cloud name
  api_key: '158414443953793',            // ← Replace with your Cloudinary API key
  api_secret: 'vC7Bmv3Qn31dazyOiB1lCTqZ7bo'       // ← Replace with your Cloudinary API secret
});




// ============================================
// CREATE APP FIRST (MOVED UP)
// ============================================
const app = express();



const VolunteerApplication = require('./src/models/VolunteerApplication.model');
const Incident = require('./src/models/Incident.model');  // ✅ ADD THIS
const Notification = require('./src/models/Notification.model'); // ✅ ADD THIS
const volunteerRoutes = require('./src/routes/volunteer.routes');

app.use('/api/volunteers', volunteerRoutes);

app.set('trust proxy', true);

// Global rate limiter
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 1000,                   // 100 requests per IP
  message: 'Too many requests, please try again later.',
  validate: { trustProxy: false }
}));


const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:5173", "http://192.168.1.36:5173", "https://*.ngrok-free.dev"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Make io accessible to routes
app.set('io', io);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`✅ User ${userId} joined room: user_${userId}`);
  });

  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`✅ Socket ${socket.id} joined room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });

  // In server.js, inside io.on('connection', (socket) => { ... })

  // ✅ Handle volunteer location updates
  socket.on('volunteer-location', async (data) => {
    console.log('📍 Volunteer location received:', data);

    try {
      const { volunteerId, volunteerName, incidentId, location, status } = data;

      if (incidentId && location) {
        // Update incident with responder location
        const incident = await Incident.findById(incidentId);
        if (incident) {
          // Update responder location
          incident.responderLocation = {
            type: 'Point',
            coordinates: [location.lng, location.lat],
            updatedAt: new Date()
          };

          // Update responder info
          incident.responder = {
            id: volunteerId,
            name: volunteerName || 'Volunteer',
            status: status || 'en-route',
            locationHistory: [
              ...(incident.responder?.locationHistory || []),
              {
                coordinates: [location.lng, location.lat],
                timestamp: new Date()
              }
            ],
            lastUpdated: new Date()
          };

          // Update incident status if not already set
          if (incident.status !== 'En Route') {
            incident.status = 'En Route';
          }

          await incident.save();
          console.log(`✅ Updated incident ${incidentId} with volunteer location`);
        }

        // Broadcast to all clients in the incident room
        socket.to(`incident_${incidentId}`).emit('volunteer-location-update', {
          volunteerId: volunteerId,
          volunteerName: volunteerName || 'Volunteer',
          location: location,
          status: status || 'en-route',
          timestamp: new Date().toISOString()
        });

        // Also broadcast to all connected clients (civilians, dispatchers)
        socket.broadcast.emit('volunteer-location-update', {
          volunteerId: volunteerId,
          volunteerName: volunteerName || 'Volunteer',
          location: location,
          incidentId: incidentId,
          status: status || 'en-route',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('❌ Error updating location:', error);
    }
  });

  // ✅ Join incident room
  socket.on('join-incident', (incidentId) => {
    socket.join(`incident_${incidentId}`);
    console.log(`✅ Socket ${socket.id} joined incident room: ${incidentId}`);
  });

  // ✅ Leave incident room
  socket.on('leave-incident', (incidentId) => {
    socket.leave(`incident_${incidentId}`);
    console.log(`✅ Socket ${socket.id} left incident room: ${incidentId}`);
  });
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// Middleware
// ----------------- CORS CONFIGURATION -----------------
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://192.168.1.36:5173',
  'https://sta-rosa-nueva-ecija-emergency-response.vercel.app',
  'https://sta-rosa-rescue-system-frontend-git-main-paowish.vercel.app',
  /\.vercel\.app$/,      // Matches ALL Vercel preview deployments
  /\.ngrok-free\.dev$/   // Matches all ngrok URLs
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if the origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(origin);
      }
      return pattern === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// app.options('*', cors());
// https://theater-preaching-truth.ngrok-free.dev/api/auth
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// DATA SANITIZATION MIDDLEWARE (ADD THIS)
// ============================================
app.use(noSqlSanitizer);  // Prevents NoSQL injection
app.use(xssSanitizer);     // Prevents XSS attacks


// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rescue-response-system';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => console.error('❌ MongoDB error:', err.message));

// ==================== USER SCHEMA ====================
// ✅ User model is imported from separate file
const User = require('./src/models/User.model');

// ============================================
// IMPORT AUTH ROUTES (WITH VALIDATION) - ✅ UNCOMMENTED
// ============================================
const authRoutes = require('./src/routes/auth.routes');
app.use('/api/auth', authRoutes);

// ==================== INCIDENT SCHEMA - ✅ UNCOMMENTED ====================
// const IncidentSchema = new mongoose.Schema({
//   incidentId: { type: String, unique: true },
//   type: { type: String, required: true },
//   severity: { type: String, default: 'Medium' },
//   status: { type: String, default: 'Pending' },
//   location: {
//     address: String,
//     coordinates: { latitude: Number, longitude: Number },
//     barangay: String
//   },
//   description: { type: String, required: true },
//   reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   reportedAt: { type: Date, default: Date.now },
//   reporterNumber: { type: String, default: '' },
//   reporterName: { type: String, default: "Anonymous" },
//   victimsAffected: { type: Number, default: 0 },
//   image: { type: String, default: null },
//   assignedTo: [{
//     responder: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//     assignedAt: Date,
//     status: String
//   }],
//   assignedTeam: String,
//   dispatchNotes: String,
//   resolvedAt: Date,
//   resolutionNotes: String
// }, { timestamps: true });

// IncidentSchema.pre('save', async function () {
//   if (!this.incidentId) {
//     const count = await Incident.countDocuments();
//     this.incidentId = `RES-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
//   }
// });

// const Incident = mongoose.model('Incident', IncidentSchema);

// ==================== VOLUNTEER SCHEMA ====================
// const VolunteerSchema = new mongoose.Schema({
//   firstName: String,
//   lastName: String,
//   email: String,
//   phoneNumber: String,
//   age: Number,
//   birthday: Date,
//   yearsOfExperience: String,
//   address1: String,
//   address2: String,
//   certifications: [String],
//   files: [{
//     name: { type: String },
//     type: { type: String },
//     size: { type: Number },
//     data: { type: String }
//   }],
//   status: { type: String, default: 'pending' }
// }, { timestamps: true });

// const VolunteerApplication = mongoose.model('VolunteerApplication', VolunteerSchema);

// ==================== NOTIFICATION SCHEMA ====================
// const NotificationSchema = new mongoose.Schema({
//   recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   type: { type: String, enum: ['incident_update', 'emergency_alert', 'volunteer_status', 'response_assignment', 'system_announcement', 'new_incident'], required: true },
//   title: { type: String, required: true },
//   message: { type: String, required: true },
//   data: { type: Object },
//   isRead: { type: Boolean, default: false },
//   readAt: Date,
//   createdAt: { type: Date, default: Date.now }
// });

// const Notification = mongoose.model('Notification', NotificationSchema);

// Helper function to create notification and emit via socket
async function createNotification(recipientId, type, title, message, data = {}) {
  try {
    const notification = new Notification({
      recipient: recipientId,
      type,
      title,
      message,
      data
    });
    await notification.save();

    io.to(`user_${recipientId}`).emit('new_notification', {
      _id: notification._id,
      type,
      title,
      message,
      createdAt: notification.createdAt,
      isRead: false,
      ...data
    });

    console.log(`📢 Notification sent to ${recipientId}: ${title}`);
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}









// ==================== JWT TOKEN ====================
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'mysecretkey', { expiresIn: '7d' });
};

// Replace the protect middleware

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      req.user.id = req.user._id;
      return next();
    } catch (error) {
      console.error("❌ Auth error:", error.message);
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
  }
  return res.status(401).json({ success: false, message: 'Not authorized, no token' });
};

// In your server.js, add this endpoint
app.get('/api/volunteer/active-dispatch', protect, async (req, res) => {
  try {
    const volunteerId = req.user.id;

    // Find any active incident where this volunteer is assigned and status is not resolved
    const activeIncident = await Incident.findOne({
      'assignedTo.responder': volunteerId,
      status: { $in: ['Pending', 'Acknowledged', 'Active', 'En Route', 'Dispatched'] }
    }).populate('reportedBy', 'firstName lastName email phoneNumber');

    if (activeIncident) {
      // Format the incident data
      const lat = activeIncident.location?.coordinates?.latitude ||
        activeIncident.location?.coordinates?.lat || 15.428991;
      const lng = activeIncident.location?.coordinates?.longitude ||
        activeIncident.location?.coordinates?.lng || 120.938698;

      const formattedIncident = {
        id: activeIncident.incidentId || activeIncident._id,
        _id: activeIncident._id,
        title: activeIncident.type || 'Untitled Incident',
        location: activeIncident.location?.address || 'Unknown location',
        shortLocation: activeIncident.location?.address?.split(',')[0] || 'Unknown',
        date: new Date(activeIncident.reportedAt || activeIncident.createdAt).toLocaleString(),
        status: activeIncident.status?.toLowerCase() || 'pending',
        priority: activeIncident.severity || 'Medium',
        description: activeIncident.description || 'No description provided',
        reporter: activeIncident.reporterName || 'Anonymous',
        reporterPhone: activeIncident.reporterNumber || 'N/A',
        coordinates: [parseFloat(lat), parseFloat(lng)],
        victims: activeIncident.victimsAffected || 0,
        image: activeIncident.image || null,
        dispatchNotes: activeIncident.dispatchNotes || null,
        assignedTo: activeIncident.assignedTo || [],
        isActiveDispatch: true
      };

      return res.json({
        success: true,
        data: formattedIncident,
        isEnRoute: activeIncident.status === 'En Route' || activeIncident.status === 'Dispatched'
      });
    }

    res.json({
      success: true,
      data: null,
      isEnRoute: false
    });
  } catch (error) {
    console.error('Error getting active dispatch:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Multer for registration form data (for volunteer applications)
// Increase multer limits for file uploads
const registrationUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    fieldSize: 10 * 1024 * 1024
  }
});

// ==================== AUTH ROUTES ====================


// rescue-response-backend/server.js




// ============================================================
// ✅ VOLUNTEER DISPATCH ROUTES - ADD THIS SECTION HERE!
// ============================================================

// Volunteer accepts dispatch
// app.put('/api/incidents/:id/accept', protect, async (req, res) => {
//   try {
//     const incidentId = req.params.id;
//     const { volunteerId } = req.body;

//     console.log(`🔵 Accepting dispatch for incident ${incidentId} by volunteer ${volunteerId}`);

//     const incident = await Incident.findById(incidentId);
//     if (!incident) {
//       return res.status(404).json({ success: false, message: 'Incident not found' });
//     }

//     // Update incident status
//     incident.status = 'En Route';
//     incident.responder = {
//       id: volunteerId,
//       name: req.user.firstName + ' ' + req.user.lastName,
//       phoneNumber: req.user.phoneNumber,
//       status: 'accepted',
//       lastUpdated: new Date()
//     };

//     await incident.save();

//     console.log(`✅ Incident ${incidentId} accepted by ${req.user.firstName} ${req.user.lastName}`);

//     const io = req.app.get('io');
//     io.to(`incident_${incidentId}`).emit('incident-updated', {
//       incidentId: incidentId,
//       status: 'En Route',
//       responder: incident.responder
//     });

//     res.json({
//       success: true,
//       message: 'Dispatch accepted',
//       data: incident
//     });
//   } catch (error) {
//     console.error('❌ Accept error:', error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// Volunteer declines dispatch
app.put('/api/incidents/:id/decline', protect, async (req, res) => {
  try {
    const incidentId = req.params.id;

    console.log(`🔵 Declining dispatch for incident ${incidentId}`);

    const incident = await Incident.findById(incidentId);
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    incident.responder = {
      id: null,
      name: '',
      phoneNumber: '',
      status: 'pending',
      lastUpdated: new Date()
    };

    await incident.save();

    res.json({
      success: true,
      message: 'Dispatch declined'
    });
  } catch (error) {
    console.error('❌ Decline error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get responder location
app.get('/api/incidents/:id/responder-location', protect, async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .select('responderLocation responder status incidentId');

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    res.json({
      success: true,
      data: {
        incidentId: incident.incidentId,
        status: incident.status,
        responder: incident.responder,
        location: incident.responderLocation
      }
    });
  } catch (error) {
    console.error('❌ Location error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== AUTH ROUTES ====================

// app.post('/api/auth/register', registrationUpload.any(), async (req, res) => {
//   try {
//     console.log('🔵 Registration request received');
//     console.log('🔵 Body:', req.body);
//     console.log('🔵 Files:', req.files);

//     // Extract fields from request body
//     const firstName = req.body.firstName;
//     const lastName = req.body.lastName;
//     const email = req.body.email;
//     const phoneNumber = req.body.phoneNumber;
//     const password = req.body.password;
//     const role = req.body.role;
//     const birthday = req.body.birthday;
//     const yearsOfExperience = req.body.yearsOfExperience;
//     const address1 = req.body.address1;
//     const address2 = req.body.address2;

//     // Parse certifications if it's a string
//     let certifications = [];
//     if (req.body.certifications) {
//       try {
//         certifications = JSON.parse(req.body.certifications);
//       } catch {
//         certifications = req.body.certifications;
//       }
//     }

//     // Parse files if they exist
//     let files = [];
//     if (req.body.files) {
//       try {
//         files = JSON.parse(req.body.files);
//       } catch {
//         files = [];
//       }
//     }

//     console.log('📝 Registration attempt:', email, 'Role:', role);
//     console.log('📎 Files received:', files.length);

//     const userExists = await User.findOne({ email });
//     if (userExists) {
//       return res.status(400).json({ success: false, message: 'User already exists' });
//     }

//     // Calculate age
//     const calculateAge = (birthdayDate) => {
//       if (!birthdayDate) return 0;
//       const today = new Date();
//       const birthDate = new Date(birthdayDate);
//       let age = today.getFullYear() - birthDate.getFullYear();
//       const monthDiff = today.getMonth() - birthDate.getMonth();
//       if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
//         age--;
//       }
//       return age;
//     };

//     // Create USER account
//     const user = new User({
//       firstName,
//       lastName,
//       email,
//       phoneNumber,
//       password,
//       role: role || 'civilian',
//       profileImage: '',
//       isApproved: role === 'volunteer' ? false : true,
//       applicationStatus: role === 'volunteer' ? 'pending' : 'approved'
//     });

//     await user.save();
//     console.log('✅ User created:', email);

//     // If volunteer, create APPLICATION
//     if (role === 'volunteer') {
//       // Process files
//       let processedFiles = [];
//       if (files && Array.isArray(files) && files.length > 0) {
//         processedFiles = files.map(file => ({
//           name: file.name || '',
//           type: file.type || '',
//           size: file.size || 0,
//           data: file.data || ''
//         }));
//       }

//       const application = new VolunteerApplication({
//         firstName,
//         lastName,
//         email,
//         phoneNumber,
//         age: calculateAge(birthday),
//         birthday: birthday,
//         yearsOfExperience: yearsOfExperience,
//         address1: address1,
//         address2: address2,
//         certifications: certifications || [],
//         files: processedFiles,
//         status: 'pending',
//         userId: user._id
//       });
//       await application.save();
//       console.log('📝 Volunteer application created for:', email, `with ${processedFiles.length} files`);






// ✅ Register route with FormData support
// app.post('/api/auth/register', registrationUpload.any(), async (req, res) => {
//   try {
//     console.log('🔵 FormData registration received');
//     console.log('🔵 Body:', req.body);
//     console.log('🔵 Files:', req.files?.length || 0);

//     // Call the controller
//     const { register } = require('./src/controllers/auth.controller');
//     await register(req, res);
//   } catch (error) {
//     console.error('❌ Registration error:', error);
//     res.status(500).json({
//       success: false,
//       message: error.message || 'Registration failed'
//     });
//   }
// });

// ✅ Keep this for other auth routes

app.use('/api/auth', authRoutes);

// In your server.js or routes file
app.get('/api/users/responders', protect, async (req, res) => {
  try {
    const responders = await User.find({
      role: 'responder',
      isActive: true,
      isApproved: true
    }).select('-password');

    res.json({
      success: true,
      data: responders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});



// ==================== FILE UPLOAD ====================
// Keep this for other file uploads (if needed)
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Keep the local storage for other uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.use('/uploads', express.static('uploads'));

// ==================== PROFILE IMAGE UPLOAD WITH CLOUDINARY ====================
// ✅ NEW: Profile image upload using Cloudinary
const profileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'), false);
    }
  }
});

app.post('/api/auth/upload-profile-image', protect, profileUpload.single('profileImage'), async (req, res) => {
  try {
    console.log('📸 Profile image upload request received');
    console.log('📸 User ID:', req.user.id);

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    console.log('📸 File received:', req.file.originalname);
    console.log('📸 File size:', req.file.size);

    // ✅ Upload to Cloudinary in the 'profiles' folder
    const result = await cloudinary.uploader.upload(
      `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
      {
        folder: 'profiles',
        public_id: `profile-${req.user.id}-${Date.now()}`,
        transformation: [
          { width: 400, height: 400, crop: 'fill', quality: 'auto' }
        ]
      }
    );

    console.log('✅ Cloudinary upload successful:', result.secure_url);

    // ✅ Update user's profile image in MongoDB with Cloudinary URL
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profileImage: result.secure_url },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('✅ Profile image updated for user:', user.email);

    res.json({
      success: true,
      message: 'Profile photo updated successfully',
      imagePath: result.secure_url,
      profileImage: user.profileImage,
      imageUrl: result.secure_url
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload photo'
    });
  }
});
// ==================== INCIDENT ROUTES ====================

// rescue-response-backend/server.js
// Add/Replace these sections

// ==================== INCIDENT ROUTES ====================

// ✅ Cloudinary Storage for incident images
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'incidents',
    format: async (req, file) => 'jpg',
    public_id: (req, file) => `incident-${Date.now()}`
  }
});

const incidentUpload = multer({
  storage: cloudinaryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// server.js - Update your incident POST route
app.post('/api/incidents', protect, incidentUpload.single('photo'), async (req, res) => {
  try {
    console.log("🔵 ===== INCIDENT POST START =====");
    console.log("🔵 User ID:", req.user?.id);
    console.log("🔵 Has file:", !!req.file);

    let imageUrl = null;
    if (req.file) {
      imageUrl = req.file.path;
      console.log("📸 Cloudinary URL:", imageUrl);
    }

    // Parse location
    let location = req.body.location;
    if (typeof location === 'string') {
      try {
        location = JSON.parse(location);
      } catch (e) {
        location = { address: location };
      }
    }

    if (!location || typeof location !== 'object') {
      location = { address: 'Unknown location' };
    }
    if (!location.address) {
      location.address = 'Unknown location';
    }
    if (!location.coordinates) {
      location.coordinates = { latitude: 0, longitude: 0 };
    }

    // Generate incident ID
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const incidentId = `RES-${year}-${timestamp}${random}`;
    console.log(`✅ Generated incident ID: ${incidentId}`);

    // Build incident data
    const incidentData = {
      incidentId: incidentId,
      type: req.body.type || 'Other',
      description: req.body.description || '',
      location: location,
      severity: req.body.severity || 'Medium',
      reportedBy: req.user.id,
      reporterNumber: req.body.reporterNumber || '',
      reporterName: req.body.reporterName || 'Anonymous',
      victimsAffected: parseInt(req.body.victimsAffected) || 0,
      image: imageUrl,
      status: 'Pending'
    };

    console.log("📝 Incident data:", JSON.stringify(incidentData, null, 2));

    // Create incident
    const incident = await Incident.create(incidentData);
    console.log("✅ Incident created with ID:", incident.incidentId);

    // ✅ Send notifications in the background (don't await)
    // This way if notifications fail, the incident is still created
    Promise.resolve().then(async () => {
      try {
        // Notify reporter
        await createNotification(
          req.user.id,
          'incident_update',
          'Incident Reported',
          `Your incident ${incident.incidentId} has been reported successfully.`,
          { incidentId: incident._id, status: incident.status }
        );

        // Notify responders
        const responders = await User.find({
          role: { $in: ['admin', 'dispatcher', 'responder'] },
          isActive: true
        });

        console.log(`📢 Sending notifications to ${responders.length} responders`);

        for (const responder of responders) {
          await createNotification(
            responder._id,
            'new_incident',
            `🚨 New ${incident.severity} Incident`,
            `${incident.type} reported at ${incident.location.address}`,
            {
              incidentId: incident._id,
              type: incident.type,
              severity: incident.severity,
              location: incident.location.address
            }
          );
        }
      } catch (notifError) {
        console.error('❌ Background notification error:', notifError.message);
        // Don't fail the request
      }
    });

    // ✅ Send response immediately
    res.status(201).json({
      success: true,
      data: {
        ...incident.toObject(),
        id: incident._id,
        incidentId: incident.incidentId
      },
      message: 'Incident reported successfully'
    });
  } catch (error) {
    console.error("❌ Incident creation error:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create incident'
    });
  }
});



// ==================== DISPATCH INCIDENT TO VOLUNTEERS ====================
// ==================== DISPATCH INCIDENT TO VOLUNTEERS ====================
app.post('/api/incidents/:id/dispatch', protect, async (req, res) => {
  try {
    const { volunteerIds, dispatchNotes } = req.body;
    const incidentId = req.params.id;

    console.log(`📋 Dispatching incident ${incidentId} to volunteers:`, volunteerIds);

    const incident = await Incident.findById(incidentId);
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    if (incident.status === 'Resolved' || incident.status === 'Closed') {
      return res.status(400).json({ success: false, message: 'This incident is already resolved or closed' });
    }

    if (incident.status === 'En Route' || incident.status === 'On Scene') {
      return res.status(400).json({ success: false, message: 'This incident has already been accepted by a volunteer' });
    }

    const existingAssigned = incident.assignedTo || [];
    const existingVolunteerIds = existingAssigned.map(a => a.responder.toString());

    const alreadyAssigned = volunteerIds.filter(id => existingVolunteerIds.includes(id.toString()));

    if (alreadyAssigned.length > 0) {
      const assignedVolunteers = await User.find({ _id: { $in: alreadyAssigned } }).select('firstName lastName');
      const names = assignedVolunteers.map(v => `${v.firstName} ${v.lastName}`).join(', ');
      return res.status(400).json({ success: false, message: `The following volunteers are already assigned: ${names}`, alreadyAssigned });
    }

    const busyVolunteers = [];
    for (const volunteerId of volunteerIds) {
      const otherIncident = await Incident.findOne({
        _id: { $ne: incidentId },
        'assignedTo.responder': volunteerId,
        status: { $in: ['Pending', 'Acknowledged', 'Active', 'En Route', 'On Scene'] }
      });

      if (otherIncident) {
        const volunteer = await User.findById(volunteerId);
        busyVolunteers.push({ id: volunteerId, name: `${volunteer.firstName} ${volunteer.lastName}`, incidentId: otherIncident.incidentId });
      }
    }

    if (busyVolunteers.length > 0) {
      const names = busyVolunteers.map(v => `${v.name} (Incident ${v.incidentId})`).join(', ');
      return res.status(400).json({ success: false, message: `The following volunteers are already assigned to other active incidents: ${names}`, busyVolunteers });
    }

    // ✅ All validations passed - proceed with dispatch
    const newAssignments = volunteerIds.map(id => ({ responder: id, assignedAt: new Date(), status: 'Pending' }));
    incident.assignedTo = [...incident.assignedTo, ...newAssignments];
    incident.status = 'Pending';
    incident.dispatchNotes = dispatchNotes || 'Dispatched to volunteers';
    await incident.save();

    console.log(`✅ Incident ${incident.incidentId} updated with assignedTo:`, incident.assignedTo);

    const volunteers = await User.find({ _id: { $in: volunteerIds }, role: 'volunteer', isActive: true, isApproved: true });

    console.log(`📢 Found ${volunteers.length} volunteers to notify`);

    const io = req.app.get('io');

    // ==========================================================
    // ✅ IMPORT SERVICES AND MODELS
    // ==========================================================
    const { sendEmergencyPush, sendEmailAlert } = require('./src/services/alert.service');
    const PushSubscription = require('./src/models/PushSubscription.model');
    const nodemailer = require('nodemailer'); // ✅ FIX: Import nodemailer to avoid "not defined" errors!

    // ==========================================================
    // 🚨 1. NOTIFY VOLUNTEERS (Siren + Email)
    // ==========================================================
    for (const volunteer of volunteers) {
      // In-App Dashboard Notification
      const notification = await Notification.create({
        recipient: volunteer._id,
        type: 'response_assignment',
        title: '🚨 New Dispatch Assignment',
        message: `You have been dispatched to ${incident.type} at ${incident.location.address}`,
        data: { incidentId: incident._id, incidentType: incident.type, location: incident.location.address, severity: incident.severity, dispatchNotes }
      });

      io.to(`user_${volunteer._id}`).emit('new_notification', {
        _id: notification._id,
        type: 'response_assignment',
        title: '🚨 New Dispatch Assignment',
        message: `You have been dispatched to ${incident.type} at ${incident.location.address}`,
        data: { incidentId: incident._id, incidentType: incident.type, location: incident.location.address, severity: incident.severity },
        createdAt: notification.createdAt
      });

      console.log(`📢 In-app notification sent to volunteer: ${volunteer.email}`);

      const subscription = await PushSubscription.findOne({ userId: volunteer._id });
      if (subscription) {
        await sendEmergencyPush(subscription, `${volunteer.firstName} ${volunteer.lastName}`, {
          incidentId: incident.incidentId,
          severity: incident.severity,
          address: incident.location.address
        });
      }

      if (volunteer.email) {
        await sendEmailAlert(volunteer.email, `${volunteer.firstName} ${volunteer.lastName}`, {
          incidentId: incident.incidentId,
          type: incident.type,
          severity: incident.severity,
          address: incident.location.address
        });
      }
    }

    // ==========================================================
    // 📢 2. NOTIFY THE CIVILIAN (Bell Notification + Email)
    // ==========================================================
    const civilian = await User.findById(incident.reportedBy);

    if (civilian) {
      // 1. In-App Dashboard Notification for Civilian
      const civilianNotif = await Notification.create({
        recipient: civilian._id,
        type: 'incident_update',
        title: '✅ Dispatch Update',
        message: `A volunteer has been dispatched to your "${incident.type}" report at ${incident.location.address}. Check the Track Reports page.`,
        data: { incidentId: incident._id, status: 'Dispatched' }
      });

      io.to(`user_${civilian._id}`).emit('new_notification', {
        _id: civilianNotif._id,
        type: 'incident_update',
        title: '✅ Dispatch Update',
        message: `A volunteer has been dispatched to your "${incident.type}" report.`,
        data: { incidentId: incident._id, status: 'Dispatched' },
        createdAt: civilianNotif.createdAt
      });

      console.log(`📢 In-app notification sent to civilian: ${civilian.email}`);

      // 2. Send Email Backup to Civilian (Reusing nodemailer transporter directly)
      if (civilian.email) {
        const civilianEmailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
              <div style="background-color: #1976d2; color: white; padding: 20px; text-align: center;">
                  <h1 style="margin: 0;">✅ Dispatch Update</h1>
                  <p>Your reported incident has been dispatched to a volunteer.</p>
              </div>
              <div style="padding: 20px;">
                  <p>Dear <strong>${civilian.firstName} ${civilian.lastName}</strong>,</p>
                  <p>Good news! A volunteer has been assigned to your reported incident.</p>
                  <h3>Incident Details:</h3>
                  <p><strong>ID:</strong> ${incident.incidentId}</p>
                  <p><strong>Type:</strong> ${incident.type}</p>
                  <p><strong>Status:</strong> Dispatched</p>
                  <p><strong>Location:</strong> ${incident.location.address}</p>
                  <div style="text-align: center; margin-top: 20px;">
                      <a href="${process.env.FRONTEND_URL}/track-reports" style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Track Your Report</a>
                  </div>
              </div>
          </div>
        `;

        // ✅ FIX: Create the transporter inside the dispatch function
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });

        await transporter.sendMail({
          from: `"Rescue System" <${process.env.EMAIL_USER}>`,
          to: civilian.email,
          subject: `✅ Dispatch Update: ${incident.incidentId}`,
          html: civilianEmailHtml
        });

        console.log(`📧 Email sent to civilian: ${civilian.email}`);
      }
    }

    // ==========================================================
    // 📢 3. NOTIFY RESCUE TEAM
    // ==========================================================
    const rescueTeam = await User.find({ role: { $in: ['admin', 'dispatcher', 'responder'] }, isActive: true });
    for (const member of rescueTeam) {
      io.to(`user_${member._id}`).emit('new_notification', {
        type: 'dispatch_update',
        title: '📋 Dispatch Update',
        message: `Incident ${incident.incidentId} has been dispatched to ${volunteers.length} volunteer(s)`,
        data: { incidentId: incident._id, volunteerCount: volunteers.length }
      });
    }

    // ==========================================================
    // ✅ 4. SEND FINAL RESPONSE
    // ==========================================================
    const updatedIncident = await Incident.findById(incidentId)
      .populate('reportedBy', 'firstName lastName email')
      .populate('assignedTo.responder', 'firstName lastName email');

    res.json({
      success: true,
      message: `Incident dispatched to ${volunteers.length} volunteer(s)`,
      data: { incident: updatedIncident, volunteersDispatched: volunteers.length }
    });

  } catch (error) {
    console.error('Dispatch error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to dispatch incident' });
  }
});

// ==================== REMOVE VOLUNTEER FROM INCIDENT ====================
app.delete('/api/incidents/:id/volunteer/:volunteerId', protect, async (req, res) => {
  try {
    const { id, volunteerId } = req.params;

    // Only admin/dispatcher/responder can remove volunteers
    if (!['admin', 'dispatcher', 'responder'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to remove volunteers from incidents'
      });
    }

    const incident = await Incident.findById(id);
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    // Remove the volunteer from assignedTo array
    incident.assignedTo = incident.assignedTo.filter(
      assignment => assignment.responder.toString() !== volunteerId
    );

    // If no volunteers left, update status back to Pending
    if (incident.assignedTo.length === 0) {
      incident.status = 'Pending';
    }

    await incident.save();

    // Notify the volunteer
    await createNotification(
      volunteerId,
      'incident_update',
      'Dispatch Cancelled',
      `You have been removed from incident ${incident.incidentId}`,
      { incidentId: incident._id, status: 'Removed' }
    );

    res.json({
      success: true,
      message: 'Volunteer removed from incident successfully',
      data: incident
    });
  } catch (error) {
    console.error('Remove volunteer error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== GET AVAILABLE VOLUNTEERS ====================
app.get('/api/volunteers/available', protect, async (req, res) => {
  try {
    const volunteers = await User.find({
      role: 'volunteer',
      isActive: true,
      isApproved: true
    }).select('firstName lastName email phoneNumber profileImage');

    res.json({
      success: true,
      data: volunteers
    });
  } catch (error) {
    console.error('Error fetching volunteers:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// server.js - Update the Get Incidents route
// server.js - Get Incidents route with proper filtering for nested assignedTo
app.get('/api/incidents', protect, async (req, res) => {
  try {
    let incidents;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`🔍 Getting incidents for ${userRole} (${userId})`);

    if (userRole === 'civilian') {
      // Civilians: only see their own reported incidents
      incidents = await Incident.find({ reportedBy: userId })
        .populate('reportedBy', 'firstName lastName email')
        .sort({ createdAt: -1 });
    } else if (userRole === 'volunteer') {
      // ✅ Volunteers: query the nested assignedTo.responder field
      incidents = await Incident.find({
        'assignedTo.responder': userId
      })
        .populate('reportedBy', 'firstName lastName email')
        .populate('assignedTo.responder', 'firstName lastName email')
        .sort({ createdAt: -1 });

      console.log(`📋 Found ${incidents.length} incidents assigned to volunteer ${userId}`);
    } else if (['admin', 'dispatcher', 'responder'].includes(userRole)) {
      // Rescue team: see all incidents
      incidents = await Incident.find({
        $and: [
          { incidentId: { $exists: true, $ne: null } },
          { type: { $exists: true, $ne: null } }
        ]
      })
        .populate('reportedBy', 'firstName lastName email')
        .populate('assignedTo.responder', 'firstName lastName email')
        .sort({ createdAt: -1 });
    }

    // ✅ Format incidents safely
    const formattedIncidents = incidents.map(inc => {
      const obj = inc.toObject();
      // Ensure assignedTo is always an array
      if (!obj.assignedTo || !Array.isArray(obj.assignedTo)) {
        obj.assignedTo = [];
      }
      return {
        ...obj,
        id: obj._id,
        incidentId: obj.incidentId || 'N/A'
      };
    });

    console.log(`👤 ${userRole} (${userId}) viewing ${formattedIncidents.length} incidents`);
    res.json({ success: true, data: formattedIncidents });
  } catch (error) {
    console.error('Get incidents error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// server.js - Get incidents for a specific volunteer
app.get('/api/incidents/volunteer/:volunteerId', protect, async (req, res) => {
  try {
    const { volunteerId } = req.params;

    // ✅ Verify the requesting user is the volunteer or admin
    if (req.user.id !== volunteerId && !['admin', 'dispatcher', 'responder'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // ✅ Query using the nested structure
    const incidents = await Incident.find({
      'assignedTo.responder': volunteerId
    })
      .populate('reportedBy', 'firstName lastName email')
      .populate('assignedTo.responder', 'firstName lastName email')
      .sort({ createdAt: -1 });

    const formattedIncidents = incidents.map(inc => {
      const obj = inc.toObject();
      if (!obj.assignedTo || !Array.isArray(obj.assignedTo)) {
        obj.assignedTo = [];
      }
      return {
        ...obj,
        id: obj._id,
        incidentId: obj.incidentId || 'N/A'
      };
    });

    console.log(`📋 Volunteer ${volunteerId} viewing ${formattedIncidents.length} assigned incidents`);
    res.json({ success: true, data: formattedIncidents });
  } catch (error) {
    console.error('Get volunteer incidents error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// server.js - Add/Update this route after your other incident routes
// Get incident by ID (with permission check) - UPDATED
app.get('/api/incidents/:id', protect, async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .populate('reportedBy', 'firstName lastName email phoneNumber');

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    // Check if civilian is trying to access someone else's incident
    if (req.user.role === 'civilian' && incident.reportedBy._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this incident'
      });
    }

    // ✅ Convert to object and ensure incidentId is included
    const incidentData = incident.toObject();

    res.json({
      success: true,
      data: {
        ...incidentData,
        id: incidentData._id,
        incidentId: incidentData.incidentId || 'N/A'
      }
    });
  } catch (error) {
    console.error('Get incident error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/incidents/:id/resolve', protect, async (req, res) => {
  try {
    const { resolutionNotes } = req.body;
    const incident = await Incident.findByIdAndUpdate(
      req.params.id,
      {
        status: 'Resolved',
        resolvedAt: new Date(),
        resolutionNotes: resolutionNotes || 'Incident resolved by responder'
      },
      { new: true }
    );
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }
    await createNotification(
      incident.reportedBy,
      'incident_update',
      'Incident Resolved',
      `Your incident ${incident.incidentId} has been marked as resolved.`,
      { incidentId: incident._id, status: 'Resolved' }
    );
    res.json({ success: true, message: 'Incident resolved successfully', data: incident });
  } catch (error) {
    console.error('Resolve incident error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/incidents/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const incident = await Incident.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }
    res.json({ success: true, message: 'Incident status updated', data: incident });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/incidents/:id/accept', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { volunteerId, responderName } = req.body;
    const userId = req.user.id;

    console.log('📥 Accept incident request:', { id, volunteerId, responderName, userId });

    const volunteerIdToUse = volunteerId || userId;

    let responderNameToSave = responderName;
    if (!responderNameToSave) {
      const volunteer = await User.findById(volunteerIdToUse);
      if (volunteer) {
        responderNameToSave = `${volunteer.firstName} ${volunteer.lastName}`.trim() || 'Volunteer';
      } else {
        responderNameToSave = 'Volunteer';
      }
    }

    const incident = await Incident.findById(id);
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    // ✅ Check if already accepted by this volunteer
    const alreadyAccepted = incident.assignedTo && incident.assignedTo.some(
      a => a.responder && a.responder.toString() === volunteerIdToUse.toString()
    );

    // ✅ If already accepted by this volunteer, update the status
    if (alreadyAccepted) {
      console.log('✅ Volunteer already accepted this incident, updating status');

      const updatedIncident = await Incident.findByIdAndUpdate(
        id,
        {
          status: 'En Route',
          responderName: responderNameToSave,
          responder: {
            id: volunteerIdToUse,
            name: responderNameToSave,
            phoneNumber: req.user.phoneNumber || '',
            status: 'accepted',
            lastUpdated: new Date()
          },
          'assignedTo.0.status': 'En Route',
          dispatchNotes: `Accepted by ${responderNameToSave}`,
          updatedAt: new Date()
        },
        { new: true }
      );

      return res.json({
        success: true,
        message: 'Incident accepted successfully',
        data: updatedIncident
      });
    }

    // ✅ If En Route or On Scene by another volunteer, reject
    if (incident.status === 'En Route' || incident.status === 'On Scene') {
      if (incident.responder && incident.responder.id) {
        return res.status(400).json({
          success: false,
          message: 'Already accepted by another volunteer'
        });
      }
    }

    // ✅ If Resolved or Closed, reject
    if (incident.status === 'Resolved' || incident.status === 'Closed') {
      return res.status(400).json({
        success: false,
        message: 'Incident already resolved'
      });
    }

    // ✅ Update incident to En Route
    const updatedIncident = await Incident.findByIdAndUpdate(
      id,
      {
        status: 'En Route',
        responderName: responderNameToSave,
        responder: {
          id: volunteerIdToUse,
          name: responderNameToSave,
          phoneNumber: req.user.phoneNumber || '',
          status: 'accepted',
          lastUpdated: new Date()
        },
        $push: {
          assignedTo: {
            responder: volunteerIdToUse,
            name: responderNameToSave,
            assignedAt: new Date(),
            status: 'En Route'
          }
        },
        dispatchNotes: `Accepted by ${responderNameToSave}`,
        updatedAt: new Date()
      },
      { new: true }
    );

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.emit('incident_status_update', {
        incidentId: incident._id,
        status: 'En Route',
        responderName: responderNameToSave,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Incident accepted successfully',
      data: updatedIncident
    });
  } catch (error) {
    console.error('❌ Error accepting incident:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// server.js - Update the assign endpoint
// app.put('/api/incidents/:id/assign', protect, async (req, res) => {
//   try {
//     const { responderIds, teamName, dispatchNotes } = req.body;

//     // ✅ Simple update with ObjectIds
//     const incident = await Incident.findByIdAndUpdate(
//       req.params.id,
//       {
//         assignedTo: responderIds || [], // Simple array of ObjectIds
//         assignedTeam: teamName || '',
//         dispatchNotes: dispatchNotes || '',
//         status: 'Acknowledged'
//       },
//       { new: true }
//     );

//     if (!incident) {
//       return res.status(404).json({ success: false, message: 'Incident not found' });
//     }

//     res.json({
//       success: true,
//       message: 'Responders assigned successfully',
//       data: incident
//     });
//   } catch (error) {
//     console.error('Assign error:', error);
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// });

// ==================== VOLUNTEER ROUTES ====================

app.get('/api/volunteers/applications', protect, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = {};
    if (status) query.status = status;

    const applications = await VolunteerApplication.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await VolunteerApplication.countDocuments(query);

    res.json({
      success: true,
      data: applications,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== VOLUNTEER APPROVAL ROUTES ====================

app.get('/api/admin/pending-volunteers', protect, async (req, res) => {
  try {
    const allowedRoles = ['admin', 'dispatcher', 'responder'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Rescue team access required' });
    }

    const pendingVolunteers = await User.find({
      role: 'volunteer',
      isApproved: false,
      applicationStatus: 'pending'
    }).select('-password');

    const applications = await VolunteerApplication.find({
      status: 'pending'
    }).sort({ createdAt: -1 });

    const volunteersWithApps = pendingVolunteers.map(volunteer => {
      const application = applications.find(app => app.email === volunteer.email);
      return {
        ...volunteer.toObject(),
        application: application ? {
          ...application.toObject(),
          files: application.files || []
        } : null
      };
    });

    res.json({ success: true, data: volunteersWithApps });
  } catch (error) {
    console.error('Error getting pending volunteers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/admin/approve-volunteer/:userId', protect, async (req, res) => {
  try {
    // 🔥 ADD THIS DEBUG LOG
    console.log('🔐 EMAIL_USER:', process.env.EMAIL_USER);
    console.log('🔐 EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Set' : '❌ Not Set');
    console.log('🔐 EMAIL_PASS length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0);

    const allowedRoles = ['admin', 'dispatcher', 'responder'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Rescue team access required' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      {
        isApproved: true,
        applicationStatus: 'approved',
        isActive: true
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log(`🔵 User found: ${user.email} (${user.firstName} ${user.lastName})`);

    // Update VolunteerApplication
    await VolunteerApplication.findOneAndUpdate(
      { userId: user._id },
      { status: 'accepted' }
    );

    // Create notification
    await createNotification(
      user._id,
      'volunteer_status',
      'Volunteer Application Approved',
      `Congratulations ${user.firstName}! Your volunteer application has been approved.`,
      { userId: user._id, status: 'approved', approvedBy: req.user._id }
    );

    // ✅ SEND EMAIL
    try {
      console.log(`📧 Attempting to send email to: ${user.email}`);
      const { sendVolunteerAccepted } = require('./src/services/email.service');
      const result = await sendVolunteerAccepted(user.email, user.firstName, user.lastName);
      console.log('📧 Email send result:', result);
    } catch (emailError) {
      console.error('❌ Email error:', emailError);
    }

    res.json({
      success: true,
      message: 'Volunteer approved successfully',
      data: user
    });
  } catch (error) {
    console.error('❌ Approval error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add this to your backend routes
app.post('/api/incidents/:incidentId/update-location', protect, async (req, res) => {
  try {
    const { incidentId } = req.params;
    const { lat, lng, volunteerName } = req.body;

    console.log('📍 Updating location for incident:', incidentId);
    console.log('📍 Location:', lat, lng);
    console.log('📍 Volunteer:', volunteerName);

    // Update incident with responder location
    const incident = await Incident.findByIdAndUpdate(
      incidentId,
      {
        $set: {
          'responderLocation.coordinates': [lng, lat],
          'responderLocation.updatedAt': new Date(),
          'responder.name': volunteerName || 'Responder',
          'responder.lastUpdated': new Date(),
          status: 'En Route'
        }
      },
      { new: true }
    );

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    // Also update the responder's location history
    await Incident.findByIdAndUpdate(
      incidentId,
      {
        $push: {
          'responder.locationHistory': {
            coordinates: [lng, lat],
            timestamp: new Date()
          }
        }
      }
    );

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: incident
    });

  } catch (error) {
    console.error('❌ Location update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
// Test email route
app.get('/api/test-email', async (req, res) => {
  try {
    const { sendVolunteerAccepted } = require('./src/services/email.service');
    await sendVolunteerAccepted('your-email@gmail.com', 'Test', 'User');
    res.json({ success: true, message: 'Test email sent! Check your inbox.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// server.js - Reject volunteer
app.put('/api/admin/reject-volunteer/:userId', protect, async (req, res) => {
  try {
    const allowedRoles = ['admin', 'dispatcher', 'responder'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Rescue team access required' });
    }

    const { reason } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      {
        isApproved: false,
        applicationStatus: 'rejected',
        isActive: false
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log(`🔵 User found: ${user.email} (${user.firstName} ${user.lastName})`);

    // Update VolunteerApplication
    await VolunteerApplication.findOneAndUpdate(
      { userId: user._id },
      { status: 'rejected' }
    );

    // Create notification
    await createNotification(
      user._id,
      'volunteer_status',
      'Volunteer Application Update',
      `Your volunteer application has been reviewed. Status: REJECTED. ${reason || 'Application does not meet requirements'}`,
      { userId: user._id, status: 'rejected', rejectedBy: req.user._id }
    );

    // ✅ SEND EMAIL
    try {
      console.log(`📧 Attempting to send rejection email to: ${user.email}`);
      const result = await sendVolunteerRejected(user.email, user.firstName, user.lastName, reason);
      console.log('📧 Email send result:', result);
    } catch (emailError) {
      console.error('❌ Email error:', emailError);
    }

    res.json({
      success: true,
      message: 'Volunteer rejected',
      data: user
    });
  } catch (error) {
    console.error('❌ Rejection error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/volunteers/applications/:id', protect, async (req, res) => {
  try {
    const application = await VolunteerApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/volunteers/apply', async (req, res) => {
  try {
    const application = new VolunteerApplication(req.body);
    await application.save();
    res.status(201).json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/volunteers/applications/:id/review', protect, async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;
    const application = await VolunteerApplication.findByIdAndUpdate(
      req.params.id,
      { status, reviewNotes, reviewedBy: req.user.id, reviewedAt: new Date() },
      { new: true }
    );
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    const user = await User.findOne({ email: application.email });
    if (user) {
      if (status === 'accepted') {
        await createNotification(user._id, 'volunteer_status', 'Volunteer Application Accepted', `Congratulations! Your volunteer application has been accepted.`, { applicationId: application._id, status: 'accepted' });
      } else if (status === 'rejected') {
        await createNotification(user._id, 'volunteer_status', 'Volunteer Application Update', `Your volunteer application has been reviewed. Status: ${status.toUpperCase()}.`, { applicationId: application._id, status });
      }
    }
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// server.js - Add this endpoint
app.get('/api/admin/all-volunteers', protect, async (req, res) => {
  try {
    const allowedRoles = ['admin', 'dispatcher', 'responder'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Rescue team access required' });
    }

    const allVolunteers = await User.find({
      role: 'volunteer'
    }).select('-password');

    const applications = await VolunteerApplication.find({}).sort({ createdAt: -1 });

    const volunteersWithApps = allVolunteers.map(volunteer => {
      const application = applications.find(app => app.email === volunteer.email);
      return {
        ...volunteer.toObject(),
        application: application ? {
          ...application.toObject(),
          files: application.files || []
        } : null
      };
    });

    console.log(`📊 Found ${volunteersWithApps.length} total volunteers`);
    console.log(`   Pending: ${volunteersWithApps.filter(v => v.applicationStatus === 'pending').length}`);
    console.log(`   Approved: ${volunteersWithApps.filter(v => v.applicationStatus === 'approved').length}`);
    console.log(`   Rejected: ${volunteersWithApps.filter(v => v.applicationStatus === 'rejected').length}`);

    res.json({ success: true, data: volunteersWithApps });
  } catch (error) {
    console.error('Error getting all volunteers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/volunteers/applications/:id', protect, async (req, res) => {
  try {
    const application = await VolunteerApplication.findByIdAndDelete(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    res.json({ success: true, message: 'Application deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// server.js - Replace your stats endpoint with this FULL version
app.get('/api/volunteers/stats', protect, async (req, res) => {
  try {
    console.log('📊 ===== STATS ENDPOINT CALLED =====');
    console.log('📊 User:', req.user?.email || req.user?.id);

    // Method 1: Using the model
    const total = await VolunteerApplication.countDocuments();
    console.log('📊 Total (model):', total);

    const pending = await VolunteerApplication.countDocuments({ status: 'pending' });
    console.log('📊 Pending (model):', pending);

    const accepted = await VolunteerApplication.countDocuments({ status: 'accepted' });
    console.log('📊 Accepted (model):', accepted);

    const rejected = await VolunteerApplication.countDocuments({ status: 'rejected' });
    console.log('📊 Rejected (model):', rejected);

    // Method 2: Using direct MongoDB collection (as backup)
    try {
      const db = mongoose.connection.db;
      const collection = db.collection('volunteerapplications');

      const totalDirect = await collection.countDocuments();
      const pendingDirect = await collection.countDocuments({ status: 'pending' });
      const acceptedDirect = await collection.countDocuments({ status: 'accepted' });
      const rejectedDirect = await collection.countDocuments({ status: 'rejected' });

      console.log('📊 Total (direct):', totalDirect);
      console.log('📊 Pending (direct):', pendingDirect);
      console.log('📊 Accepted (direct):', acceptedDirect);
      console.log('📊 Rejected (direct):', rejectedDirect);
    } catch (directError) {
      console.log('⚠️ Direct collection query failed:', directError.message);
    }

    // Get a sample document to verify structure
    const sample = await VolunteerApplication.findOne({});
    console.log('📊 Sample document:', sample ? {
      id: sample._id,
      firstName: sample.firstName,
      status: sample.status,
      hasStatus: !!sample.status
    } : 'No documents found');

    res.json({
      success: true,
      data: {
        total,
        pending,
        accepted,
        rejected,
        closed: 0
      }
    });
  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      stack: error.stack
    });
  }
});

// ==================== NOTIFICATION ROUTES ====================

app.get('/api/notifications', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    const unreadCount = await Notification.countDocuments({ recipient: req.user.id, isRead: false });
    res.json({ success: true, data: notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/notifications/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    res.json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/notifications/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running!', timestamp: new Date() });
});

// ==================== SERVE FRONTEND STATIC FILES ====================
// This must be AFTER all API routes
app.use(express.static(path.join(__dirname, 'dist')));

// Handle React Router routes - serve index.html for all non-API routes
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server running on:
   - http://localhost:${PORT}
   - http://192.168.1.36:${PORT}`);
});// Brevo fix
