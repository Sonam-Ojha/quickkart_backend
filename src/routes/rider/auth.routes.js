const express = require('express');
const router  = express.Router();
const { authenticateRider, authenticateSignup } = require('../../middlewares/rider.middleware');
const ctrl = require('../../controllers/rider/auth.controller');

// Public
router.post('/send-otp',   ctrl.sendOtp);
router.post('/verify-otp', ctrl.verifyOtp);
router.post('/login',      ctrl.login);      // password, for admin-created riders
router.get('/stores',      ctrl.stores);     // store picker during registration

// Signup token only (issued by verify-otp for an unregistered mobile)
router.post('/register', authenticateSignup, ctrl.register);

// Rider token
router.get('/me', authenticateRider, ctrl.me);

module.exports = router;
