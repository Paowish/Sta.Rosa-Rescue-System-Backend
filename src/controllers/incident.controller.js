const Incident = require('../models/Incident.model');
const EmergencyResponse = require('../models/EmergencyResponse.model');
const Notification = require('../models/Notification.model');
const AuditLog = require('../models/AuditLog.model');
const User = require('../models/User.model');
const { calculateDistance, findNearbyResponders } = require('../utils/geo.utils');

// Report new incident (Civilian)
exports.reportIncident = async (req, res) => {
    try {
        const {
            type,
            description,
            location,
            severity,
            images
        } = req.body;

        if (!location.coordinates || !location.coordinates.latitude || !location.coordinates.longitude) {
            return res.status(400).json({
                success: false,
                message: 'Location coordinates are required for geolocation'
            });
        }

        const incident = await Incident.create({
            type,
            description,
            location: {
                address: location.address,
                coordinates: location.coordinates,
                barangay: location.barangay,
                city: location.city || 'Sta. Rosa',
                province: location.province || 'Nueva Ecija'
            },
            severity: severity || 'Medium',
            reportedBy: req.user.id,
            reporterPhone: req.user.phoneNumber,
            images: images || [],
            reportedAt: new Date()
        });

        // Create emergency response record
        await EmergencyResponse.create({
            incidentId: incident._id,
            status: 'Pending'
        });

        // Find nearby responders
        const nearbyResponders = await findNearbyResponders(
            location.coordinates.latitude,
            location.coordinates.longitude,
            5
        );

        // Send notifications to dispatchers
        const dispatchers = await User.find({ role: 'dispatcher', isActive: true });
        for (const dispatcher of dispatchers) {
            await Notification.create({
                recipient: dispatcher._id,
                type: 'incident_update',
                title: 'New Incident Reported',
                message: `${type} reported at ${location.address}`,
                data: {
                    incidentId: incident._id,
                    incidentType: type,
                    coordinates: location.coordinates,
                    severity: severity || 'Medium'
                },
                priority: severity === 'Critical' ? 'emergency' : 'high',
                channels: ['in_app', 'push']
            });
        }

        // Log the action
        await AuditLog.create({
            userId: req.user.id,
            action: 'CREATE',
            entity: 'INCIDENT',
            entityId: incident._id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        // ✅ FIX: Emit real-time incident alert to ALL relevant rooms
        const io = req.app.get('io');
        if (io) {
            const eventData = {
                incidentId: incident._id,
                incident: incident,
                type: incident.type,
                severity: incident.severity,
                location: incident.location,
                reportedAt: incident.reportedAt,
                status: incident.status
            };

            // Broadcast to all connected clients
            io.emit('new_incident', eventData);
            io.emit('incident_updated', eventData);

            // Send to specific rooms
            io.to('track-reports').emit('new_incident', eventData);
            io.to('rescue-team').emit('new_incident', eventData);
            io.to('volunteers').emit('new_incident', eventData);

            console.log(`📡 Emitted new_incident event for: ${incident.incidentId}`);
        }

        res.status(201).json({
            success: true,
            message: 'Incident reported successfully',
            data: incident
        });
    } catch (error) {
        console.error('Error reporting incident:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all incidents (with filters)
exports.getAllIncidents = async (req, res) => {
    try {
        const { status, severity, barangay, page = 1, limit = 10 } = req.query;
        const query = {};

        if (status) {
            query.status = status;
        } else {
            // If no specific status is requested, show all non-resolved incidents
            query.status = { $in: ['Pending', 'Acknowledged', 'Active', 'Dispatched', 'En Route', 'On Scene'] };
        }
        if (severity) query.severity = severity;
        if (barangay) query['location.barangay'] = barangay;

        const incidents = await Incident.find(query)
            .populate('reportedBy', 'firstName lastName email phoneNumber')
            .populate('assignedTo.responder', 'firstName lastName')
            .sort({ severity: -1, createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Incident.countDocuments(query);

        res.json({
            success: true,
            data: incidents,
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

// Get incident by ID
exports.getIncidentById = async (req, res) => {
    try {
        const incident = await Incident.findById(req.params.id)
            .populate('reportedBy', 'firstName lastName email phoneNumber')
            .populate('assignedTo.responder', 'firstName lastName')
            .populate('resolvedBy', 'firstName lastName');

        if (!incident) {
            return res.status(404).json({ success: false, message: 'Incident not found' });
        }

        const response = await EmergencyResponse.findOne({ incidentId: incident._id });

        res.json({
            success: true,
            data: { incident, response }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get nearby incidents (Geolocation-driven)
exports.getNearbyIncidents = async (req, res) => {
    try {
        const { latitude, longitude, radius = 5 } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Latitude and longitude are required'
            });
        }

        const incidents = await Incident.find({
            status: { $in: ['Pending', 'Acknowledged', 'Active'] },
            'location.coordinates': {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(longitude), parseFloat(latitude)]
                    },
                    $maxDistance: radius * 1000
                }
            }
        })
            .populate('reportedBy', 'firstName lastName')
            .sort({ severity: -1, reportedAt: -1 })
            .limit(20);

        const incidentsWithDistance = incidents.map(incident => ({
            ...incident.toObject(),
            distance: calculateDistance(
                parseFloat(latitude),
                parseFloat(longitude),
                incident.location.coordinates.latitude,
                incident.location.coordinates.longitude
            )
        }));

        res.json({
            success: true,
            count: incidentsWithDistance.length,
            data: incidentsWithDistance
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Assign responders to incident
exports.assignResponders = async (req, res) => {
    try {
        const { incidentId, responderIds, teamName, dispatchNotes } = req.body;

        const incident = await Incident.findById(incidentId);
        if (!incident) {
            return res.status(404).json({ success: false, message: 'Incident not found' });
        }

        incident.assignedTo = responderIds.map(responderId => ({
            responder: responderId,
            assignedAt: new Date(),
            status: 'En Route'
        }));
        incident.assignedTeam = teamName;
        incident.dispatchNotes = dispatchNotes;
        incident.status = 'Acknowledged';

        await incident.save();

        await EmergencyResponse.findOneAndUpdate(
            { incidentId },
            {
                dispatchTime: new Date(),
                status: 'Dispatched',
                responders: responderIds.map(id => ({ userId: id, assignedAt: new Date() }))
            }
        );

        // Send notifications
        for (const responderId of responderIds) {
            await Notification.create({
                recipient: responderId,
                type: 'response_assignment',
                title: 'Emergency Response Assignment',
                message: `You have been assigned to ${incident.type} at ${incident.location.address}`,
                data: {
                    incidentId: incident._id,
                    incidentType: incident.type,
                    coordinates: incident.location.coordinates,
                    actionUrl: `/incidents/${incident._id}`
                },
                priority: 'emergency',
                channels: ['in_app', 'sms', 'push']
            });
        }

        // ✅ FIX: Emit assignment event to all relevant rooms
        const io = req.app.get('io');
        if (io) {
            const eventData = {
                incidentId: incident._id,
                incident: incident,
                responders: responderIds,
                status: 'Acknowledged',
                timestamp: new Date()
            };

            io.emit('responder_assigned', eventData);
            io.emit('incident_updated', eventData);
            io.to('track-reports').emit('incident_updated', eventData);
            io.to('rescue-team').emit('incident_updated', eventData);

            console.log(`📡 Emitted responder_assigned for incident: ${incident.incidentId}`);
        }

        await AuditLog.create({
            userId: req.user.id,
            action: 'ASSIGN',
            entity: 'INCIDENT',
            entityId: incident._id,
            changes: { assignedTo: responderIds, teamName },
            ipAddress: req.ip
        });

        res.json({
            success: true,
            message: 'Responders assigned successfully',
            data: incident
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update incident status
exports.updateIncidentStatus = async (req, res) => {
    try {
        const { status, updateMessage } = req.body;
        const incidentId = req.params.id;

        const incident = await Incident.findByIdAndUpdate(
            incidentId,
            { status },
            { new: true }
        );

        if (!incident) {
            return res.status(404).json({ success: false, message: 'Incident not found' });
        }

        // Add to emergency response updates
        await EmergencyResponse.findOneAndUpdate(
            { incidentId },
            {
                $push: {
                    updates: {
                        message: updateMessage || `Status changed to ${status}`,
                        updatedBy: req.user.id,
                        timestamp: new Date()
                    }
                }
            }
        );

        // Notify the reporter
        await Notification.create({
            recipient: incident.reportedBy,
            type: 'incident_update',
            title: `Incident Status Update: ${incident.incidentId}`,
            message: `Your reported incident is now ${status}`,
            data: { incidentId: incident._id, status },
            priority: 'high'
        });

        // ✅ FIX: Emit status update to ALL relevant rooms
        const io = req.app.get('io');
        if (io) {
            const eventData = {
                incidentId: incident._id,
                incident: incident,
                status: status,
                timestamp: new Date()
            };

            io.emit('incident_status_update', eventData);
            io.emit('incident_updated', eventData);
            io.to('track-reports').emit('incident_updated', eventData);
            io.to('rescue-team').emit('incident_updated', eventData);
            io.to('volunteers').emit('incident_updated', eventData);

            console.log(`📡 Emitted incident_status_update for: ${incident.incidentId} -> ${status}`);
        }

        res.json({
            success: true,
            message: 'Incident status updated',
            data: incident
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Resolve incident
exports.resolveIncident = async (req, res) => {
    try {
        const { resolutionNotes } = req.body;
        const incidentId = req.params.id;

        const incident = await Incident.findByIdAndUpdate(
            incidentId,
            {
                status: 'Resolved',
                resolvedAt: new Date(),
                resolutionNotes,
                resolvedBy: req.user.id
            },
            { new: true }
        );

        if (!incident) {
            return res.status(404).json({ success: false, message: 'Incident not found' });
        }

        await EmergencyResponse.findOneAndUpdate(
            { incidentId },
            {
                resolutionTime: new Date(),
                status: 'Closed'
            }
        );

        await Notification.create({
            recipient: incident.reportedBy,
            type: 'incident_update',
            title: 'Incident Resolved',
            message: `Incident ${incident.incidentId} has been resolved. ${resolutionNotes || ''}`,
            data: { incidentId: incident._id },
            priority: 'high'
        });

        // ✅ FIX: Emit resolved event to ALL relevant rooms
        const io = req.app.get('io');
        if (io) {
            const eventData = {
                incidentId: incident._id,
                incident: incident,
                resolvedAt: incident.resolvedAt,
                status: 'Resolved'
            };

            io.emit('incident_resolved', eventData);
            io.emit('incident_updated', eventData);
            io.to('track-reports').emit('incident_updated', eventData);
            io.to('rescue-team').emit('incident_updated', eventData);
            io.to('volunteers').emit('incident_updated', eventData);

            console.log(`📡 Emitted incident_resolved for: ${incident.incidentId}`);
        }

        res.json({
            success: true,
            message: 'Incident resolved successfully',
            data: incident
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get incident statistics
exports.getIncidentStats = async (req, res) => {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeek = new Date(now.setDate(now.getDate() - 7));

        const stats = {
            total: await Incident.countDocuments(),
            active: await Incident.countDocuments({ status: { $in: ['Pending', 'Acknowledged', 'Active'] } }),
            resolved: await Incident.countDocuments({ status: 'Resolved' }),
            today: await Incident.countDocuments({ reportedAt: { $gte: today } }),
            thisWeek: await Incident.countDocuments({ reportedAt: { $gte: thisWeek } }),
            byType: await Incident.aggregate([
                { $group: { _id: '$type', count: { $sum: 1 } } }
            ]),
            bySeverity: await Incident.aggregate([
                { $group: { _id: '$severity', count: { $sum: 1 } } }
            ]),
            byBarangay: await Incident.aggregate([
                { $match: { 'location.barangay': { $exists: true, $ne: null } } },
                { $group: { _id: '$location.barangay', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ])
        };

        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Accept incident (Volunteer)
exports.acceptIncident = async (req, res) => {
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

        // Check if already accepted
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

            // ✅ EMIT SOCKET EVENT
            const io = req.app.get('io');
            if (io) {
                const eventData = {
                    incidentId: incident._id,
                    incident: updatedIncident,
                    status: 'En Route',
                    responderName: responderNameToSave
                };
                io.emit('incident_status_update', eventData);
                io.emit('incident_updated', eventData);
                io.to('track-reports').emit('incident_updated', eventData);
                io.to('volunteers').emit('incident_updated', eventData);
                console.log(`📡 Emitted incident_status_update for: ${incident.incidentId} -> En Route`);
            }

            return res.json({
                success: true,
                message: 'Incident accepted successfully',
                data: updatedIncident
            });
        }

        // Check if En Route or On Scene by another
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

        // Update incident
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

        // ✅ EMIT SOCKET EVENT
        const io = req.app.get('io');
        if (io) {
            const eventData = {
                incidentId: incident._id,
                incident: updatedIncident,
                status: 'En Route',
                responderName: responderNameToSave
            };
            io.emit('incident_status_update', eventData);
            io.emit('incident_updated', eventData);
            io.to('track-reports').emit('incident_updated', eventData);
            io.to('volunteers').emit('incident_updated', eventData);
            console.log(`📡 Emitted incident_status_update for: ${incident.incidentId} -> En Route`);
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
};

// ✅ Decline incident (Volunteer)
exports.declineIncident = async (req, res) => {
    try {
        const { id } = req.params;
        const { volunteerId } = req.body;
        const userId = req.user.id;

        const volunteerIdToUse = volunteerId || userId;

        const incident = await Incident.findById(id);
        if (!incident) {
            return res.status(404).json({ success: false, message: 'Incident not found' });
        }

        // Remove volunteer from assignedTo
        incident.assignedTo = incident.assignedTo.filter(
            assignment => assignment.responder.toString() !== volunteerIdToUse.toString()
        );

        // If no volunteers left, set status back to Pending
        if (incident.assignedTo.length === 0) {
            incident.status = 'Pending';
        }

        await incident.save();

        // ✅ EMIT SOCKET EVENT
        const io = req.app.get('io');
        if (io) {
            const eventData = {
                incidentId: incident._id,
                incident: incident,
                status: incident.status,
                volunteerId: volunteerIdToUse
            };
            io.emit('incident_updated', eventData);
            io.to('track-reports').emit('incident_updated', eventData);
            io.to('volunteers').emit('incident_updated', eventData);
            console.log(`📡 Emitted incident_updated for: ${incident.incidentId} -> ${incident.status}`);
        }

        res.json({
            success: true,
            message: 'Incident declined successfully',
            data: incident
        });
    } catch (error) {
        console.error('❌ Error declining incident:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};