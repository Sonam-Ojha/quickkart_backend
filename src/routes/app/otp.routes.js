const router     = require('express').Router();
const otpService = require('../../services/otp.service');

// In-memory rate limiter: max 5 send attempts per mobile/email per 15 minutes
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 5;

function isRateLimited(key) {
  const now = Date.now();
  const record = rateLimitMap.get(key) || { count: 0, windowStart: now };
  if (now - record.windowStart > RATE_WINDOW_MS) {
    record.count = 0;
    record.windowStart = now;
  }
  record.count += 1;
  rateLimitMap.set(key, record);
  // Prune expired entries to prevent unbounded memory growth
  if (rateLimitMap.size > 10000) {
    for (const [k, v] of rateLimitMap) {
      if (now - v.windowStart > RATE_WINDOW_MS) rateLimitMap.delete(k);
    }
  }
  return record.count > RATE_MAX;
}

const isDev = process.env.NODE_ENV !== 'production';

// POST /api/app/otp/send
router.post('/send', async (req, res) => {
  try {
    const { email, mobile } = req.body;

    if (email) {
      if (isRateLimited(email)) {
        return res.status(429).json({ message: 'Too many OTP requests. Try again in 15 minutes.' });
      }
      const result = await otpService.sendOtpEmail(email);
      return res.json({ success: true, channel: 'email', devOtp: isDev && result.dev ? result.otp : undefined });
    }

    if (mobile) {
      if (!/^\d{10}$/.test(mobile)) {
        return res.status(400).json({ message: 'Valid 10-digit mobile number required' });
      }
      if (isRateLimited(mobile)) {
        return res.status(429).json({ message: 'Too many OTP requests. Try again in 15 minutes.' });
      }
      const result = await otpService.sendOtpSms(mobile);
      if (!result.success) {
        return res.status(503).json({ message: 'SMS delivery failed. Please try again shortly.' });
      }
      return res.json({ success: true, channel: 'sms', devOtp: isDev && result.dev ? result.otp : undefined });
    }

    return res.status(400).json({ message: 'email or mobile is required' });
  } catch (err) {
    console.error('[OTP SEND ERROR]', err.message);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});

// POST /api/app/otp/verify
router.post('/verify', async (req, res) => {
  const { email, mobile, otp } = req.body;
  const key = email || mobile;
  if (!key || !otp) {
    return res.status(400).json({ message: 'email/mobile and otp are required' });
  }
  const result = await otpService.verifyOtp(key, otp);
  if (!result.valid) {
    return res.status(400).json({ message: result.reason });
  }
  res.json({ success: true });
});

module.exports = router;
