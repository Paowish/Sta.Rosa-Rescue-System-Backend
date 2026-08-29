// rescue-response-backend/src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/auth.middleware');
const { validateLogin } = require('../middleware/validation.middleware');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const {
    register,
    login,
    getMe,
    updateProfile,
    changePassword,
    logout,
    extendSession,
    getSessionStatus,
    forgotPassword,
    resetPassword
} = require('../controllers/auth.controller');

// ✅ Multer for FormData - MUST BE BEFORE THE ROUTE
const registrationUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
        fieldSize: 10 * 1024 * 1024
    }
});


router.post('/refresh', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        const newToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        res.json({ success: true, token: newToken });
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
});
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// ============ PUBLIC ROUTES ============
// ✅ Register - uses multer to parse FormData
router.post('/register', registrationUpload.any(), register);
router.post('/login', validateLogin, login);

// ✅ GOOGLE SIGN-IN / SIGN-UP ROUTE (ONLY ONE ROUTE HERE!)
router.post('/google', async (req, res) => {
    const { token } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { sub, email, given_name, family_name, picture } = payload;

        let user = await User.findOne({ email: email });
        if (!user) {
            user = new User({
                googleId: sub,
                email: email,
                firstName: given_name,
                lastName: family_name,
                profileImage: picture,
                role: 'civilian',
                phoneNumber: '',
                isApproved: true,
                applicationStatus: 'approved',
                isActive: true,
                isVerified: true
            });
            await user.save();
        } else {
            user.googleId = sub;
            user.firstName = given_name;
            user.lastName = family_name;
            if (picture) user.profileImage = picture;
            await user.save();
        }

        // ✅ RENAMED TO AUTH_TOKEN TO AVOID CONFLICT WITH REQ.BODY TOKEN
        const authToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET || 'mysecretkey',
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        res.status(200).json({ success: true, token: authToken, user: user });
    } catch (error) {
        console.error('Error verifying Google token:', error);
        res.status(401).json({ success: false, message: 'Invalid Google token' });
    }
});

// ============ PROTECTED ROUTES ============
router.use(protect);

router.get('/me', getMe);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);
router.post('/logout', logout);
router.post('/extend-session', extendSession);
router.get('/session-status', getSessionStatus);

module.exports = router;