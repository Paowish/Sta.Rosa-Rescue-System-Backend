const webpush = require('web-push');
const { sendEmail: sendBrevoEmail } = require('./brevoEmail.service');

if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn("‚ö†Ô∏è VAPID keys missing in .env.");
}

webpush.setVapidDetails(
    'mailto:' + (process.env.EMAIL_USER || 'admin@rescuesystem.com'),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(email)) return false;
    const fake = ['volunteer.com','example.com','test.com','fake.com','mock.com','sample.com','demo.com','none.com'];
    return !fake.includes(email.split('@')[1].toLowerCase());
};

exports.sendEmergencyPush = async (subscription, volunteerName, incidentData) => {
    if (!subscription) return false;
    const payload = JSON.stringify({
        title: "Ì∫® EMERGENCY DISPATCH",
        body: `Dispatched to ${incidentData.severity} incident at ${incidentData.address}`,
        icon: "/logo.png",
        vibrate: [200,100,200,100,200],
        requireInteraction: true,
        data: { url: process.env.FRONTEND_URL + "/volunteer-dashboard", incidentId: incidentData.incidentId }
    });
    try {
        await webpush.sendNotification(subscription, payload);
        console.log(`Ì≥¢ Push sent to ${volunteerName}`);
        return true;
    } catch (error) {
        console.error('‚ùå Push failed:', error.message);
        return false;
    }
};

exports.sendEmailAlert = async (toEmail, volunteerName, incidentData) => {
    if (!isValidEmail(toEmail)) {
        console.log(`‚ö†Ô∏è Skipping invalid email: ${toEmail}`);
        return false;
    }
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
            <div style="background: #d32f2f; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">Ì∫® EMERGENCY ALERT</h1>
            </div>
            <div style="padding: 20px;">
                <p>Dear <strong>${volunteerName}</strong>,</p>
                <p>You have been assigned to a <strong>${incidentData.severity}</strong> incident at ${incidentData.address}.</p>
                <p><strong>ID:</strong> ${incidentData.incidentId}</p>
                <p><strong>Type:</strong> ${incidentData.type}</p>
                <div style="text-align:center; margin-top:20px;">
                    <a href="${process.env.FRONTEND_URL}/volunteer-dashboard" style="background:#1976d2; color:white; padding:12px 24px; text-decoration:none; border-radius:4px; font-weight:bold;">Open Dashboard</a>
                </div>
            </div>
        </div>`;
    const result = await sendBrevoEmail(toEmail, volunteerName, `Ì∫® EMERGENCY DISPATCH: ${incidentData.type}`, html);
    if (result.success) {
        console.log(`Ì≥ß Email sent to ${toEmail}`);
        return true;
    }
    return false;
};
