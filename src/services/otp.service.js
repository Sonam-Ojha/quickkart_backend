const https        = require('https');
const nodemailer   = require('nodemailer');
const { randomInt } = require('crypto');
const Otp          = require('../models/otp.model');

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function _generateOtp() {
  return String(randomInt(100000, 1000000));
}

async function _saveOtp(key, otp) {
  // Delete any existing OTP for this key first
  await Otp.destroy({ where: { key } });
  await Otp.create({ key, otp, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) });
}

// ── Nodemailer transporter (Hostinger SMTP) ───────────────────────────────────
// Module-level singleton — reuses the connection pool across all email sends.
const _transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.hostinger.com',
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Send OTP via Email ────────────────────────────────────────────────────────
async function sendOtpEmail(email) {
  const otp = _generateOtp();
  await _saveOtp(email, otp);

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[OTP DEV] email=${email} otp=${otp}`);
    return { success: true, dev: true };
  }

  await _transporter.sendMail({
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

// ── Send OTP via Orbitel Bulk SMS (DLT-registered template) ──────────────────
async function sendOtpSms(mobile) {
  const otp = _generateOtp();
  await _saveOtp(mobile, otp);

  const username   = process.env.ORBITEL_USERNAME;
  const apiKey     = process.env.ORBITEL_API_KEY;
  const sender     = process.env.ORBITEL_SENDER     || 'JHTPTS';
  const templateId = process.env.ORBITEL_OTP_TEMPLATE_ID;

  if (!username || !apiKey) {
    console.log(`[OTP DEV] mobile=${mobile} otp=${otp}`);
    return { success: true, dev: true, otp };
  }

  // DLT template text with {#var#} replaced by the actual OTP
  const text = `Your Jhatpats verification code is ${otp}. Valid for 10 minutes. Do not share it with anyone.`;

  const params = new URLSearchParams({
    username,
    apiKey,
    from:       sender,
    to:         mobile,
    text,
    unicode:    'true',
    ...(templateId ? { templateid: templateId } : {}),
  });

  return new Promise((resolve, reject) => {
    const path = `/fe/api/v1/send?${params.toString()}`;
    const options = {
      hostname: 'bulksms.orbitel.in',
      path,
      method:   'GET',
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // Orbitel success: state=SUBMIT_ACCEPTED or statusCode=200
          if (
            json.state === 'SUBMIT_ACCEPTED' ||
            json.statusCode === '200' ||
            json.statusCode === 200 ||
            json.status === 'success'
          ) {
            resolve({ success: true });
          } else {
            const reason = json.description || json.message || json.Message || 'Orbitel SMS error';
            console.error(`[OTP] Orbitel failed: ${reason} | raw: ${data}`);
            resolve({ success: false, error: reason });
          }
        } catch {
          // Some providers return plain-text success
          if (res.statusCode === 200) {
            resolve({ success: true });
          } else {
            console.error('[OTP] Orbitel unexpected response:', data);
            resolve({ success: false, error: 'SMS provider error' });
          }
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[OTP] Orbitel network error: ${err.message}`);
      reject(err);
    });
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Orbitel SMS timeout'));
    });
    req.end();
  });
}

// ── Verify OTP (works for both email and mobile) ──────────────────────────────
async function verifyOtp(key, otp) {
  const entry = await Otp.findOne({ where: { key } });
  if (!entry) return { valid: false, reason: 'OTP not sent or expired' };
  if (new Date() > entry.expiresAt) {
    await entry.destroy();
    return { valid: false, reason: 'OTP expired' };
  }
  if (entry.otp !== String(otp)) return { valid: false, reason: 'Invalid OTP' };
  await entry.destroy();
  return { valid: true };
}

// ── Send plain SMS via Orbitel (order/delivery notifications) ────────────────
// NOTE: Each unique message template must be DLT-registered on Orbitel before use.
// Until a transactional template ID is configured via ORBITEL_NOTIF_TEMPLATE_ID,
// messages are only logged in dev and silently skipped in production.
async function sendSms(mobile, message) {
  const username   = process.env.ORBITEL_USERNAME;
  const apiKey     = process.env.ORBITEL_API_KEY;
  const sender     = process.env.ORBITEL_SENDER           || 'JHTPTS';
  const templateId = process.env.ORBITEL_NOTIF_TEMPLATE_ID;

  if (!username || !apiKey || !mobile) {
    console.log(`[SMS] DEV — to=${mobile}: ${message}`);
    return;
  }

  if (!templateId) {
    // DLT template for order notifications not yet registered — skip silently in prod
    console.warn(`[SMS] ORBITEL_NOTIF_TEMPLATE_ID not set — skipping SMS to ${mobile}`);
    return;
  }

  const params = new URLSearchParams({
    username,
    apiKey,
    from:       sender,
    to:         mobile,
    text:       message,
    unicode:    'true',
    templateid: templateId,
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'bulksms.orbitel.in',
      path:     `/fe/api/v1/send?${params.toString()}`,
      method:   'GET',
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        console.log(`[SMS] Orbitel to=${mobile} status=${res.statusCode} | ${data}`);
        resolve();
      });
    });
    req.on('error', (err) => { console.error(`[SMS] Orbitel error: ${err.message}`); resolve(); });
    req.setTimeout(10000, () => { req.destroy(); resolve(); });
    req.end();
  });
}

module.exports = { sendOtpEmail, sendOtpSms, sendSms, verifyOtp };
