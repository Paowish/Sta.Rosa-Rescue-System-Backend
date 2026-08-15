const Notification = require('../models/Notification.model');
const User = require('../models/User.model');

// Get user notifications
exports.getUserNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly = false } = req.query;

        const query = { recipient: req.user.id };
        if (unreadOnly === 'true') query.isRead = false;

        const notifications = await Notification.find(query)
            .sort({ priority: -1, createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const unreadCount = await Notification.countDocuments({
            recipient: req.user.id,
            isRead: false
        });

        const total = await Notification.countDocuments(query);

        res.json({
            success: true,
            data: notifications,
            unreadCount,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            { isRead: true, readAt: new Date() },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.json({ success: true, data: notification });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user.id, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Send bulk emergency alert (Admin only)
exports.sendEmergencyAlert = async (req, res) => {
    try {
        const { title, message, barangays, severity } = req.body;

        const query = { isActive: true };
        if (barangays && barangays.length > 0) {
            query['address.barangay'] = { $in: barangays };
        }

        const users = await User.find(query);

        const notifications = [];
        for (const user of users) {
            const notification = await Notification.create({
                recipient: user._id,
                type: 'emergency_alert',
                title,
                message,
                priority: 'emergency',
                channels: ['in_app'],
                data: { severity, barangays }
            });
            notifications.push(notification);
        }

        // Emit real-time alert
        req.app.get('io').emit('emergency_alert', {
            title,
            message,
            severity,
            timestamp: new Date(),
            barangays
        });

        res.json({
            success: true,
            message: `Alert sent to ${users.length} residents`,
            data: { notificationsCount: notifications.length }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};