require('dotenv').config();
const axios = require('axios');

const to = 'caruniapaolovince@gmail.com';

console.log('Sending test email to:', to);
console.log('From:', process.env.EMAIL_USER);
console.log('Brevo key set:', !!process.env.BREVO_API_KEY);

axios.post(
  'https://api.brevo.com/v3/smtp/email',
  {
    sender: {
      name: 'Santa Rosa Rescue Team',
      email: process.env.EMAIL_USER
    },
    to: [{ email: to }],
    subject: 'Brevo Test - Rescue System',
    htmlContent: '<h2>Brevo is working!</h2><p>This is a test from your backend.</p>'
  },
  {
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY
    },
    timeout: 15000
  }
)
.then(res => {
  console.log('SUCCESS - Email sent');
  console.log('Message ID:', res.data.messageId);
})
.catch(err => {
  console.error('FAILED to send');
  console.error('Error:', err.response?.data || err.message);
});
