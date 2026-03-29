require('dotenv').config();
const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Strict structural validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address format' });
  }

  if (name.trim().length < 2) {
    return res.status(400).json({ error: 'Name is too short' });
  }

  if (message.trim().length < 5) {
    return res.status(400).json({ error: 'Message is too short' });
  }

  // Create a transporter using your SMTP credentials (from environment variables)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: (process.env.SMTP_PASSWORD || '').replace(/\s+/g, ''),
    },
  });

  const mailOptions = {
    from: `"Portfolio Alerts" <${process.env.SMTP_EMAIL}>`, // Static sender bypassing spoof filters
    to: 'prakharbankhede15@gmail.com',
    replyTo: email,
    subject: `Portfolio Contact: ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    html: `
      <h3>New Portfolio Message</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('SMTP Error:', error);
    return res.status(500).json({ error: 'Failed to send message. Please try again later.' });
  }
}
