const router     = require('express').Router();
const otpService = require('../../services/otp.service');

// POST /api/app/otp/send
// Body: { email: "user@gmail.com" } OR { mobile: "9876543210" }
router.post('/send', async (req, res) => {
  try {
    const { email, mobile } = req.body;

    if (email) {
      const result = await otpService.sendOtpEmail(email);
      return res.json({ success: true, channel: 'email', dev: result.dev || false });
    }

    if (mobile) {
      if (!/^\d{10}$/.test(mobile)) {
        return res.status(400).json({ message: 'Valid 10-digit mobile number required' });
      }
      const result = await otpService.sendOtpSms(mobile);
      return res.json({ success: true, channel: 'sms', dev: result.dev || false });
    }

    return res.status(400).json({ message: 'email or mobile is required' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to send OTP' });
  }
});

// POST /api/app/otp/verify
// Body: { key: "user@gmail.com or 9876543210", otp: "123456" }
router.post('/verify', (req, res) => {
  const { email, mobile, otp } = req.body;
  const key = email || mobile;
  if (!key || !otp) {
    return res.status(400).json({ message: 'email/mobile and otp are required' });
  }
  const result = otpService.verifyOtp(key, otp);
  if (!result.valid) {
    return res.status(400).json({ message: result.reason });
  }
  res.json({ success: true });
});

module.exports = router;
