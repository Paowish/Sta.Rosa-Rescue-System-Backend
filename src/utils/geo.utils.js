// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(degrees) {
    return degrees * (Math.PI / 180);
}

// Find nearby responders
async function findNearbyResponders(latitude, longitude, radiusKm = 5) {
    const User = require('../models/User.model');

    const responders = await User.find({
        role: 'responder',
        isActive: true,
        'responderDetails.available': true,
        'lastLocation': { $exists: true }
    });

    return responders.filter(responder => {
        if (!responder.lastLocation) return false;
        const distance = calculateDistance(
            latitude,
            longitude,
            responder.lastLocation.latitude,
            responder.lastLocation.longitude
        );
        return distance <= radiusKm;
    }).map(r => ({
        ...r.toObject(),
        distance: calculateDistance(latitude, longitude, r.lastLocation.latitude, r.lastLocation.longitude)
    })).sort((a, b) => a.distance - b.distance);
}

// Get address from coordinates
async function getAddressFromCoordinates(latitude, longitude) {
    // For development, return a mock address
    // In production, use Google Maps API
    return `${latitude}, ${longitude}`;
}

module.exports = {
    calculateDistance,
    findNearbyResponders,
    getAddressFromCoordinates
};