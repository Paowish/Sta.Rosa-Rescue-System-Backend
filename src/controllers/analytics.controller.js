const Incident = require('../models/Incident.model');
const User = require('../models/User.model');
const VolunteerApplication = require('../models/VolunteerApplication.model');
const EmergencyResponse = require('../models/EmergencyResponse.model');

// Get dashboard analytics
exports.getDashboardAnalytics = async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfWeek = new Date(now.setDate(now.getDate() - 7));

        // Incident statistics
        const incidentStats = {
            total: await Incident.countDocuments(),
            active: await Incident.countDocuments({ status: { $in: ['Pending', 'Acknowledged', 'Active'] } }),
            resolved: await Incident.countDocuments({ status: 'Resolved' }),
            thisMonth: await Incident.countDocuments({ reportedAt: { $gte: startOfMonth } }),
            thisWeek: await Incident.countDocuments({ reportedAt: { $gte: startOfWeek } })
        };

        // Incident by type
        const byType = await Incident.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Incident by severity
        const bySeverity = await Incident.aggregate([
            { $group: { _id: '$severity', count: { $sum: 1 } } }
        ]);

        // Top barangays
        const topBarangays = await Incident.aggregate([
            { $match: { 'location.barangay': { $exists: true, $ne: null } } },
            { $group: { _id: '$location.barangay', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // Response time analytics
        const responseTimeData = await Incident.aggregate([
            { $match: { resolutionTime: { $exists: true, $ne: null } } },
            {
                $group: {
                    _id: '$type',
                    avgResponseTime: { $avg: '$resolutionTime' },
                    minResponseTime: { $min: '$resolutionTime' },
                    maxResponseTime: { $max: '$resolutionTime' }
                }
            }
        ]);

        // User statistics
        const userStats = {
            total: await User.countDocuments(),
            civilians: await User.countDocuments({ role: 'civilian' }),
            responders: await User.countDocuments({ role: 'responder' }),
            dispatchers: await User.countDocuments({ role: 'dispatcher' }),
            admins: await User.countDocuments({ role: 'admin' }),
            activeResponders: await User.countDocuments({
                role: 'responder',
                'responderDetails.available': true
            }),
            newThisMonth: await User.countDocuments({ createdAt: { $gte: startOfMonth } })
        };

        // Volunteer statistics
        const volunteerStats = {
            totalApplications: await VolunteerApplication.countDocuments(),
            pending: await VolunteerApplication.countDocuments({ status: 'pending' }),
            accepted: await VolunteerApplication.countDocuments({ status: 'accepted' }),
            rejected: await VolunteerApplication.countDocuments({ status: 'rejected' })
        };

        // Daily trends (last 7 days)
        const dailyTrends = await Incident.aggregate([
            {
                $match: {
                    reportedAt: { $gte: startOfWeek }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$reportedAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id': 1 } }
        ]);

        res.json({
            success: true,
            data: {
                incidentStats,
                userStats,
                volunteerStats,
                byType,
                bySeverity,
                topBarangays,
                responseTimeData,
                dailyTrends
            }
        });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Export report
exports.exportReport = async (req, res) => {
    try {
        const { startDate, endDate, type = 'incidents' } = req.query;

        const query = {};
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        let data = [];
        let filename = '';

        if (type === 'incidents') {
            data = await Incident.find(query)
                .populate('reportedBy', 'firstName lastName email')
                .lean();
            filename = `incidents_report_${Date.now()}.json`;
        } else if (type === 'volunteers') {
            data = await VolunteerApplication.find(query).lean();
            filename = `volunteers_report_${Date.now()}.json`;
        }

        res.json({
            success: true,
            data,
            count: data.length,
            filename
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};