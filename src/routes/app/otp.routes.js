const router     = require('express').Router();
const otpService = require('../../services/otp.service');

// POST /api/app/otp/send
// Body: { email: "user@gmail.com" } OR { mobile: "9876543210" }
router.post('/send', async (req, res) => {
  console.log(`\n[OTP ROUTE] POST /api/app/otp/send — body:`, req.body);
  try {
    const { email, mobile } = req.body;

    if (email) {
      console.log(`[OTP ROUTE] Sending OTP via EMAIL to ${email}`);
      const result = await otpService.sendOtpEmail(email);
      console.log(`[OTP ROUTE] Email result:`, result);
      return res.json({ success: true, channel: 'email', dev: result.dev || false, ...(result.otp ? { devOtp: result.otp } : {}) });
    }

    if (mobile) {
      if (!/^\d{10}$/.test(mobile)) {
        console.log(`[OTP ROUTE] ❌ Invalid mobile: ${mobile}`);
        return res.status(400).json({ message: 'Valid 10-digit mobile number required' });
      }
      console.log(`[OTP ROUTE] Sending OTP via SMS to ${mobile}`);
      const result = await otpService.sendOtpSms(mobile);
      console.log(`[OTP ROUTE] SMS result:`, result);
      return res.json({ success: true, channel: 'sms', dev: result.dev || false, ...(result.otp ? { devOtp: result.otp } : {}) });
    }

    console.log(`[OTP ROUTE] ❌ No email or mobile in body`);
    return res.status(400).json({ message: 'email or mobile is required' });
  } catch (err) {
    console.log(`[OTP ROUTE] ❌ ERROR:`, err.message);
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
