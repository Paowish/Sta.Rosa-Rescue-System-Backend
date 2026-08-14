// rescue-response-backend/src/routes/volunteer.routes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const volunteerController = require('../controllers/volunteer.controller');

// ============================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================
router.use(protect);
router.use(authorize('responder', 'volunteer', 'admin'));

// ============================================
// DASHBOARD
// ============================================
router.get('/stats', volunteerController.getVolunteerStats);

// ============================================
// PROFILE
// ============================================
router.get('/profile', volunteerController.getVolunteerProfile);
router.put('/profile', volunteerController.updateVolunteerProfile);

// ============================================
// INCIDENTS
// ============================================
router.get('/incidents', volunteerController.getVolunteerIncidents);
router.get('/incidents/:incidentId', volunteerController.getIncidentById);
router.post('/incidents/:incidentId/respond', volunteerController.respondToIncident);
router.post('/incidents/:incidentId/accept', volunteerController.acceptIncident);
router.post('/incidents/:incidentId/decline', volunteerController.declineIncident);
router.put('/incidents/:incidentId/status', volunteerController.updateIncidentStatus);

// ============================================
// NOTIFICATIONS
// ============================================
router.get('/notifications', volunteerController.getNotifications);
router.put('/notifications/:notificationId/read', volunteerController.markNotificationRead);
router.put('/notifications/read-all', volunteerController.markAllNotificationsRead);

// ============================================
// STATUS
// ============================================
router.put('/status', volunteerController.updateVolunteerStatus);

module.exports = router;