const router = require('express').Router();
const ctrl   = require('../../controllers/app/home.controller');
const { optionalAuth } = require('../../middlewares/customer.middleware');

// GET /api/app/home  — banners + category grid + featured rails
router.get('/', optionalAuth, ctrl.getFeed);

module.exports = router;
