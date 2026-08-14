// src/services/alert.service.js
const webpush = require('web-push');
const nodemailer = require('nodemailer');

// 1. Ensure VAPID keys are set
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn("⚠️ WARNING: VAPID keys missing in .env. Push notifications will fail.");
}

// 2. Configure Web Push
webpush.setVapidDetails(
    'mailto:' + (process.env.EMAIL_USER || 'admin@rescuesystem.com'),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// 3. Configure Email (Gmail)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ==========================================================
// 🚨 LAYER 1: WEB PUSH (Siren + Vibration)
// ==========================================================
exports.sendEmergencyPush = async (subscription, volunteerName, incidentData) => {
    if (!subscription) return false;

    const payload = JSON.stringify({
        title: "🚨 EMERGENCY DISPATCH",
        body: `You have been dispatched to a ${incidentData.severity} incident at ${incidentData.address}`,
        icon: "/logo.png",
        badge: "/badge.png",
        vibrate: [200, 100, 200, 100, 200],
        sound: "/siren.mp3", // 🔔 Put your siren.mp3 file in React's public folder!
        requireInteraction: true,
        data: {
            url: process.env.FRONTEND_URL + "/volunteer-dashboard",
            incidentId: incidentData.incidentId
        }
    });

    try {
        await webpush.sendNotification(subscription, payload);
        console.log(`📢 Push alert sent to ${volunteerName}`);
        return true;
    } catch (error) {
        console.error('❌ Push failed:', error.message);
        return false;
    }
};

// ==========================================================
// 📧 LAYER 2: EMAIL BACKUP (Gmail)
// ==========================================================
exports.sendEmailAlert = async (toEmail, volunteerName, incidentData) => {
    if (!toEmail) return false;

    try {
        const mailOptions = {
            from: `"Rescue System" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: `🚨 EMERGENCY DISPATCH: ${incidentData.type}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <div style="background-color: #d32f2f; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">🚨 EMERGENCY ALERT</h1>
                        <p>You have been dispatched to an incident.</p>
                    </div>
                    <div style="padding: 20px;">
                        <p>Dear <strong>${volunteerName}</strong>,</p>
                        <p>You have been assigned to a <strong>${incidentData.severity}</strong> priority incident at ${incidentData.address}.</p>
                        <h3>Incident Details:</h3>
                        <p><strong>ID:</strong> ${incidentData.incidentId}</p>
                        <p><strong>Type:</strong> ${incidentData.type}</p>
                        <p><strong>Status:</strong> Dispatched</p>
                        <p><strong>Location:</strong> ${incidentData.address}</p>
                        <div style="text-align: center; margin-top: 20px;">
                            <a href="${process.env.FRONTEND_URL}/volunteer-dashboard" style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Open Dashboard</a>
                        </div>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`📧 Email sent to ${toEmail}`);
        return true;
    } catch (error) {
        console.error('❌ Email failed:', error.message);
        return false;
    }
};