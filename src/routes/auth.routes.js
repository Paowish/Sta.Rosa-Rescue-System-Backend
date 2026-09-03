// rescue-response-backend/src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/auth.middleware');
const { validateLogin } = require('../middleware/validation.middleware');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const crypto = require('crypto');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
    windowMs: 3 * 60 * 1000, // 3 minutes
    max: 10,
    message: {
        success: false,
        message: 'Too many login attempts. Please try again after 3 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

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

const registrationUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
        fieldSize: 10 * 1024 * 1024
    }
});

// ============ PUBLIC ROUTES (NO AUTH REQUIRED) ============

// ✅ VERIFY OTP ENDPOINT (PUBLIC - NO AUTH)
router.post('/verify-otp', async (req, res) => {
    try {
        const { userId, otp } = req.body;

        if (!userId || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Please provide userId and OTP'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.isVerified) {
            return res.status(400).json({
                success: false,
                message: 'Email already verified'
            });
        }

        if (!user.otpExpires || user.otpExpires < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new one.'
            });
        }

        if (user.otpAttempts >= 5) {
            return res.status(400).json({
                success: false,
                message: 'Too many incorrect attempts. Please request a new OTP.'
            });
        }

        if (user.otpCode !== otp) {
            user.otpAttempts = (user.otpAttempts || 0) + 1;
            await user.save();

            return res.status(400).json({
                success: false,
                message: `Invalid OTP. ${5 - user.otpAttempts} attempts remaining.`
            });
        }

        user.isVerified = true;
        user.otpCode = undefined;
        user.otpExpires = undefined;
        user.otpAttempts = 0;
        await user.save();

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET || 'mysecretkey',
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        return res.status(200).json({
            success: true,
            message: 'Email verified successfully!',
            token: token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                phoneNumber: user.phoneNumber,
                profileImage: user.profileImage || '',
                isApproved: user.isApproved,
                applicationStatus: user.applicationStatus,
                isVerified: true
            }
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to verify OTP'
        });
    }
});

// ✅ RESEND OTP ENDPOINT (PUBLIC - NO AUTH)
router.post('/resend-otp', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Please provide userId'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.isVerified) {
            return res.status(400).json({
                success: false,
                message: 'Email already verified'
            });
        }

        // Generate new OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otpCode = otp;
        user.otpExpires = Date.now() + 3 * 60 * 1000; // 3 minutes
        user.otpAttempts = 0;
        await user.save();

        // Send OTP email using Brevo API
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': process.env.BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: {
                    name: "Sta. Rosa Rescue Team",
                    email: "paolocarunia139@gmail.com"
                },
                to: [
                    {
                        email: user.email,
                        name: `${user.firstName} ${user.lastName}`
                    }
                ],
                subject: "🔐 Your OTP Verification Code",
                htmlContent: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                        <div style="background-color: #1976d2; color: white; padding: 20px; text-align: center;">
                            <h1 style="margin: 0;">OTP Verification</h1>
                        </div>
                        <div style="padding: 20px; text-align: center;">
                            <p>Dear <strong>${user.firstName}</strong>,</p>
                            <p>Your verification code is:</p>
                            <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1976d2; margin: 20px 0; background-color: #f5f5f5; padding: 15px; border-radius: 8px;">
                                ${otp}
                            </div>
                            <p>This code will expire in <strong>3 minutes</strong>.</p>
                            <p>If you didn't create an account with us, please ignore this email.</p>
                        </div>
                    </div>
                `
            })
        });

        const emailData = await response.json();

        if (!response.ok) {
            console.error("Brevo API Error (Resend OTP):", emailData);
            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP email'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'New OTP sent to your email!'
        });
    } catch (error) {
        console.error('Resend OTP error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to resend OTP'
        });
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

// ✅ Register - uses multer to parse FormData
router.post('/register', registrationUpload.any(), register);

router.post('/login', authLimiter, validateLogin, login);

router.post('/google', authLimiter, async (req, res) => {
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
            // ✅ CHECK IF VOLUNTEER AND PENDING APPROVAL
            if (user.role === 'volunteer') {
                if (user.applicationStatus === 'pending' || !user.isApproved) {
                    return res.status(403).json({
                        success: false,
                        message: 'Your volunteer application is pending approval. Please wait for the rescue team to review your application.',
                        code: 'PENDING_APPROVAL'
                    });
                }
                if (user.applicationStatus === 'rejected') {
                    return res.status(403).json({
                        success: false,
                        message: 'Your volunteer application has been rejected. Please contact support for more information.',
                        code: 'REJECTED'
                    });
                }
            }

            user.googleId = sub;
            user.firstName = given_name;
            user.lastName = family_name;
            if (picture) user.profileImage = picture;
            await user.save();
        }

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