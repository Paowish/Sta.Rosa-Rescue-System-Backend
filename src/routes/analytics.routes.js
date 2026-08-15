const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const {
    getDashboardAnalytics,
    exportReport
} = require('../controllers/analytics.controller');

router.get('/dashboard', protect, authorize('admin', 'dispatcher'), getDashboardAnalytics);
router.get('/export', protect, authorize('admin'), exportReport);

module.exports = router;