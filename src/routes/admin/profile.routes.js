const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { getProfile, updateProfile, changePassword } = require('../../controllers/admin/profile.controller');

router.get('/', authenticate, getProfile);
router.put('/', authenticate, updateProfile);
router.patch('/password', authenticate, changePassword);

module.exports = router;
