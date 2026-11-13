require('dotenv').config();
const nodemailer = require('nodemailer');

// Best-effort per-process throttle. Vercel instances are ephemeral, so this is
// an additional spam brake rather than a substitute for an edge/WAF rate limit.
const recentSubmissions = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  // Silently accept bot submissions without sending mail or revealing filtering.
  if (typeof body.website === 'string' && body.website.trim()) {
    return res.status(200).json({ success: true, message: 'Message received.' });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Please complete all fields.' });
  }
  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (message.length < 5 || message.length > 5000) {
    return res.status(400).json({ error: 'Message must be between 5 and 5000 characters.' });
  }
  if (/[\r\n]/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (recentSubmissions.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return res.status(429).json({ error: 'Too many messages were sent. Please try again later.' });
  }
  recent.push(now);
  recentSubmissions.set(ip, recent);

  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    console.error('Contact form is unavailable: SMTP_EMAIL / SMTP_PASSWORD are not configured.');
    return res.status(503).json({ error: 'The contact form is temporarily unavailable. Please email me directly instead.' });
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replace(/\r?\n/g, '<br>');
  const subjectName = name.replace(/[\r\n]/g, ' ').slice(0, 80);
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD.replace(/\s+/g, ''),
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  try {
    await transporter.sendMail({
      from: `"Portfolio Alerts" <${process.env.SMTP_EMAIL}>`,
      to: 'prakharbankhede15@gmail.com',
      replyTo: email,
      subject: `Portfolio Contact: ${subjectName}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      html: `<h3>New Portfolio Message</h3><p><strong>Name:</strong> ${safeName}</p><p><strong>Email:</strong> ${safeEmail}</p><p><strong>Message:</strong></p><p>${safeMessage}</p>`,
    });
    return res.status(200).json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('SMTP Error:', error && error.message ? error.message : 'Unknown mail error');
    return res.status(502).json({ error: 'Message could not be delivered right now. Please email me directly.' });
  }
};
