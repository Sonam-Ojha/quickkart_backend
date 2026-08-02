const https        = require('https');
const nodemailer   = require('nodemailer');

// In-memory OTP store: { key: { otp, expiresAt } }
const _store = new Map();
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function _generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Nodemailer transporter (Hostinger SMTP) ───────────────────────────────────
function _getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ── Send OTP via Email ────────────────────────────────────────────────────────
async function sendOtpEmail(email) {
  const otp = _generateOtp();
  _store.set(email, { otp, expiresAt: Date.now() + OTP_EXPIRY_MS });

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[OTP DEV] email=${email} otp=${otp}`);
    return { success: true, dev: true };
  }

  const transporter = _getTransporter();
  await transporter.sendMail({
    from: `"Jhatpats" <${process.env.SMTP_FROM}>`,
    to: email,
    replyTo: process.env.GMAIL_USER,
    subject: `${otp} is your Jhatpats verification code`,
    text: `Your Jhatpats OTP is ${otp}. It is valid for 10 minutes. Do not share this with anyone.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#ffffff;">
        <p style="font-size:20px;font-weight:bold;color:#f97316;margin:0 0 4px;">Jhatpats</p>
        <p style="color:#444;margin:0 0 24px;font-size:15px;">Here is your one-time verification code:</p>
        <div style="background:#fff7ed;border-left:4px solid #f97316;padding:20px 24px;margin-bottom:20px;">
          <p style="margin:0;font-size:36px;font-weight:bold;letter-spacing:8px;color:#f97316;">${otp}</p>
        </div>
        <p style="color:#666;font-size:13px;margin:0;">Valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#999;font-size:11px;margin:0;">If you did not request this, please ignore this email.</p>
      </div>
    `,
  });

  return { success: true, dev: false };
}

// ── Send OTP via MSG91 SMS ────────────────────────────────────────────────────
async function sendOtpSms(mobile) {
  const otp = _generateOtp();
  _store.set(mobile, { otp, expiresAt: Date.now() + OTP_EXPIRY_MS });

  const authKey = process.env.MSG91_AUTH_KEY;
  if (!authKey) {
    console.log(`[OTP DEV] mobile=${mobile} otp=${otp}`);
    return { success: true, dev: true };
  }

  const payload = JSON.stringify({
    template_id: process.env.MSG91_TEMPLATE_ID,
    mobile: `91${mobile}`,
    otp_length: 6,
    otp_expiry: 10,
    otp,
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'control.msg91.com',
      path: '/api/v5/otp',
      method: 'POST',
      headers: {
        authkey: authKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        console.log('[MSG91 RAW]', res.statusCode, data);
        try {
          const json = JSON.parse(data);
          if (json.type === 'success' || res.statusCode === 200) resolve({ success: true });
          else reject(new Error(json.message || 'MSG91 error'));
        } catch {
          reject(new Error('Invalid MSG91 response'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('MSG91 timeout')); });
    req.write(payload);
    req.end();
  });
}

// ── Verify OTP (works for both email and mobile) ──────────────────────────────
function verifyOtp(key, otp) {
  const entry = _store.get(key);
  if (!entry) return { valid: false, reason: 'OTP not sent or expired' };
  if (Date.now() > entry.expiresAt) {
    _store.delete(key);
    return { valid: false, reason: 'OTP expired' };
  }
  if (entry.otp !== String(otp)) return { valid: false, reason: 'Invalid OTP' };
  _store.delete(key);
  return { valid: true };
}

module.exports = { sendOtpEmail, sendOtpSms, verifyOtp };
