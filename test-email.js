// test-email.js
require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendTest = async () => {
    try {
        console.log('📧 Sending test email to:', process.env.EMAIL_USER);
        const info = await transporter.sendMail({
            from: `"Rescue Team" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER, // Send to yourself
            subject: '✅ Test Email - Rescue Team',
            html: '<h1>Test Email</h1><p>If you see this, email is working!</p>'
        });
        console.log('✅ Email sent:', info.messageId);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Full error:', error);
    }
};

sendTest();