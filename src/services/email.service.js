// src/services/email.service.js
const nodemailer = require('nodemailer');

// ✅ Helper function to get transporter with fresh credentials
const getTransporter = () => {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    console.log('📧 Creating email transporter with:', {
        user: user || '❌ NOT SET',
        pass: pass ? '✅ Set (length: ' + pass.length + ')' : '❌ NOT SET'
    });

    if (!user || !pass) {
        console.error('❌ Email credentials missing! Check your .env file.');
        throw new Error('Email credentials not configured properly.');
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: user,
            pass: pass
        }
    });
};

// ✅ Get FRONTEND_URL - ALWAYS use ngrok URL
const getFrontendUrl = () => {
    // ✅ ALWAYS use ngrok URL for mobile testing
    const ngrokUrl = 'https://hammily-unscaled-synthia.ngrok-free.dev';

    // For development, try .env first, then fallback to ngrok
    const envUrl = process.env.FRONTEND_URL;
    if (envUrl) {
        console.log('🔗 Using FRONTEND_URL from .env:', envUrl);
        return envUrl;
    }

    console.log('🔗 Using default ngrok URL:', ngrokUrl);
    return ngrokUrl;
};

// ✅ Send email function - creates fresh transporter each time
const sendEmail = async (to, subject, html, text = '') => {
    try {
        console.log(`📧 Attempting to send email to: ${to}`);

        const transporter = getTransporter();

        const mailOptions = {
            from: `"Rescue Team" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: html,
            text: text || html.replace(/<[^>]*>/g, '')
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent successfully to ${to}:`, info.messageId);

        return {
            success: true,
            messageId: info.messageId,
            response: info.response
        };
    } catch (error) {
        console.error('❌ Email send error:', error.message);
        console.error('❌ Full error details:', error);

        return {
            success: false,
            error: error.message,
            code: error.code || 'UNKNOWN_ERROR'
        };
    }
};

// ✅ Volunteer Accepted Email - FIXED FOR GMAIL MOBILE
const sendVolunteerAccepted = async (email, firstName, lastName) => {
    const subject = '✅ Volunteer Application Accepted - Rescue Team';
    const frontendUrl = getFrontendUrl();

    console.log('🔗 Frontend URL for email:', frontendUrl);

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Volunteer Application Accepted</title>
            <style>
                body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
                .container { max-width: 600px; margin: 20px auto; padding: 20px; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                .header { background: #1f6b75; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .header h1 { margin: 0; font-size: 28px; }
                .header p { margin: 5px 0 0; opacity: 0.9; font-size: 14px; }
                .content { padding: 30px; }
                .badge { background: #22c55e; color: white; padding: 4px 12px; border-radius: 20px; display: inline-block; font-size: 14px; font-weight: bold; }
                .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; }
                .highlight-box { background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e; }
                .highlight-box ul { margin: 5px 0; padding-left: 20px; }
                .highlight-box li { margin: 5px 0; }
                .btn-container { text-align: center; margin: 30px 0; }
                .btn { 
                    background: #1f6b75; 
                    color: #ffffff !important; 
                    padding: 14px 35px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    font-weight: bold; 
                    font-size: 16px; 
                    display: inline-block;
                    background-color: #1f6b75;
                    border-radius: 5px;
                }
                .link-box { 
                    background: #f8f9fa; 
                    padding: 15px; 
                    border-radius: 8px; 
                    margin: 20px 0; 
                    border: 1px dashed #ccc;
                    text-align: center;
                }
                .link-box a { 
                    color: #1f6b75; 
                    word-break: break-all;
                    text-decoration: underline;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚒 Rescue Team</h1>
                    <p>Santa Rosa Emergency Response</p>
                </div>
                <div class="content">
                    <h2>Congratulations, ${firstName} ${lastName}! 🎉</h2>
                    <p style="font-size: 16px; line-height: 1.6;">
                        We are pleased to inform you that your volunteer application has been 
                        <span class="badge">✅ ACCEPTED</span>
                    </p>
                    <p style="font-size: 16px; line-height: 1.6;">
                        You are now officially part of the <strong>Santa Rosa Rescue Team</strong>! 
                        Your dedication and willingness to serve the community are greatly appreciated.
                    </p>
                    <div class="highlight-box">
                        <strong>🔑 What's next?</strong>
                        <ul>
                            <li>Login to your account using your registered email and password</li>
                            <li>Complete your profile and be ready to respond</li>
                            <li>You will start receiving dispatch notifications</li>
                            <li>Stay ready to respond to emergencies in your community!</li>
                        </ul>
                    </div>
                    
                    <!-- ✅ Button (works on desktop Gmail) -->
                    <div class="btn-container">
                        <a href="${frontendUrl}/login" class="btn" style="background: #1f6b75; color: #ffffff; padding: 14px 35px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
                            Login to Your Account
                        </a>
                    </div>
                    
                </div>
                <div class="footer">
                    <p>© 2025 Rescue Team - Municipality of Santa Rosa</p>
                    <p>This is an automated message, please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    return await sendEmail(email, subject, html);
};

// ✅ Volunteer Rejected Email - FIXED FOR GMAIL MOBILE
const sendVolunteerRejected = async (email, firstName, lastName, reason = '') => {
    const subject = '❌ Volunteer Application Update - Rescue Team';
    const frontendUrl = getFrontendUrl();

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Volunteer Application Update</title>
            <style>
                body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
                .container { max-width: 600px; margin: 20px auto; padding: 20px; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                .header { background: #1f6b75; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .header h1 { margin: 0; font-size: 28px; }
                .header p { margin: 5px 0 0; opacity: 0.9; font-size: 14px; }
                .content { padding: 30px; }
                .badge { background: #dc2626; color: white; padding: 4px 12px; border-radius: 20px; display: inline-block; font-size: 14px; font-weight: bold; }
                .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; }
                .error-box { background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626; }
                .info-box { background: #fefce8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #eab308; }
                .info-box ul { margin: 5px 0; padding-left: 20px; }
                .info-box li { margin: 5px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚒 Rescue Team</h1>
                    <p>Santa Rosa Emergency Response</p>
                </div>
                <div class="content">
                    <h2>Hello ${firstName} ${lastName},</h2>
                    <p style="font-size: 16px; line-height: 1.6;">
                        We have reviewed your volunteer application and it has been 
                        <span class="badge">❌ REJECTED</span>
                    </p>
                    ${reason ? `
                        <div class="error-box">
                            <strong>📝 Reason:</strong><br>
                            ${reason}
                        </div>
                    ` : ''}
                    <p style="font-size: 16px; line-height: 1.6;">
                        We appreciate your interest in joining our team. Unfortunately, 
                        we are unable to accept your application at this time.
                    </p>
                    <div class="info-box">
                        <strong>💡 What can you do?</strong>
                        <ul>
                            <li>You can re-apply after 3 months with additional experience</li>
                            <li>Consider gaining more certifications or training</li>
                            <li>You can still support us as a civilian reporter</li>
                        </ul>
                    </div>
                </div>
                <div class="footer">
                    <p>© 2025 Rescue Team - Municipality of Santa Rosa</p>
                    <p>This is an automated message, please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    return await sendEmail(email, subject, html);
};

module.exports = {
    sendEmail,
    sendVolunteerAccepted,
    sendVolunteerRejected
};