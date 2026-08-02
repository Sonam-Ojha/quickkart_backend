const router  = require('express').Router();
const ctrl    = require('../../controllers/app/auth.controller');

router.post('/register',   ctrl.register);
router.post('/login',      ctrl.login);
router.post('/refresh',    ctrl.refresh);
router.post('/otp-login',  ctrl.otpLogin);

module.exports = router;
