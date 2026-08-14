// rescue-response-backend/src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/auth.middleware');
const { validateLogin } = require('../middleware/validation.middleware');
const {
    register,
    login,
    getMe,
    updateProfile,
    changePassword,
    logout,
    extendSession,
    getSessionStatus
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

// ============ PUBLIC ROUTES ============
// ✅ Register - uses multer to parse FormData
router.post('/register', registrationUpload.any(), register);
router.post('/login', validateLogin, login);

// ============ PROTECTED ROUTES ============
router.use(protect);

router.get('/me', getMe);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);
router.post('/logout', logout);
router.post('/extend-session', extendSession);
router.get('/session-status', getSessionStatus);

module.exports = router;