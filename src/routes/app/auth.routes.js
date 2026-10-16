const router  = require('express').Router();
const ctrl    = require('../../controllers/app/auth.controller');
const { authenticateCustomer } = require('../../middlewares/customer.middleware');

router.post('/register',       ctrl.register);
router.post('/login',          ctrl.login);
router.post('/refresh',        ctrl.refresh);
router.post('/otp-login',      ctrl.otpLogin);
router.delete('/account',      authenticateCustomer, ctrl.deleteAccount);

module.exports = router;
