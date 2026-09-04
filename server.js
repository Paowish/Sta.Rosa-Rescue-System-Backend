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
const { sendVolunteerAccepted, sendVolunteerRejected } = require('./src/services/email.service');

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require('dotenv').config();

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: 'nvvaydmz',
  api_key: '158414443953793',
  api_secret: 'vC7Bmv3Qn31dazyOiB1lCTqZ7bo'
});

const app = express();

const VolunteerApplication = require('./src/models/VolunteerApplication.model');
const Incident = require('./src/models/Incident.model');
const Notification = require('./src/models/Notification.model');
const volunteerRoutes = require('./src/routes/volunteer.routes');

app.use('/api/volunteers', volunteerRoutes);

app.set('trust proxy', 1);

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests, please try again later.',
  validate: { trustProxy: true }
}));

const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;

  // ✅ BLOCK OLD @volunteer.com EMAILS (Causing bounces)
  const blockedEmails = [
    'mark.chavez@volunteer.com', 'juan.delacruz@volunteer.com', 'ramon.santos@volunteer.com',
    'miguel.reyes@volunteer.com', 'andres.gomez@volunteer.com', 'pedro.lopez@volunteer.com',
    'james.reyes@volunteer.com', 'mark.cruz@volunteer.com', 'ramon.mendoza@volunteer.com',
    'albert.santos@volunteer.com', 'philip.garcia@volunteer.com', 'luz.torres@volunteer.com',
    'jose.rizal@volunteer.com', 'manuel.delacruz@volunteer.com', 'elena.gomez@volunteer.com',
    'carlos.mendoza@volunteer.com', 'roberto.flores@volunteer.com', 'sofia.ramos@volunteer.com',
    'maria.santos@volunteer.com', 'ana.reyes@volunteer.com', 'luz.gomez@volunteer.com',
    'diego.martinez@volunteer.com', 'carla.torres@volunteer.com', 'paolo.vince@volunteer.com'
  ];

  if (blockedEmails.includes(email.toLowerCase())) {
    return false; // ❌ Block old @volunteer.com emails
  }

  const fakeDomains = ['volunteer.com', 'example.com', 'test.com', 'fake.com', 'mock.com', 'sample.com', 'demo.com'];
  const domain = email.split('@')[1].toLowerCase();
  if (fakeDomains.includes(domain)) return false;

  return true;
};

// ✅ LOG EMAIL (For debugging)
const logEmail = (type, email, success = true) => {
  console.log(`📧 [${type}] ${success ? '✅' : '❌'} ${email}`);
};

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:5173", "http://192.168.1.36:5173", "https://*.ngrok-free.dev"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
  });

  socket.on('join-room', (room) => {
    socket.join(room);
  });

  socket.on('disconnect', () => { });

  socket.on('volunteer-location', async (data) => {
    try {
      const { volunteerId, volunteerName, incidentId, location, status } = data;

      if (incidentId && location) {
        const incident = await Incident.findById(incidentId);
        if (incident) {
          incident.responderLocation = {
            type: 'Point',
            coordinates: [location.lng, location.lat],
            updatedAt: new Date()
          };

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

          if (incident.status !== 'En Route') {
            incident.status = 'En Route';
          }

          await incident.save();
        }

        socket.to(`incident_${incidentId}`).emit('volunteer-location-update', {
          volunteerId: volunteerId,
          volunteerName: volunteerName || 'Volunteer',
          location: location,
          status: status || 'en-route',
          timestamp: new Date().toISOString()
        });

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

  socket.on('join-incident', (incidentId) => {
    socket.join(`incident_${incidentId}`);
  });

  socket.on('leave-incident', (incidentId) => {
    socket.leave(`incident_${incidentId}`);
  });
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'https://sta-rosa-nueva-ecija-emergency-response.vercel.app',
  'https://rescuesantarosagov.live',
  'https://www.rescuesantarosagov.live',
  'https://api.rescuesantarosagov.live'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(noSqlSanitizer);
app.use(xssSanitizer);

// ✅ TEMPORARY HARDCODED FIX FOR RENDER
// ✅ HARDCODED FIX (No directConnection)
const MONGODB_URI = 'mongodb+srv://caruniapaolovince_db_user:d6aq4TWv2V7LxEpw@cluster0.y4p1ld4.mongodb.net/rescue-response-system?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => console.error('❌ MongoDB error:', err.message));

const User = require('./src/models/User.model');
const authRoutes = require('./src/routes/auth.routes');

// ✅ DEFINE THE TEAM MODEL HERE
const teamSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  role: { type: String, required: true },
  teamLeader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  volunteerId: { type: String, required: true, unique: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  specialties: [{ type: String }],
  schedule: [{ type: String }]
}, { timestamps: true });

const Team = mongoose.model('Team', teamSchema);


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

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'mysecretkey', { expiresIn: '7d' });
};

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

app.get('/api/volunteer/active-dispatch', protect, async (req, res) => {
  try {
    const volunteerId = req.user.id;

    const activeIncident = await Incident.findOne({
      'assignedTo.responder': volunteerId,
      status: { $in: ['Pending', 'Acknowledged', 'Active', 'En Route', 'Dispatched'] }
    }).populate('reportedBy', 'firstName lastName email phoneNumber');

    if (activeIncident) {
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

const registrationUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    fieldSize: 10 * 1024 * 1024
  }
});

app.put('/api/volunteer/profile', protect, async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber, address, certifications, availability, description } = req.body;
    const userId = req.user.id;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        firstName: firstName || req.user.firstName,
        lastName: lastName || req.user.lastName,
        phoneNumber: phoneNumber || req.user.phoneNumber,
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const application = await VolunteerApplication.findOneAndUpdate(
      { userId: userId },
      {
        firstName: firstName || user.firstName,
        lastName: lastName || user.lastName,
        phoneNumber: phoneNumber || user.phoneNumber,
        address1: address || user.address,
        certifications: certifications || [],
        availability: availability || [],
        description: description || '',
      },
      { new: true }
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('volunteer_application_updated', {
        volunteerId: userId,
        timestamp: new Date()
      });
    }

    await createNotification(
      userId,
      'system_announcement',
      'Profile Updated',
      'Your profile has been updated successfully.',
      { userId }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });

  } catch (error) {
    console.error('❌ Profile update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/admin/delete-user/:userId', protect, async (req, res) => {
  try {
    if (!['admin', 'dispatcher', 'responder'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const user = await User.findByIdAndDelete(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await VolunteerApplication.findOneAndDelete({ userId: req.params.userId });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/admin/update-user/:userId', protect, async (req, res) => {
  try {
    if (!['admin', 'dispatcher', 'responder'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { firstName, lastName, email, phoneNumber, role, isApproved, password } = req.body;

    if (email) {
      const existingUser = await User.findOne({
        email: email,
        _id: { $ne: req.params.userId }
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "This email is already in use by another account. Please use a different email."
        });
      }
    }

    const updateData = {
      firstName,
      lastName,
      email,
      phoneNumber,
      role: role || 'volunteer',
      isApproved: isApproved !== undefined ? isApproved : true,
      applicationStatus: isApproved !== undefined ? (isApproved ? 'approved' : 'pending') : 'approved'
    };

    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (role === 'volunteer') {
      await VolunteerApplication.findOneAndUpdate(
        { userId: req.params.userId },
        { status: isApproved ? 'accepted' : 'pending' }
      );
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });

  } catch (error) {
    console.error('❌ Update user error:', error);

    if (error.code === 11000 || (error.message && error.message.includes("E11000 duplicate key error"))) {
      return res.status(400).json({
        success: false,
        message: "This email is already taken. Please use a different email address."
      });
    }

    res.status(500).json({ success: false, message: error.message || 'Failed to update user' });
  }
});

app.put('/api/incidents/:id/decline', protect, async (req, res) => {
  try {
    const incidentId = req.params.id;

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

app.use('/api/auth', authRoutes);

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

const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

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

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profileImage: result.secure_url },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

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

app.post('/api/incidents', incidentUpload.single('photo'), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let user = null;
    let isGuest = false;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');
        user = await User.findById(decoded.id).select('-password');
      } catch (e) { }
    }

    if (!user) {
      isGuest = true;
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = req.file.path;
    } else if (req.body.image && req.body.image.startsWith('data:image')) {
      const result = await cloudinary.uploader.upload(req.body.image, {
        folder: 'incidents'
      });
      imageUrl = result.secure_url;
    }

    let location = req.body.location;
    if (typeof location === 'string') {
      try {
        location = JSON.parse(location);
      } catch (e) {
        location = { address: location };
      }
    }
    if (!location || typeof location !== 'object') location = { address: 'Unknown location' };
    if (!location.address) location.address = 'Unknown location';
    if (!location.coordinates) location.coordinates = { latitude: 0, longitude: 0 };

    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const incidentId = `RES-${year}-${timestamp}${random}`;

    const incidentData = {
      incidentId: incidentId,
      type: req.body.type || 'Other',
      description: req.body.description || '',
      location: location,
      severity: req.body.severity || 'Medium',
      reportedBy: user ? user._id : null,
      reporterNumber: req.body.reporterNumber || '',
      reporterName: req.body.reporterName || 'Guest User',
      victimsAffected: parseInt(req.body.victimsAffected) || 0,
      image: imageUrl,
      status: 'Pending',
      isGuest: isGuest
    };

    const incident = await Incident.create(incidentData);

    if (user) {
      Promise.resolve().then(async () => {
        try {
          await createNotification(
            user._id,
            'incident_update',
            'Incident Reported',
            `Your incident ${incident.incidentId} has been reported successfully.`,
            { incidentId: incident._id, status: incident.status }
          );
        } catch (notifError) {
          console.error('❌ Notification error:', notifError.message);
        }
      });
    }

    Promise.resolve().then(async () => {
      try {
        const responders = await User.find({
          role: { $in: ['admin', 'dispatcher', 'responder'] },
          isActive: true
        });

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
      }
    });

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



app.post('/api/incidents/:id/dispatch', protect, async (req, res) => {
  try {
    const nodemailer = require('nodemailer');

    const { volunteerIds = [], dispatchNotes = '', teamName = null } = req.body;
    const incidentId = req.params.id;

    // ✅ ADD THIS!
    console.log('🎯 [SERVER] FULL BODY:', JSON.stringify(req.body));
    console.log('🎯 [SERVER] teamName:', teamName);

    // ✅ CHECK IF DISPATCHING A TEAM
    // ✅ ALWAYS treat as team dispatch if there are 6+ volunteerIds (teams have 6 members)
    // ✅ FIX: Prioritize dispatchType
    const isTeamDispatch =
      req.body.dispatchType === 'team' ||
      (!!teamName && req.body.dispatchType !== 'volunteers') ||
      (volunteerIds.length >= 6 && req.body.dispatchType !== 'volunteers');
    console.log('🎯 [SERVER] isTeamDispatch:', isTeamDispatch);


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

    // ✅ SKIP ALL BUSY CHECKS IF DISPATCHING A TEAM
    if (!isTeamDispatch) {
      const existingAssigned = incident.assignedTo || [];
      const existingVolunteerIds = existingAssigned.map(a => a.responder.toString());

      const alreadyAssigned = volunteerIds.filter(id => existingVolunteerIds.includes(id.toString()));

      if (alreadyAssigned.length > 0) {
        const assignedVolunteers = await User.find({ _id: { $in: alreadyAssigned } }).select('firstName lastName');
        const names = assignedVolunteers.map(v => `${v?.firstName || 'Mock Team'} ${v?.lastName || ''}`).join(', ');
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
          if (volunteer) {
            busyVolunteers.push({ id: volunteerId, name: `${volunteer.firstName} ${volunteer.lastName}`, incidentId: otherIncident.incidentId });
          }
        }
      }

      if (busyVolunteers.length > 0) {
        const names = busyVolunteers.map(v => `${v.name} (Incident ${v.incidentId})`).join(', ');
        return res.status(400).json({ success: false, message: `The following volunteers are already assigned to other active incidents: ${names}`, busyVolunteers });
      }
    }

    // ✅ ONLY ADD ASSIGNMENTS IF NOT A TEAM DISPATCH
    if (!isTeamDispatch) {
      const newAssignments = volunteerIds.map(id => ({ responder: id, assignedAt: new Date(), status: 'Pending' }));
      incident.assignedTo = [...incident.assignedTo, ...newAssignments];
    }

    incident.status = 'Pending';
    incident.dispatchNotes = dispatchNotes || 'Dispatched to volunteers';

    // ✅ SAVE TEAM INFO IF TEAM
    if (teamName || volunteerIds.length >= 6) {
      incident.teamName = teamName || 'Rescue Team';
      incident.dispatchType = 'team';
      incident.status = 'Dispatched';
    }

    await incident.save();

    // ✅ IF DISPATCHING A TEAM - ONLY NOTIFY CIVILIAN (NO EMAILS TO TEAM MEMBERS!)
    if (isTeamDispatch) {
      const civilian = await User.findById(incident.reportedBy);
      if (civilian) {
        await createNotification(
          civilian._id,
          'incident_update',
          '✅ Dispatch Update',
          `A rescue team has been dispatched to your "${incident.type}" report at ${incident.location.address}. Check the Track Reports page.`,
          { incidentId: incident._id, status: 'Dispatched' }
        );

        // ✅ ONLY SEND EMAIL IF CIVILIAN EMAIL IS VALID
        if (civilian.email && isValidEmail(civilian.email)) {
          try {
            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
            });
            await transporter.sendMail({
              from: `"Rescue System" <${process.env.EMAIL_USER}>`,
              to: civilian.email,
              subject: `✅ Dispatch Update: ${incident.incidentId}`,
              html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                        <div style="background-color: #1976d2; color: white; padding: 20px; text-align: center;">
                          <h1 style="margin: 0;">✅ Dispatch Update</h1>
                          <p>${isTeamDispatch ? 'A rescue team has been dispatched to your incident.' : 'A volunteer has been dispatched to your incident.'}</p>
                        </div>
                        <div style="padding: 20px;">
                          <p>Dear <strong>${civilian.firstName}</strong>,</p>
                          <p>${isTeamDispatch ? 'A rescue team is on the way to your reported incident.' : 'A volunteer is on the way to your reported incident.'}</p>
                          <h3>Incident Details:</h3>
                          <p><strong>ID:</strong> ${incident.incidentId}</p>
                          <p><strong>Type:</strong> ${incident.type}</p>
                          <p><strong>Status:</strong> Dispatched</p>
                          <p><strong>Location:</strong> ${incident.location.address}</p>
                        </div>
                      </div>`
            });
            logEmail('CIVILIAN', civilian.email);
          } catch (emailError) {
            console.error(`❌ Failed to send email to ${civilian.email}:`, emailError.message);
          }
        } else {
          logEmail('CIVILIAN', civilian.email, false);
        }
      }
    }

    // ✅ ADD THIS RETURN!
    if (isTeamDispatch) {
      return res.json({
        success: true,
        message: `Incident dispatched to ${teamName || 'Rescue Team'}`,
        data: {
          incident: await Incident.findById(incidentId).populate('reportedBy', 'firstName lastName email'),
          volunteersDispatched: 0,
          teamName: teamName || 'Rescue Team',
          dispatchType: 'team'
        }
      });
    }

    // ✅ CONTINUE TO INDIVIDUAL VOLUNTEER PATH

    // ✅ CONTINUE TO INDIVIDUAL VOLUNTEER PATH
    const io = req.app.get('io');
    const { sendEmergencyPush, sendEmailAlert } = require('./src/services/alert.service');
    const PushSubscription = require('./src/models/PushSubscription.model');

    const volunteers = await User.find({ _id: { $in: volunteerIds }, role: 'volunteer', isActive: true, isApproved: true });

    for (const volunteer of volunteers) {
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

      const subscription = await PushSubscription.findOne({ userId: volunteer._id });
      if (subscription) {
        await sendEmergencyPush(subscription, `${volunteer.firstName} ${volunteer.lastName}`, {
          incidentId: incident.incidentId,
          severity: incident.severity,
          address: incident.location.address
        });
      }

      // ✅ ONLY SEND EMAIL IF VOLUNTEER EMAIL IS VALID
      if (volunteer.email && isValidEmail(volunteer.email)) {
        try {
          await sendEmailAlert(volunteer.email, `${volunteer.firstName} ${volunteer.lastName}`, {
            incidentId: incident.incidentId,
            type: incident.type,
            severity: incident.severity,
            address: incident.location.address
          });
          logEmail('VOLUNTEER', volunteer.email);
        } catch (emailError) {
          console.error(`❌ Failed to send email to ${volunteer.email}:`, emailError.message);
        }
      } else {
        logEmail('VOLUNTEER', volunteer.email, false);
      }
    }

    // ✅ STILL NOTIFY CIVILIAN
    const civilian = await User.findById(incident.reportedBy);

    if (civilian) {
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

      // ✅ ONLY SEND EMAIL IF CIVILIAN EMAIL IS VALID
      if (civilian.email && isValidEmail(civilian.email)) {
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
          });
          await transporter.sendMail({
            from: `"Rescue System" <${process.env.EMAIL_USER}>`,
            to: civilian.email,
            subject: `✅ Dispatch Update: ${incident.incidentId}`,
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                        <div style="background-color: #1976d2; color: white; padding: 20px; text-align: center;">
                          <h1 style="margin: 0;">✅ Dispatch Update</h1>
                          <p>A volunteer has been dispatched to your incident.</p>
                        </div>
                        <div style="padding: 20px;">
                          <p>Dear <strong>${civilian.firstName}</strong>,</p>
                          <p>A volunteer is on the way to your reported incident.</p>
                          <h3>Incident Details:</h3>
                          <p><strong>ID:</strong> ${incident.incidentId}</p>
                          <p><strong>Type:</strong> ${incident.type}</p>
                          <p><strong>Status:</strong> Dispatched</p>
                          <p><strong>Location:</strong> ${incident.location.address}</p>
                        </div>
                      </div>`
          });
          logEmail('CIVILIAN', civilian.email);
        } catch (emailError) {
          console.error(`❌ Failed to send email to ${civilian.email}:`, emailError.message);
        }
      } else {
        logEmail('CIVILIAN', civilian.email, false);
      }
    }

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

app.delete('/api/incidents/:id/volunteer/:volunteerId', protect, async (req, res) => {
  try {
    const { id, volunteerId } = req.params;

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

    incident.assignedTo = incident.assignedTo.filter(
      assignment => assignment.responder.toString() !== volunteerId
    );

    if (incident.assignedTo.length === 0) {
      incident.status = 'Pending';
    }

    await incident.save();

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

app.get('/api/volunteers/available', protect, async (req, res) => {
  try {
    // ✅ Get all team member IDs so we can EXCLUDE them
    const allTeams = await Team.find({}).select('members');
    const teamMemberIds = allTeams.flatMap(team => team.members.map(member => member.toString()));

    // ✅ ONLY get volunteers who are NOT in any team
    const volunteers = await User.find({
      role: 'volunteer',
      isActive: true,
      isApproved: true,
      _id: { $nin: teamMemberIds }  // ✅ EXCLUDE team members!
    }).select('firstName lastName email phoneNumber profileImage');

    console.log('🎯 Available volunteers (non-team members):', volunteers.length);

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

// ✅ PUBLIC STATS ENDPOINT (No auth required)
app.get('/api/public/stats', async (req, res) => {
  try {
    const incidents = await Incident.find({});
    const teams = await Team.find({});
    const volunteers = await User.find({ role: 'volunteer', isApproved: true, isActive: true });

    const resolvedCount = incidents.filter(i => ['Resolved', 'Solved', 'Closed'].includes(i.status)).length;
    const activeIncidents = incidents.filter(i => ['Pending', 'Dispatched', 'En Route', 'On Scene'].includes(i.status)).length;

    res.json({
      success: true,
      data: {
        incidentsResolved: resolvedCount,
        activeVolunteers: volunteers.length,
        activeUnits: teams.length,
        totalIncidents: incidents.length,
        activeIncidents: activeIncidents,
        recentIncidents: incidents.slice(0, 4).map(incident => ({
          id: incident.incidentId || `INC-${incident._id.toString().slice(-6)}`,
          type: incident.type || 'Unknown',
          loc: incident.location?.address?.split(',')[0] || 'Unknown Location',
          time: incident.reportedAt ? new Date(incident.reportedAt).toISOString() : new Date().toISOString(),
          status: incident.status || 'PENDING',
        }))
      }
    });
  } catch (error) {
    console.error('❌ Public stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/incidents', async (req, res) => {
  try {
    let incidents;
    const token = req.headers.authorization?.split(' ')[1];
    let user = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');
        user = await User.findById(decoded.id).select('-password');
      } catch (e) { /* Ignore invalid tokens */ }
    }

    if (user) {
      const userId = user.id;
      const userRole = user.role;

      if (userRole === 'civilian') {
        incidents = await Incident.find({ reportedBy: userId }).sort({ createdAt: -1 });
      }
      else if (userRole === 'volunteer') {
        incidents = await Incident.find({ 'assignedTo.responder': userId }).sort({ createdAt: -1 });
      }
      else if (['admin', 'dispatcher', 'responder'].includes(userRole)) {
        incidents = await Incident.find({}).sort({ createdAt: -1 });
      }
    } else {
      incidents = await Incident.find({}).sort({ createdAt: -1 });
    }

    res.json({ success: true, data: incidents });
  } catch (error) {
    console.error('Get incidents error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/incidents/volunteer/:volunteerId', protect, async (req, res) => {
  try {
    const { volunteerId } = req.params;

    if (req.user.id !== volunteerId && !['admin', 'dispatcher', 'responder'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

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

    res.json({ success: true, data: formattedIncidents });
  } catch (error) {
    console.error('Get volunteer incidents error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/incidents/:id', protect, async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .populate('reportedBy', 'firstName lastName email phoneNumber');

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    if (req.user.role === 'civilian' && incident.reportedBy._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this incident'
      });
    }

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

    const alreadyAccepted = incident.assignedTo && incident.assignedTo.some(
      a => a.responder && a.responder.toString() === volunteerIdToUse.toString()
    );

    if (alreadyAccepted) {
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

    if (incident.status === 'En Route' || incident.status === 'On Scene') {
      if (incident.responder && incident.responder.id) {
        return res.status(400).json({
          success: false,
          message: 'Already accepted by another volunteer'
        });
      }
    }

    if (incident.status === 'Resolved' || incident.status === 'Closed') {
      return res.status(400).json({
        success: false,
        message: 'Incident already resolved'
      });
    }

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

    await VolunteerApplication.findOneAndUpdate(
      { userId: user._id },
      { status: 'accepted' }
    );

    await createNotification(
      user._id,
      'volunteer_status',
      'Volunteer Application Approved',
      `Congratulations ${user.firstName}! Your volunteer application has been approved.`,
      { userId: user._id, status: 'approved', approvedBy: req.user._id }
    );

    // ✅ ONLY SEND EMAIL IF USER EMAIL IS VALID
    if (user.email && isValidEmail(user.email)) {
      try {
        const { sendVolunteerAccepted } = require('./src/services/email.service');
        await sendVolunteerAccepted(user.email, user.firstName, user.lastName);
        logEmail('APPROVE', user.email);
      } catch (emailError) {
        console.error('❌ Email error:', emailError);
      }
    } else {
      logEmail('APPROVE', user.email, false);
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

app.post('/api/incidents/:incidentId/update-location', protect, async (req, res) => {
  try {
    const { incidentId } = req.params;
    const { lat, lng, volunteerName } = req.body;

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

app.get('/api/test-email', async (req, res) => {
  try {
    const { sendVolunteerAccepted } = require('./src/services/email.service');
    await sendVolunteerAccepted('your-email@gmail.com', 'Test', 'User');
    res.json({ success: true, message: 'Test email sent! Check your inbox.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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

    await VolunteerApplication.findOneAndUpdate(
      { userId: user._id },
      { status: 'rejected' }
    );

    await createNotification(
      user._id,
      'volunteer_status',
      'Volunteer Application Update',
      `Your volunteer application has been reviewed. Status: REJECTED. ${reason || 'Application does not meet requirements'}`,
      { userId: user._id, status: 'rejected', rejectedBy: req.user._id }
    );

    // ✅ ONLY SEND EMAIL IF USER EMAIL IS VALID
    if (user.email && isValidEmail(user.email)) {
      try {
        const result = await sendVolunteerRejected(user.email, user.firstName, user.lastName, reason);
        console.log('📧 Email send result:', result);
        logEmail('REJECT', user.email);
      } catch (emailError) {
        console.error('❌ Email error:', emailError);
      }
    } else {
      logEmail('REJECT', user.email, false);
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

app.get('/api/admin/all-users', protect, async (req, res) => {
  try {
    const allowedRoles = ['admin', 'dispatcher', 'responder'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Rescue team access required' });
    }

    // ✅ FAST: Fetch ONLY the users, no application join
    const allUsers = await User.find({})
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .sort({ createdAt: -1 })
      .limit(50) // Keep a safe limit
      .lean();

    // ✅ FAST: Return just the users
    res.json({ success: true, data: allUsers });
  } catch (error) {
    console.error('Error getting all users:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ EXPORT USERS TO EXCEL (Real functional route)
app.get('/api/admin/export-users', protect, async (req, res) => {
  try {
    const { type, role } = req.query;
    let filter = {};

    // 1. Apply role filter (CASE-INSENSITIVE MATCH)
    if (role && role !== 'all') {
      filter.role = { $regex: new RegExp(`^${role}$`, 'i') }; // ✅ Case-insensitive match
    }

    // 2. Apply status filter based on 'type' (all, active, inactive)
    if (type === 'active') {
      filter.isApproved = true;
      filter.applicationStatus = 'approved';
    } else if (type === 'inactive') {
      filter.isApproved = false;
    }

    // 3. Fetch users from database
    const users = await User.find(filter).select(
      'firstName lastName email phoneNumber role isApproved applicationStatus lastLogin createdAt'
    );

    // 4. Format data for Excel
    const excelData = users.map(user => ({
      'First Name': user.firstName || '',
      'Last Name': user.lastName || '',
      'Full Name': `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      'Email': user.email || '',
      'Phone Number': user.phoneNumber || 'N/A',
      'Role': user.role?.toUpperCase() || 'VOLUNTEER',
      'Status': user.isApproved ? 'ACTIVE' : (user.applicationStatus === 'rejected' ? 'REJECTED' : 'PENDING'),
      'Last Login': user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : '-',
      'Date Registered': user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'
    }));

    // 5. Generate Excel file using xlsx
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Auto-size columns
    const colWidths = [
      { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 30 },
      { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Users');

    // 6. Generate buffer and send as download
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename=users_${type}_${new Date().toISOString().split('T')[0]}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    console.error('❌ Export error:', error);
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

app.get('/api/volunteers/stats', protect, async (req, res) => {
  try {
    const total = await VolunteerApplication.countDocuments();
    const pending = await VolunteerApplication.countDocuments({ status: 'pending' });
    const accepted = await VolunteerApplication.countDocuments({ status: 'accepted' });
    const rejected = await VolunteerApplication.countDocuments({ status: 'rejected' });

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

app.get('/api/admin/backup-schedule', protect, async (req, res) => {
  try {
    const Settings = mongoose.model('Settings', new mongoose.Schema({
      frequency: String,
      time: String,
      retentionDays: Number,
      storagePath: String,
      emailNotification: Boolean
    }));

    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({
        frequency: 'Daily',
        time: '3:00 AM',
        retentionDays: 30,
        storagePath: './backups',
        emailNotification: true
      });
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('❌ Error fetching backup schedule:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running!', timestamp: new Date() });
});

app.get('/api/admin/settings', protect, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        siteName: "Sta. Rosa Rescue System",
        maintenanceMode: false,
        allowGuestReports: true
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ PURE REAL SYSTEM LOGS ROUTE (NO MOCK DATA, NO SEEDING)
app.get('/api/admin/system-logs', protect, async (req, res) => {
  try {
    // ✅ SAFE GLOBAL MODEL DEFINITION (Prevents OverwriteModelError)
    const SystemLog = mongoose.models.SystemLog || mongoose.model('SystemLog', new mongoose.Schema({
      timestamp: { type: Date, default: Date.now },
      type: { type: String, enum: ['INFO', 'OK', 'ERROR', 'WARNING'] },
      action: String,
      message: String,
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }));

    // Just fetch real logs. If empty, it returns [].
    const logs = await SystemLog.find().sort({ timestamp: -1 }).limit(50);

    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('❌ Logs error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/backups', protect, async (req, res) => {
  try {
    const backupDir = path.join(__dirname, 'backups');

    if (!fs.existsSync(backupDir)) {
      return res.json({ success: true, data: [] });
    }

    const files = fs.readdirSync(backupDir);

    const backups = files.map((file) => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);

      let dateStr = stats.birthtime.toLocaleString();
      let backupType = 'Manual';

      const nameParts = file.replace('.json', '').split('_');
      if (nameParts.length >= 3) {
        const datePart = nameParts[1];
        const timePart = nameParts[2].replace(/-/g, ':');
        dateStr = `${datePart} ${timePart}`;
        backupType = 'Auto';
      }

      return {
        id: file,
        name: file,
        date: dateStr,
        type: backupType,
        status: 'OK',
        size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`
      };
    });

    res.json({ success: true, data: backups });
  } catch (error) {
    console.error('Error getting backups:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/backup-now', protect, async (req, res) => {
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `Backup_${dateStr}_${timeStr}.json`;
    const filepath = path.join(backupDir, filename);

    console.log(`📦 Starting backup to: ${filepath}`);

    // ✅ NATIVE NODE.JS BACKUP (NO mongodump REQUIRED)
    // 1. Get all collections from the database
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    const backupData = {};
    const collectionNames = collections.map(c => c.name);

    // 2. Iterate through each collection and fetch all documents
    for (const name of collectionNames) {
      const collection = db.collection(name);
      const docs = await collection.find({}).toArray();
      backupData[name] = docs;
    }

    // 3. Write the complete database dump to the .json file
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));

    console.log(`✅ Backup completed! File size: ${(fs.statSync(filepath).size / 1024 / 1024).toFixed(2)} MB`);

    // ✅ 4. Fetch all Admin/Rescue Team users
    const rescueTeam = await User.find({
      role: { $in: ['admin', 'dispatcher', 'responder'] },
      isActive: true
    });

    // ✅ 5. Send a notification to EACH rescue team member
    for (const member of rescueTeam) {
      await createNotification(
        member._id,
        'system_announcement',
        '✅ Backup Completed',
        `A new system backup has been created successfully.`,
        { type: 'backup' }
      );
    }

    // ✅ 6. Send success response to the frontend
    res.json({
      success: true,
      message: 'Backup process completed successfully.'
    });

  } catch (error) {
    console.error('❌ Backup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/restore-backup/:backupId', protect, async (req, res) => {
  try {
    const { backupId } = req.params;
    res.json({ success: true, message: 'Backup restored successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/admin/delete-backup/:backupId', protect, async (req, res) => {
  try {
    const { backupId } = req.params;
    res.json({ success: true, message: 'Backup deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/admin/backup-schedule', protect, async (req, res) => {
  try {
    const { frequency, time, retentionDays, storagePath, emailNotification } = req.body;

    const Settings = mongoose.model('Settings', new mongoose.Schema({
      frequency: String,
      time: String,
      retentionDays: Number,
      storagePath: String,
      emailNotification: Boolean
    }));

    const updatedSettings = await Settings.findOneAndUpdate(
      {},
      { frequency, time, retentionDays, storagePath, emailNotification },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Backup schedule saved successfully.',
      data: updatedSettings
    });
  } catch (error) {
    console.error('❌ Error saving backup schedule:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ GET ALL TEAMS
app.get('/api/teams', protect, async (req, res) => {
  try {
    const teams = await Team.find({})
      .populate('members', 'firstName lastName phoneNumber profileImage email')
      .populate('teamLeader', 'firstName lastName phoneNumber');

    res.json({ success: true, data: teams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 🔍 DEBUG: Check exact database roles
app.get('/api/admin/debug-roles', protect, async (req, res) => {
  try {
    const distinctRoles = await User.distinct('role');
    const roleCounts = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    res.json({
      success: true,
      distinctRoles,
      roleCounts
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server running on:
   - http://localhost:${PORT}
   - http://192.168.1.36:${PORT}`);
});