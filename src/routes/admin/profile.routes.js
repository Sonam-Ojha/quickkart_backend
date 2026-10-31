const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');
const { getProfile, updateProfile, changePassword, saveFcmToken } = require('../../controllers/admin/profile.controller');

router.get('/', authenticate, requireAdmin, getProfile);
router.put('/', authenticate, requireAdmin, updateProfile);
router.patch('/password', authenticate, requireAdmin, changePassword);
router.post('/fcm-token', authenticate, requireAdmin, saveFcmToken);

module.exports = router;
