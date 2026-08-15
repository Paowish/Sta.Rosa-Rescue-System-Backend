const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const {
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    sendEmergencyAlert
} = require('../controllers/notification.controller');

router.get('/', protect, getUserNotifications);
router.put('/:id/read', protect, markAsRead);
router.put('/read-all', protect, markAllAsRead);
router.post('/emergency-alert', protect, authorize('admin', 'dispatcher'), sendEmergencyAlert);

module.exports = router;