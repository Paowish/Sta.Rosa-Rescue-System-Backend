// rescue-response-backend/src/controllers/volunteer.controller.js
const VolunteerApplication = require('../models/VolunteerApplication.model');
const User = require('../models/User.model');
const Notification = require('../models/Notification.model');
const AuditLog = require('../models/AuditLog.model');
const Incident = require('../models/Incident.model');

// ============ EXISTING FUNCTIONS ============
// submitApplication, getAllApplications, getApplicationById, 
// reviewApplication, getApplicationStats

// ============ NEW VOLUNTEER DASHBOARD FUNCTIONS ============

// Get volunteer dashboard stats
exports.getVolunteerStats = async (req, res) => {
    try {
        const userId = req.user.id;

        const [onDuty, available, activeIncidents, requests, allIncidents, pending, solved] = await Promise.all([
            User.countDocuments({
                role: 'responder',
                'responderDetails.availability': 'on-duty',
                isActive: true
            }),
            User.countDocuments({
                role: 'responder',
                'responderDetails.availability': 'available',
                isActive: true
            }),
            Incident.countDocuments({ status: 'active' }),
            Incident.countDocuments({
                status: 'pending',
                assignedTo: { $in: [userId] }
            }),
            Incident.countDocuments(),
            Incident.countDocuments({ status: 'pending' }),
            Incident.countDocuments({ status: 'resolved' })
        ]);

        res.status(200).json({
            success: true,
            data: {
                onDuty,
                available,
                activeIncidents,
                requests,
                allIncidents,
                pending,
                solved
            }
        });
    } catch (error) {
        console.error('Error fetching volunteer stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching volunteer stats',
            error: error.message
        });
    }
};

// Get incidents for volunteer
exports.getVolunteerIncidents = async (req, res) => {
    try {
        const { status, limit = 10, page = 1 } = req.query;
        const userId = req.user.id;

        // Build query
        const query = {};

        if (status) {
            query.status = status;
        } else {
            query.status = { $in: ['active', 'pending', 'reported'] };
        }

        // Get incidents assigned to volunteer
        const incidents = await Incident.find(query)
            .populate('reportedBy', 'firstName lastName email phoneNumber')
            .populate('assignedTo', 'firstName lastName email phoneNumber')
            .populate('responders.userId', 'firstName lastName')
            .sort({ priority: -1, createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Incident.countDocuments(query);

        res.status(200).json({
            success: true,
            data: incidents,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching volunteer incidents:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching incidents',
            error: error.message
        });
    }
};

// Get incident by ID
exports.getIncidentById = async (req, res) => {
    try {
        const { incidentId } = req.params;

        const incident = await Incident.findOne({ incidentId })
            .populate('reportedBy', 'firstName lastName email phoneNumber')
            .populate('assignedTo', 'firstName lastName email phoneNumber')
            .populate('responders.userId', 'firstName lastName')
            .populate('updates.updatedBy', 'firstName lastName');

        if (!incident) {
            return res.status(404).json({
                success: false,
                message: 'Incident not found'
            });
        }

        res.status(200).json({
            success: true,
            data: incident
        });
    } catch (error) {
        console.error('Error fetching incident:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching incident',
            error: error.message
        });
    }
};

// Respond to incident
exports.respondToIncident = async (req, res) => {
    try {
        const { incidentId } = req.params;
        const userId = req.user.id;

        const incident = await Incident.findOne({ incidentId });

        if (!incident) {
            return res.status(404).json({
                success: false,
                message: 'Incident not found'
            });
        }

        // Check if already responded
        const alreadyResponded = incident.responders.some(
            r => r.userId.toString() === userId
        );

        if (alreadyResponded) {
            return res.status(400).json({
                success: false,
                message: 'You have already responded to this incident'
            });
        }

        // Add responder
        incident.responders.push({
            userId,
            respondedAt: new Date(),
            status: 'en-route'
        });

        // Update status if pending
        if (incident.status === 'pending') {
            incident.status = 'active';
        }

        await incident.save();

        // Create notification for incident reporter
        await Notification.create({
            recipient: incident.reportedBy,
            type: 'incident_update',
            title: 'Volunteer Responding',
            message: `A volunteer has responded to your incident report: ${incident.title}`,
            data: {
                incidentId: incident.incidentId,
                actionUrl: `/incident/${incident.incidentId}`
            },
            priority: 'high'
        });

        // Audit log
        await AuditLog.create({
            userId: req.user.id,
            action: 'UPDATE',
            entity: 'INCIDENT',
            entityId: incident._id,
            changes: {
                action: 'respond_to_incident',
                responderId: userId
            },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            message: 'Successfully responded to incident',
            data: incident
        });
    } catch (error) {
        console.error('Error responding to incident:', error);
        res.status(500).json({
            success: false,
            message: 'Error responding to incident',
            error: error.message
        });
    }
};

// Accept incident
exports.acceptIncident = async (req, res) => {
    try {
        const { incidentId } = req.params;
        const userId = req.user.id;

        const incident = await Incident.findOne({ incidentId });

        if (!incident) {
            return res.status(404).json({
                success: false,
                message: 'Incident not found'
            });
        }

        // Check if already accepted
        const alreadyAccepted = incident.responders.some(
            r => r.userId.toString() === userId
        );

        if (alreadyAccepted) {
            return res.status(400).json({
                success: false,
                message: 'You have already accepted this incident'
            });
        }

        // Add responder
        incident.responders.push({
            userId,
            respondedAt: new Date(),
            status: 'en-route'
        });

        // Update status to active
        incident.status = 'active';
        incident.assignedTo = incident.assignedTo || [];
        if (!incident.assignedTo.includes(userId)) {
            incident.assignedTo.push(userId);
        }

        await incident.save();

        // Create notification for incident reporter
        await Notification.create({
            recipient: incident.reportedBy,
            type: 'incident_update',
            title: 'Incident Accepted',
            message: `A volunteer has accepted your incident report: ${incident.title}`,
            data: {
                incidentId: incident.incidentId,
                actionUrl: `/incident/${incident.incidentId}`
            },
            priority: 'high'
        });

        // Audit log
        await AuditLog.create({
            userId: req.user.id,
            action: 'UPDATE',
            entity: 'INCIDENT',
            entityId: incident._id,
            changes: {
                action: 'accept_incident',
                responderId: userId,
                status: 'active'
            },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            message: 'Incident accepted successfully',
            data: incident
        });
    } catch (error) {
        console.error('Error accepting incident:', error);
        res.status(500).json({
            success: false,
            message: 'Error accepting incident',
            error: error.message
        });
    }
};

// Decline incident
exports.declineIncident = async (req, res) => {
    try {
        const { incidentId } = req.params;
        const userId = req.user.id;

        const incident = await Incident.findOne({ incidentId });

        if (!incident) {
            return res.status(404).json({
                success: false,
                message: 'Incident not found'
            });
        }

        // Remove from responders if exists
        incident.responders = incident.responders.filter(
            r => r.userId.toString() !== userId
        );

        // Remove from assignedTo if exists
        if (incident.assignedTo) {
            incident.assignedTo = incident.assignedTo.filter(
                id => id.toString() !== userId
            );
        }

        await incident.save();

        // Audit log
        await AuditLog.create({
            userId: req.user.id,
            action: 'UPDATE',
            entity: 'INCIDENT',
            entityId: incident._id,
            changes: {
                action: 'decline_incident',
                responderId: userId
            },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            message: 'Incident declined successfully'
        });
    } catch (error) {
        console.error('Error declining incident:', error);
        res.status(500).json({
            success: false,
            message: 'Error declining incident',
            error: error.message
        });
    }
};

// Update incident status
exports.updateIncidentStatus = async (req, res) => {
    try {
        const { incidentId } = req.params;
        const { status } = req.body;
        const userId = req.user.id;

        const incident = await Incident.findOne({ incidentId });

        if (!incident) {
            return res.status(404).json({
                success: false,
                message: 'Incident not found'
            });
        }

        // Update status
        incident.status = status;

        // If resolved, add resolvedAt timestamp
        if (status === 'resolved') {
            incident.resolvedAt = new Date();
        }

        await incident.save();

        // Create notification
        await Notification.create({
            recipient: incident.reportedBy,
            type: 'incident_update',
            title: `Incident ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            message: `Incident ${incident.incidentId} has been marked as ${status}`,
            data: {
                incidentId: incident.incidentId,
                actionUrl: `/incident/${incident.incidentId}`
            },
            priority: 'medium'
        });

        // Audit log
        await AuditLog.create({
            userId: req.user.id,
            action: 'UPDATE',
            entity: 'INCIDENT',
            entityId: incident._id,
            changes: {
                action: 'update_status',
                status: status
            },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            message: 'Incident status updated successfully',
            data: incident
        });
    } catch (error) {
        console.error('Error updating incident status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating incident status',
            error: error.message
        });
    }
};

// Get notifications for volunteer
exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const { read, limit = 20, page = 1 } = req.query;

        const query = { recipient: userId };
        if (read !== undefined) {
            query.isRead = read === 'true';
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Notification.countDocuments(query);
        const unreadCount = await Notification.countDocuments({
            recipient: userId,
            isRead: false
        });

        res.status(200).json({
            success: true,
            data: notifications,
            unreadCount,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching notifications',
            error: error.message
        });
    }
};

// Mark notification as read
exports.markNotificationRead = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.id;

        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, recipient: userId },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.status(200).json({
            success: true,
            data: notification
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking notification as read',
            error: error.message
        });
    }
};

// Mark all notifications as read
exports.markAllNotificationsRead = async (req, res) => {
    try {
        const userId = req.user.id;

        await Notification.updateMany(
            { recipient: userId, isRead: false },
            { isRead: true }
        );

        res.status(200).json({
            success: true,
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking all notifications as read',
            error: error.message
        });
    }
};

// Update volunteer status
exports.updateVolunteerStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const { availability } = req.body;

        if (!['available', 'on-duty', 'off-duty'].includes(availability)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid availability status'
            });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            {
                'responderDetails.availability': availability,
                updatedAt: new Date()
            },
            { new: true }
        );

        // Audit log
        await AuditLog.create({
            userId: req.user.id,
            action: 'UPDATE',
            entity: 'USER',
            entityId: user._id,
            changes: {
                action: 'update_volunteer_status',
                availability: availability
            },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            message: 'Volunteer status updated successfully',
            data: user
        });
    } catch (error) {
        console.error('Error updating volunteer status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating volunteer status',
            error: error.message
        });
    }
};

// Get volunteer profile
exports.getVolunteerProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId)
            .select('-password -__v')
            .populate('responderDetails.certifications');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error fetching volunteer profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching volunteer profile',
            error: error.message
        });
    }
};

// Update volunteer profile
exports.updateVolunteerProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { firstName, lastName, phoneNumber, email } = req.body;

        // Check if email already exists
        if (email) {
            const existingUser = await User.findOne({
                email,
                _id: { $ne: userId }
            });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already in use'
                });
            }
        }

        const user = await User.findByIdAndUpdate(
            userId,
            {
                firstName: firstName || undefined,
                lastName: lastName || undefined,
                phoneNumber: phoneNumber || undefined,
                email: email || undefined,
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        ).select('-password -__v');

        // Audit log
        await AuditLog.create({
            userId: req.user.id,
            action: 'UPDATE',
            entity: 'USER',
            entityId: user._id,
            changes: {
                action: 'update_volunteer_profile',
                fields: Object.keys(req.body)
            },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: user
        });
    } catch (error) {
        console.error('Error updating volunteer profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating volunteer profile',
            error: error.message
        });
    }
};