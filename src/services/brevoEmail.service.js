// src/services/brevoEmail.service.js
// Brevo HTTPS API email sender (works on Render, no SMTP/IPv6 issues)
const axios = require('axios');

const sendEmail = async (to, toName, subject, htmlContent) => {
    if (!to || typeof to !== 'string') {
        console.warn('‚ö†Ô∏è [BREVO] Invalid recipient:', to);
        return { success: false, error: 'Invalid recipient' };
    }

    try {
        const response = await axios.post(
            'https://api.brevo.com/v3/smtp/email',
            {
                sender: {
                    name: 'Santa Rosa Rescue Team',
                    email: process.env.EMAIL_USER || 'paolocarunia139@gmail.com'
                },
                to: [{ email: to, name: toName || to }],
                subject: subject,
                htmlContent: htmlContent
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': process.env.BREVO_API_KEY
                },
                timeout: 15000
            }
        );
        console.log(`Ì≥ß [BREVO] ‚úÖ Sent to ${to} ‚Äî ID: ${response.data.messageId}`);
        return { success: true, messageId: response.data.messageId };
    } catch (error) {
        console.error(`Ì≥ß [BREVO] ‚ùå Failed to ${to}:`, error.response?.data || error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { sendEmail };
