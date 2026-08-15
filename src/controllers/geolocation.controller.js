const User = require('../models/User.model');
const Incident = require('../models/Incident.model');
const { calculateDistance, getAddressFromCoordinates } = require('../utils/geo.utils');

// Update user location (real-time)
exports.updateLocation = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, message: 'Coordinates required' });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                lastLocation: {
                    latitude,
                    longitude,
                    updatedAt: new Date()
                }
            },
            { new: true }
        );

        // If user is a responder, emit location to active incidents
        if (user.role === 'responder' && user.responderDetails?.currentAssignment) {
            req.app.get('io').to(`incident_${user.responderDetails.currentAssignment}`).emit('responder_location', {
                responderId: user._id,
                coordinates: { latitude, longitude },
                timestamp: new Date()
            });
        }

        res.json({
            success: true,
            message: 'Location updated successfully',
            data: user.lastLocation
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get current user location
exports.getCurrentLocation = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({
            success: true,
            data: user.lastLocation || null
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get nearby responders
exports.getNearbyResponders = async (req, res) => {
    try {
        const { latitude, longitude, radius = 5 } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, message: 'Coordinates required' });
        }

        const responders = await User.find({
            role: { $in: ['responder', 'dispatcher'] },
            isActive: true,
            'responderDetails.available': true,
            'lastLocation': { $exists: true }
        });

        const nearby = responders
            .map(responder => {
                if (!responder.lastLocation) return null;
                const distance = calculateDistance(
                    parseFloat(latitude),
                    parseFloat(longitude),
                    responder.lastLocation.latitude,
                    responder.lastLocation.longitude
                );
                return {
                    id: responder._id,
                    name: `${responder.firstName} ${responder.lastName}`,
                    badgeNumber: responder.responderDetails?.badgeNumber,
                    certifications: responder.responderDetails?.certifications,
                    distance: distance.toFixed(2),
                    lastLocation: responder.lastLocation
                };
            })
            .filter(item => item && item.distance <= radius)
            .sort((a, b) => a.distance - b.distance);

        res.json({
            success: true,
            count: nearby.length,
            data: nearby
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Reverse geocode
exports.reverseGeocode = async (req, res) => {
    try {
        const { latitude, longitude } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, message: 'Coordinates required' });
        }

        const address = await getAddressFromCoordinates(latitude, longitude);

        res.json({
            success: true,
            data: {
                address,
                coordinates: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Calculate ETA for responder
exports.calculateETA = async (req, res) => {
    try {
        const { responderId, incidentId } = req.params;

        const responder = await User.findById(responderId);
        const incident = await Incident.findById(incidentId);

        if (!responder || !incident) {
            return res.status(404).json({ success: false, message: 'Responder or incident not found' });
        }

        if (!responder.lastLocation) {
            return res.status(400).json({ success: false, message: 'Responder location not available' });
        }

        const distance = calculateDistance(
            responder.lastLocation.latitude,
            responder.lastLocation.longitude,
            incident.location.coordinates.latitude,
            incident.location.coordinates.longitude
        );

        const estimatedMinutes = Math.ceil((distance / 40) * 60);

        res.json({
            success: true,
            data: {
                distance: `${distance.toFixed(2)} km`,
                estimatedETA: estimatedMinutes,
                estimatedArrival: new Date(Date.now() + estimatedMinutes * 60000)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get heatmap data
exports.getHeatmapData = async (req, res) => {
    try {
        const { days = 30, barangay } = req.query;
        const since = new Date();
        since.setDate(since.getDate() - parseInt(days));

        const matchQuery = {
            reportedAt: { $gte: since },
            'location.coordinates.latitude': { $exists: true }
        };

        if (barangay) matchQuery['location.barangay'] = barangay;

        const heatmapData = await Incident.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: {
                        latitude: { $round: ['$location.coordinates.latitude', 4] },
                        longitude: { $round: ['$location.coordinates.longitude', 4] }
                    },
                    count: { $sum: 1 },
                    severityScore: {
                        $avg: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ['$severity', 'Critical'] }, then: 4 },
                                    { case: { $eq: ['$severity', 'High'] }, then: 3 },
                                    { case: { $eq: ['$severity', 'Medium'] }, then: 2 }
                                ],
                                default: 1
                            }
                        }
                    }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 100 }
        ]);

        res.json({
            success: true,
            data: heatmapData.map(item => ({
                latitude: item._id.latitude,
                longitude: item._id.longitude,
                intensity: item.count,
                severityScore: item.severityScore
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};