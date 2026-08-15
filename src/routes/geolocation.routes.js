const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const {
    updateLocation,
    getCurrentLocation,
    getNearbyResponders,
    reverseGeocode,
    calculateETA,
    getHeatmapData
} = require('../controllers/geolocation.controller');

router.get('/current', protect, getCurrentLocation);
router.post('/update', protect, updateLocation);
router.get('/nearby-responders', protect, getNearbyResponders);
router.get('/reverse-geocode', reverseGeocode);
router.get('/eta/:responderId/:incidentId', protect, calculateETA);
router.get('/heatmap', protect, authorize('admin', 'dispatcher'), getHeatmapData);

module.exports = router;