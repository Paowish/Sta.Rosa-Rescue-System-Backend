const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate, incidentValidation } = require('../middleware/validation.middleware');
const {
    reportIncident,
    getAllIncidents,
    getIncidentById,
    getNearbyIncidents,
    assignResponders,
    updateIncidentStatus,
    resolveIncident,
    getIncidentStats,
    acceptIncident,
    declineIncident
} = require('../controllers/incident.controller');

// ✅ Public/Protected routes
router.post('/', protect, incidentValidation, validate, reportIncident);
router.get('/', protect, getAllIncidents);
router.get('/nearby', protect, getNearbyIncidents);
router.get('/stats', protect, authorize('admin', 'dispatcher'), getIncidentStats);
router.get('/:id', protect, getIncidentById);

// ✅ Update routes
router.put('/:id/assign', protect, authorize('admin', 'dispatcher'), assignResponders);
router.put('/:id/status', protect, authorize('admin', 'dispatcher', 'responder'), updateIncidentStatus);
router.put('/:id/resolve', protect, authorize('admin', 'responder'), resolveIncident);

// ✅ Volunteer routes
router.put('/:id/accept', protect, authorize('volunteer'), acceptIncident);
router.put('/:id/decline', protect, authorize('volunteer'), declineIncident);

module.exports = router;